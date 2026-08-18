import fs from 'node:fs/promises';
import path from 'node:path';
import { appendJsonLine, readJsonLines } from '../lib/jsonl.mjs';

export function createQueueStore(root) {
  const pending = path.join(root, 'queue', 'pending.jsonl');
  const completed = path.join(root, 'queue', 'completed.jsonl');
  return {
    async appendPending(item) { await fs.mkdir(path.dirname(pending), { recursive: true }); await appendJsonLine(pending, item); return item; },
    async appendCompleted(item) { await fs.mkdir(path.dirname(completed), { recursive: true }); await appendJsonLine(completed, item); return item; },
    async removePendingByTaskId(taskId) {
      const items = await this.pending();
      const kept = items.filter((item) => item.taskId !== taskId);
      if (kept.length === items.length) return;
      await fs.mkdir(path.dirname(pending), { recursive: true });
      await fs.writeFile(pending, kept.map((item) => JSON.stringify(item)).join('\n') + (kept.length ? '\n' : ''), 'utf8');
    },
    async pending() { return readJsonLines(pending); },
    async completed() { return readJsonLines(completed); }
  };
}
