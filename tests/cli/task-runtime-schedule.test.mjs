import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execute } from '../../scripts/cli.mjs';

test('CLI task, runtime, schedule, doctor, and migration commands return structured results', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-cli-system-'));
  const input = path.join(root, 'sub.json');
  await fs.writeFile(input, JSON.stringify({ title: 'System CLI', releaseSchedule: { timezone: 'UTC', rule: { frequency: 'weekly', dayOfWeek: 'sunday' }, triggerTimes: ['18:25', '18:50'] } }));
  const added = await execute(['subscription', 'add', '--input', input], root);
  assert.equal(added.ok, true);
  const id = added.data.id;
  const queued = await execute(['task', 'enqueue', '--subscription', id, '--mode', 'incremental', '--trigger', 'manual'], root);
  assert.equal(queued.ok, true);
  assert.equal((await execute(['task', 'status', id], root)).ok, true);
  assert.equal((await execute(['runtime', 'detect'], root)).data.runtime, 'generic-local-agent');
  const schedule = await execute(['schedule', 'sync', id], root);
  assert.deepEqual(schedule.data.schedule.triggerTimes, ['18:25', '18:50']);
  assert.equal((await execute(['doctor'], root)).ok, true);
  assert.equal((await execute(['migrate'], root)).ok, true);
});
