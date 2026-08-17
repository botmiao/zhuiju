import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSubscriptionStore } from '../../scripts/stores/subscription-store.mjs';
import { enqueueSubscriptionTask } from '../../scripts/tasks/queue-manager.mjs';
import { runSubscriptionTask, completeSubscriptionTask } from '../../scripts/tasks/task-controller.mjs';

test('runs one subscription task under a lease and releases it on completion', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-task-'));
  const subscription = await createSubscriptionStore(root).add({ title: 'Task Test' });
  await enqueueSubscriptionTask(root, { subscriptionId: subscription.id, mode: 'manual', trigger: 'manual', reason: 'test' });
  const running = await runSubscriptionTask(root, subscription.id, { maximumActiveSubscriptions: 1 });
  assert.equal(running.task.status, 'running');
  assert.equal(running.task.phase, 'searching');
  const completed = await completeSubscriptionTask(root, subscription.id, { result: 'success' });
  assert.equal(completed.status, 'completed');
  const locks = await fs.readdir(path.join(root, 'locks', 'subscriptions'));
  assert.deepEqual(locks, []);
});
