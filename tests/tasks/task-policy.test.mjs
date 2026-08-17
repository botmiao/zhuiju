import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTargets, createTaskState } from '../../scripts/tasks/task-policy.mjs';

const subscription = {
  id: 'sub_test',
  episodeProgress: {
    releaseCatalog: { releasedRanges: [{ from: 1, to: 4 }], state: 'confirmed' },
    acquiredRanges: [{ from: 1, to: 2 }]
  },
  incrementalPolicy: { target: 'latest-missing', maximumEpisodesPerRun: 1, includeHistoricalGaps: false },
  exceptions: []
};

test('selects newest-first bootstrap, latest incremental, and all repair targets', () => {
  assert.deepEqual(selectTargets(subscription, 'bootstrap'), ['main:4', 'main:3']);
  assert.deepEqual(selectTargets(subscription, 'incremental'), ['main:4']);
  assert.deepEqual(selectTargets(subscription, 'repair'), ['main:4', 'main:3']);
});

test('creates a task in the selecting-target phase with a bounded budget', () => {
  const task = createTaskState(subscription, 'incremental', 'cron', { maximumPages: 9 });
  assert.equal(task.subscriptionId, 'sub_test');
  assert.equal(task.status, 'queued');
  assert.equal(task.phase, 'selecting-target');
  assert.equal(task.budget.maximumPages, 9);
  assert.deepEqual(task.progress.completedEpisodes, []);
});
