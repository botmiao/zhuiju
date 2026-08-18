import fs from 'node:fs/promises';
import path from 'node:path';
import { acquireLease } from '../lib/file-lock.mjs';
import { createId } from '../lib/ids.mjs';
import { atomicWriteJson } from '../lib/atomic-file.mjs';
import { subscriptionPaths } from '../lib/paths.mjs';
import { transitionTask } from './task-policy.mjs';
import { createTaskStore } from '../stores/task-store.mjs';
import { createQueueStore } from '../stores/queue-store.mjs';

async function acquireGlobalSlot(root, task, maximumActiveSubscriptions) {
  const directory = path.join(root, 'locks', 'global-slots');
  await fs.mkdir(directory, { recursive: true });
  for (let index = 1; index <= maximumActiveSubscriptions; index += 1) {
    try {
      return await acquireLease(path.join(directory, `slot-${String(index).padStart(2, '0')}.lock`), { subscriptionId: task.subscriptionId, taskId: task.id });
    } catch (error) { if (error.code !== 'LOCKED') throw error; }
  }
  const error = new Error('Global subscription concurrency limit reached');
  error.code = 'QUEUE_FULL';
  error.retryable = true;
  throw error;
}

async function releaseOwnedLocks(root, subscriptionId, taskId) {
  const directories = [path.join(root, 'locks', 'subscriptions'), path.join(root, 'locks', 'global-slots')];
  for (const directory of directories) {
    let entries = [];
    try { entries = await fs.readdir(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const entry of entries.filter((name) => name.endsWith('.lock'))) {
      const filename = path.join(directory, entry);
      try {
        const metadata = JSON.parse(await fs.readFile(filename, 'utf8'));
        if (metadata.subscriptionId === subscriptionId && metadata.taskId === taskId) await fs.rm(filename, { force: true });
      } catch { /* stale or concurrently removed locks are handled by the next run */ }
    }
  }
}

async function settleQueue(root, task, status) {
  const queue = createQueueStore(root);
  const pending = await queue.pending();
  const item = pending.find((entry) => entry.taskId === task.id) || {
    schemaVersion: 1,
    id: createId('queue'),
    taskId: task.id,
    subscriptionId: task.subscriptionId,
    mode: task.mode,
    trigger: task.trigger,
    createdAt: new Date().toISOString(),
    reasons: task.reasons || [],
    status: 'pending'
  };
  await queue.appendCompleted({ ...item, status });
  await queue.removePendingByTaskId(task.id);
}

export async function runSubscriptionTask(root, subscriptionId, { maximumActiveSubscriptions = 2 } = {}) {
  const taskStore = createTaskStore(root);
  const task = await taskStore.get(subscriptionId);
  const subscriptionLease = await acquireLease(path.join(root, 'locks', 'subscriptions', `${subscriptionId}.lock`), { subscriptionId, taskId: task.id });
  let slotLease;
  try {
    slotLease = await acquireGlobalSlot(root, task, maximumActiveSubscriptions);
  } catch (error) {
    await subscriptionLease.release();
    throw error;
  }
  const running = transitionTask(task, { status: 'running', phase: 'searching', startedAt: task.startedAt || new Date().toISOString() });
  await taskStore.save(running);
  return { task: running, subscriptionLease, slotLease };
}

export async function heartbeatSubscriptionTask(root, subscriptionId) {
  const taskStore = createTaskStore(root);
  const task = transitionTask(await taskStore.get(subscriptionId), {});
  await taskStore.save(task);
  const leaseFile = path.join(root, 'locks', 'subscriptions', `${subscriptionId}.lock`);
  try {
    const metadata = JSON.parse(await fs.readFile(leaseFile, 'utf8'));
    const next = { ...metadata, heartbeatAt: new Date().toISOString() };
    const temporary = `${leaseFile}.tmp-${process.pid}`;
    await fs.writeFile(temporary, `${JSON.stringify(next)}\n`, 'utf8');
    await fs.rename(temporary, leaseFile);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return task;
}

export async function completeSubscriptionTask(root, subscriptionId, result = {}) {
  const taskStore = createTaskStore(root);
  const task = transitionTask(await taskStore.get(subscriptionId), { status: 'completed', phase: 'idle', lastError: null, result });
  await taskStore.save(task);
  await releaseOwnedLocks(root, subscriptionId, task.id);
  await settleQueue(root, task, 'completed');
  return task;
}

export async function failSubscriptionTask(root, subscriptionId, error) {
  const taskStore = createTaskStore(root);
  const task = transitionTask(await taskStore.get(subscriptionId), { status: 'failed', phase: 'idle', lastError: { code: error.code || 'TASK_FAILED', message: error.message, retryable: Boolean(error.retryable) } });
  await taskStore.save(task);
  await releaseOwnedLocks(root, subscriptionId, task.id);
  await settleQueue(root, task, 'failed');
  return task;
}

export async function updateTaskStatus(root, subscriptionId, status) {
  const taskStore = createTaskStore(root);
  const task = transitionTask(await taskStore.get(subscriptionId), { status, phase: status === 'running' ? 'searching' : 'idle' });
  await taskStore.save(task);
  if (['paused', 'cancelled'].includes(status)) await releaseOwnedLocks(root, subscriptionId, task.id);
  if (status === 'cancelled') await settleQueue(root, task, 'cancelled');
  return task;
}
