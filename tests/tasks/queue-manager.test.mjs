import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSubscriptionStore } from '../../scripts/stores/subscription-store.mjs';
import { enqueueSubscriptionTask } from '../../scripts/tasks/queue-manager.mjs';

test('coalesces repeated triggers for the same subscription', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-queue-'));
  const subscription = await createSubscriptionStore(root).add({ title: 'Queue Test' });
  const first = await enqueueSubscriptionTask(root, { subscriptionId: subscription.id, mode: 'incremental', trigger: 'cron', reason: '18:25' });
  const second = await enqueueSubscriptionTask(root, { subscriptionId: subscription.id, mode: 'incremental', trigger: 'cron', reason: '18:50' });
  assert.equal(first.task.id, second.task.id);
  assert.equal(second.task.status, 'queued');
  assert.deepEqual(second.task.reasons, ['18:25', '18:50']);
});
