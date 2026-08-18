import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson, readJsonFile } from '../lib/atomic-file.mjs';
import { assertSubscriptionId } from '../lib/paths.mjs';
import { assertSchema } from '../lib/schema.mjs';

export function createScheduleStore(root) {
  const filename = (id) => path.join(root, 'schedules', `${assertSubscriptionId(id)}.json`);
  return {
    async save(schedule) {
      assertSchema('schedule', schedule);
      await atomicWriteJson(filename(schedule.subscriptionId), schedule);
      return schedule;
    },
    async get(subscriptionId) { return readJsonFile(filename(subscriptionId)); },
    async remove(subscriptionId) { await fs.rm(filename(subscriptionId), { force: true }); return { subscriptionId, removed: true }; },
    async list() {
      let entries = [];
      try { entries = await fs.readdir(path.join(root, 'schedules'), { withFileTypes: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const values = [];
      for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith('.json'))) values.push(await readJsonFile(path.join(root, 'schedules', entry.name)));
      return values;
    }
  };
}
