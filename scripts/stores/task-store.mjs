import fs from 'node:fs/promises';
import { atomicWriteJson, readJsonFile } from '../lib/atomic-file.mjs';
import { subscriptionPaths } from '../lib/paths.mjs';
import { assertSchema } from '../lib/schema.mjs';

export function createTaskStore(root) {
  return {
    async get(subscriptionId) { return readJsonFile(subscriptionPaths(root, subscriptionId).task); },
    async save(task) {
      const location = subscriptionPaths(root, task.subscriptionId);
      await fs.mkdir(location.base, { recursive: true });
      assertSchema('task-state', task);
      await atomicWriteJson(location.task, task);
      return task;
    }
  };
}
