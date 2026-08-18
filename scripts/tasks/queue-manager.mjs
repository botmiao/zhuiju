import { createId } from '../lib/ids.mjs';
import { atomicWriteJson } from '../lib/atomic-file.mjs';
import { subscriptionPaths } from '../lib/paths.mjs';
import { assertSchema } from '../lib/schema.mjs';
import { createSubscriptionStore } from '../stores/subscription-store.mjs';
import { createTaskStore } from '../stores/task-store.mjs';
import { createQueueStore } from '../stores/queue-store.mjs';
import { createTaskState } from './task-policy.mjs';

export async function enqueueSubscriptionTask(root, input) {
  const subscription = await createSubscriptionStore(root).get(input.subscriptionId);
  const taskStore = createTaskStore(root);
  let task;
  let coalesced = false;
  try { task = await taskStore.get(subscription.id); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const reason = input.reason || input.trigger || 'manual';
  if (task && ['queued', 'running'].includes(task.status)) {
    task = { ...task, reasons: [...new Set([...(task.reasons || []), reason])], rerunRequested: task.status === 'running' ? true : task.rerunRequested };
    coalesced = true;
  } else {
    task = createTaskState(subscription, input.mode || 'incremental', input.trigger || 'manual', { budget: input.budget, reasons: [reason] });
  }
  await taskStore.save(task);
  const queueItem = {
    schemaVersion: 1,
    id: createId('queue'),
    taskId: task.id,
    subscriptionId: subscription.id,
    mode: task.mode,
    trigger: input.trigger || 'manual',
    createdAt: new Date().toISOString(),
    reasons: task.reasons,
    status: 'pending'
  };
  assertSchema('queue-item', queueItem);
  if (!coalesced) await createQueueStore(root).appendPending(queueItem);
  return { task, queueItem: coalesced ? null : queueItem, coalesced };
}

export async function readQueueStatus(root) {
  const queue = createQueueStore(root);
  const pending = await queue.pending();
  const completed = await queue.completed();
  return { pending: pending.length, completed: completed.length };
}
