import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appendObservation } from '../../scripts/tasks/trace-store.mjs';
import { buildNotification } from '../../scripts/tasks/notification-policy.mjs';

test('redacts credentials from observations and summarizes media without full URLs', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-trace-'));
  await appendObservation(root, 'sub_test', 'task_test', { url: 'https://cdn.example/video.m3u8?sig=secret', headers: { Cookie: 'session=secret', Authorization: 'Bearer secret' } });
  const trace = await fs.readFile(path.join(root, 'traces', 'sub_test', 'task_test', 'observations.jsonl'), 'utf8');
  assert.equal(trace.includes('secret'), false);
  const notification = buildNotification('new-media', { title: 'Test' }, [{ availability: 'playable', accessRequirement: 'none', url: 'https://cdn.example/long.m3u8' }]);
  assert.equal(notification.includes('long.m3u8'), false);
  assert.match(notification, /Test/);
});
