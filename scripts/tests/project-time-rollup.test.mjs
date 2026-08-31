import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateTimeRollups } from '../lib/project-time-rollup.mjs';

const repository = 'PatGuettler/AVL';

function item(number, currentValue, subIssueNumbers = [], itemRepository = repository) {
  return {
    itemId: `item-${number}`,
    currentValue,
    issue: {
      id: `issue-${number}`,
      number,
      title: `Issue ${number}`,
      url: `https://github.com/${itemRepository}/issues/${number}`,
      repository: itemRepository,
      subIssueIds: subIssueNumbers.map((child) => `issue-${child}`),
    },
  };
}

test('adds decimal leaf estimates into their parent', () => {
  const result = calculateTimeRollups(
    [item(1, 99, [2, 3]), item(2, 0.15), item(3, 0.15)],
    repository,
  );

  assert.deepEqual(result.updates, [
    {
      itemId: 'item-1',
      issue: item(1, 99, [2, 3]).issue,
      previousValue: 99,
      value: 0.3,
    },
  ]);
});

test('rolls nested estimates up from the lowest level', () => {
  const result = calculateTimeRollups(
    [item(1, 100, [2, 5]), item(2, 50, [3, 4]), item(3, 1.25), item(4, 2), item(5, 0.5)],
    repository,
  );

  assert.deepEqual(
    result.updates.map(({ issue, value }) => [issue.number, value]),
    [
      [1, 3.75],
      [2, 3.25],
    ],
  );
});

test('does not update parent values that are already current', () => {
  const result = calculateTimeRollups(
    [item(1, 0.3, [2, 3]), item(2, 0.15), item(3, 0.15)],
    repository,
  );

  assert.equal(result.updates.length, 0);
});

test('ignores project items from another repository', () => {
  const result = calculateTimeRollups(
    [item(1, 1), item(2, 200, [], 'PatGuettler/unicorn-arcade')],
    repository,
  );

  assert.equal(result.issueCount, 1);
});

test('rejects a project with no target repository issues', () => {
  assert.throws(
    () => calculateTimeRollups([item(2, 200, [], 'PatGuettler/unicorn-arcade')], repository),
    /No PatGuettler\/AVL issues were found in the project/,
  );
});

test('rejects a leaf without an estimate', () => {
  assert.throws(
    () => calculateTimeRollups([item(1, undefined)], repository),
    /needs a non-negative Time estimate/,
  );
});

test('rejects a child that is missing from the target project', () => {
  assert.throws(
    () => calculateTimeRollups([item(1, 10, [2])], repository),
    /is not a PatGuettler\/AVL item in the project/,
  );
});

test('rejects hierarchy cycles', () => {
  assert.throws(
    () => calculateTimeRollups([item(1, 10, [2]), item(2, 10, [1])], repository),
    /Issue hierarchy contains a cycle/,
  );
});
