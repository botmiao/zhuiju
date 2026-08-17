import { appendObservation } from './trace-store.mjs';
import { completeSubscriptionTask, failSubscriptionTask, runSubscriptionTask } from './task-controller.mjs';
import { createTaskStore } from '../stores/task-store.mjs';

export async function prepareSubscriptionRun(root, subscriptionId, options = {}) {
  const running = await runSubscriptionTask(root, subscriptionId, options);
  const task = await createTaskStore(root).get(subscriptionId);
  await appendObservation(root, subscriptionId, task.id, { type: 'task-started', mode: task.mode, phase: task.phase });
  return running;
}

export async function finishSubscriptionRun(root, subscriptionId, result = {}) {
  const task = await createTaskStore(root).get(subscriptionId);
  await appendObservation(root, subscriptionId, task.id, { type: 'task-completed', result });
  return completeSubscriptionTask(root, subscriptionId, result);
}

export async function failSubscriptionRun(root, subscriptionId, error) {
  const task = await createTaskStore(root).get(subscriptionId);
  await appendObservation(root, subscriptionId, task.id, { type: 'task-failed', error: { code: error.code, message: error.message } });
  return failSubscriptionTask(root, subscriptionId, error);
}
