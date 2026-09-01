import process from 'node:process';

import { calculateTimeRollups } from './lib/project-time-rollup.mjs';

const GRAPHQL_URL = 'https://api.github.com/graphql';
const FIELD_NAME = process.env.PROJECT_FIELD_NAME || 'Time (hours)';
const OWNER = process.env.PROJECT_OWNER || 'PatGuettler';
const PROJECT_NUMBER = Number.parseInt(process.env.PROJECT_NUMBER || '3', 10);
const TARGET_REPOSITORY = process.env.TARGET_REPOSITORY || 'PatGuettler/ALV';
const DRY_RUN = process.argv.includes('--dry-run') || process.env.ROLLUP_DRY_RUN === 'true';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

const PROJECT_QUERY = `
  query ProjectTimeItems(
    $owner: String!
    $projectNumber: Int!
    $fieldName: String!
    $cursor: String
  ) {
    user(login: $owner) {
      projectV2(number: $projectNumber) {
        id
        title
        fields(first: 100) {
          nodes {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
          }
        }
        items(first: 100, after: $cursor) {
          nodes {
            id
            isArchived
            fieldValueByName(name: $fieldName) {
              ... on ProjectV2ItemFieldNumberValue {
                number
              }
            }
            content {
              ... on Issue {
                id
                number
                title
                url
                repository {
                  nameWithOwner
                }
                subIssues(first: 100) {
                  totalCount
                  nodes {
                    id
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateProjectTime(
    $projectId: ID!
    $itemId: ID!
    $fieldId: ID!
    $value: Float!
  ) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { number: $value }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
`;

function requiredConfiguration() {
  if (!TOKEN) {
    throw new Error(
      'GH_TOKEN or GITHUB_TOKEN is required. In Actions, configure the PROJECTS_TOKEN secret.',
    );
  }
  if (!Number.isInteger(PROJECT_NUMBER) || PROJECT_NUMBER < 1) {
    throw new Error('PROJECT_NUMBER must be a positive integer.');
  }
}

async function graphql(query, variables) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ALV-project-time-rollup',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();
  if (!response.ok || payload.errors) {
    const details = payload.errors?.map(({ message }) => message).join('; ') || response.statusText;
    throw new Error(`GitHub GraphQL request failed (${response.status}): ${details}`);
  }

  return payload.data;
}

async function loadProject() {
  const items = [];
  let cursor = null;
  let project;

  do {
    const data = await graphql(PROJECT_QUERY, {
      owner: OWNER,
      projectNumber: PROJECT_NUMBER,
      fieldName: FIELD_NAME,
      cursor,
    });
    project = data.user?.projectV2;

    if (!project) {
      throw new Error(`Project ${OWNER}/${PROJECT_NUMBER} was not found or is not accessible.`);
    }

    for (const node of project.items.nodes) {
      if (!node.content?.repository) continue;

      const subIssues = node.content.subIssues;
      if (subIssues.totalCount !== subIssues.nodes.length) {
        throw new Error(
          `${node.content.url} has more than 100 direct sub-issues; pagination support is required.`,
        );
      }

      items.push({
        itemId: node.id,
        isArchived: node.isArchived,
        currentValue: node.fieldValueByName?.number,
        issue: {
          id: node.content.id,
          number: node.content.number,
          title: node.content.title,
          url: node.content.url,
          repository: node.content.repository.nameWithOwner,
          subIssueIds: subIssues.nodes.map(({ id }) => id),
        },
      });
    }

    cursor = project.items.pageInfo.hasNextPage ? project.items.pageInfo.endCursor : null;
  } while (cursor);

  const field = project.fields.nodes.find(
    ({ name, dataType }) => name === FIELD_NAME && dataType === 'NUMBER',
  );
  if (!field) {
    throw new Error(`Project ${OWNER}/${PROJECT_NUMBER} has no numeric field named ${FIELD_NAME}.`);
  }

  return { id: project.id, title: project.title, fieldId: field.id, items };
}

function displayValue(value) {
  return typeof value === 'number' ? value : 'unset';
}

async function main() {
  requiredConfiguration();
  const project = await loadProject();
  const result = calculateTimeRollups(project.items, TARGET_REPOSITORY);

  console.log(
    `${DRY_RUN ? 'Checking' : 'Updating'} ${project.title}: ${result.leafCount} leaf estimates, ` +
      `${result.parentCount} calculated parents.`,
  );

  if (result.updates.length === 0) {
    console.log('All parent estimates are already current.');
    return;
  }

  for (const update of result.updates) {
    const description = `${update.issue.repository}#${update.issue.number} ${displayValue(
      update.previousValue,
    )} -> ${update.value}`;

    if (DRY_RUN) {
      console.log(`[dry-run] ${description}`);
      continue;
    }

    await graphql(UPDATE_MUTATION, {
      projectId: project.id,
      itemId: update.itemId,
      fieldId: project.fieldId,
      value: update.value,
    });
    console.log(`Updated ${description}`);
  }

  console.log(
    `${DRY_RUN ? 'Would update' : 'Updated'} ${result.updates.length} parent estimate(s).`,
  );
}

main().catch((error) => {
  console.error(`Time rollup failed: ${error.message}`);
  process.exitCode = 1;
});
