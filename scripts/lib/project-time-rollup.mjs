const NUMBER_PRECISION = 1_000_000;

function normalizedNumber(value) {
  return Math.round(value * NUMBER_PRECISION) / NUMBER_PRECISION;
}

function formatIssue(issue) {
  return `${issue.repository}#${issue.number}`;
}

/**
 * Calculate project estimate rollups without making API calls.
 *
 * Leaf issue values are source estimates. An issue with one or more sub-issues
 * is calculated from its immediate children, which makes nested hierarchies
 * roll up from the bottom automatically.
 */
export function calculateTimeRollups(items, targetRepository) {
  const issues = new Map();

  for (const item of items) {
    if (!item.issue || item.issue.repository !== targetRepository) continue;

    if (issues.has(item.issue.id)) {
      throw new Error(`Duplicate project item for ${formatIssue(item.issue)}.`);
    }

    issues.set(item.issue.id, item);
  }

  if (issues.size === 0) {
    throw new Error(`No ${targetRepository} issues were found in the project.`);
  }

  const calculatedValues = new Map();
  const visiting = new Set();

  function calculate(issueId, ancestry = []) {
    if (calculatedValues.has(issueId)) return calculatedValues.get(issueId);

    const item = issues.get(issueId);
    if (!item) {
      const parent = ancestry.at(-1);
      throw new Error(
        `Sub-issue ${issueId} is not a ${targetRepository} item in the project` +
          (parent ? ` (referenced by ${formatIssue(parent.issue)})` : '') +
          '. Add it to the project before calculating rollups.',
      );
    }

    if (visiting.has(issueId)) {
      const cycle = [...ancestry.map(({ issue }) => formatIssue(issue)), formatIssue(item.issue)];
      throw new Error(`Issue hierarchy contains a cycle: ${cycle.join(' -> ')}.`);
    }

    visiting.add(issueId);

    let value;
    if (item.issue.subIssueIds.length === 0) {
      if (
        typeof item.currentValue !== 'number' ||
        !Number.isFinite(item.currentValue) ||
        item.currentValue < 0
      ) {
        throw new Error(
          `${formatIssue(item.issue)} is a leaf issue and needs a non-negative Time estimate.`,
        );
      }
      value = normalizedNumber(item.currentValue);
    } else {
      value = normalizedNumber(
        item.issue.subIssueIds.reduce(
          (total, childId) => total + calculate(childId, [...ancestry, item]),
          0,
        ),
      );
    }

    visiting.delete(issueId);
    calculatedValues.set(issueId, value);
    return value;
  }

  for (const issueId of issues.keys()) calculate(issueId);

  const updates = [...issues.values()]
    .filter(({ issue }) => issue.subIssueIds.length > 0)
    .map((item) => ({
      itemId: item.itemId,
      issue: item.issue,
      previousValue: item.currentValue,
      value: calculatedValues.get(item.issue.id),
    }))
    .filter(({ previousValue, value }) =>
      typeof previousValue === 'number' ? Math.abs(previousValue - value) > Number.EPSILON : true,
    )
    .sort((left, right) => left.issue.number - right.issue.number);

  return {
    issueCount: issues.size,
    leafCount: [...issues.values()].filter(({ issue }) => issue.subIssueIds.length === 0).length,
    parentCount: [...issues.values()].filter(({ issue }) => issue.subIssueIds.length > 0).length,
    updates,
  };
}
