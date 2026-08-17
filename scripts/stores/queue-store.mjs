import fs from 'node:fs/promises';
import path from 'node:path';
import { appendJsonLine, readJsonLines } from '../lib/jsonl.mjs';

export function createQueueStore(root) {
  const pending = path.join(root, 'queue', 'pending.jsonl');
  const completed = path.join(root, 'queue', 'completed.jsonl');
  return {
    async appendPending(item) { await fs.mkdir(path.dirname(pending), { recursive: true }); await appendJsonLine(pending, item); return item; },
    async appendCompleted(item) { await fs.mkdir(path.dirname(completed), { recursive: true }); await appendJsonLine(completed, item); return item; },
    async pending() { return readJsonLines(pending); },
    async completed() { return readJsonLines(completed); }
  };
}
