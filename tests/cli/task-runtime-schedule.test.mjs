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

test('task lifecycle exposes heartbeat, observations, and truthful queue status', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-cli-task-'));
  const input = path.join(root, 'sub.json');
  await fs.writeFile(input, JSON.stringify({ title: 'Task CLI' }));
  const id = (await execute(['subscription', 'add', '--input', input], root)).data.id;
  await execute(['task', 'enqueue', '--subscription', id], root);
  assert.deepEqual((await execute(['queue', 'status'], root)).data, { pending: 1, completed: 0 });
  assert.equal((await execute(['task', 'run', '--subscription', id], root)).ok, true);
  assert.equal((await execute(['task', 'heartbeat', id], root)).ok, true);
  const observation = path.join(root, 'obs.json');
  await fs.writeFile(observation, JSON.stringify({ type: 'page-visited', url: 'https://source.example/page', note: 'found player iframe' }));
  assert.equal((await execute(['task', 'observe', id, '--input', observation], root)).ok, true);
  assert.equal((await execute(['task', 'complete', id], root)).ok, true);
  assert.deepEqual((await execute(['queue', 'status'], root)).data, { pending: 0, completed: 1 });
  const task = (await execute(['task', 'status', id], root)).data;
  const traceFile = path.join(root, 'traces', id, task.id, 'observations.jsonl');
  const records = (await fs.readFile(traceFile, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
  const types = records.map((record) => record.observation.type);
  assert.ok(types.includes('task-started'));
  assert.ok(types.includes('page-visited'));
  assert.ok(types.includes('task-completed'));
});

test('CLI exposes help for the overview and each command group', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-cli-help-'));
  const overview = await execute(['--help'], root);
  assert.equal(overview.ok, true);
  assert.match(overview.data.usage, /task enqueue/);
  assert.match(overview.data.usage, /media submit/);
  const media = await execute(['media', '--help'], root);
  assert.equal(media.ok, true);
  assert.match(media.data.usage, /media submit/);
  const task = await execute(['task', 'run', '--help'], root);
  assert.equal(task.ok, true);
  assert.match(task.data.usage, /task heartbeat/);
});

test('doctor reports config, ffprobe, and stale lease health', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-cli-doctor-'));
  await fs.writeFile(path.join(root, 'config.json'), '{nope');
  const broken = await execute(['doctor'], root);
  assert.equal(broken.data.checks.find((check) => check.name === 'config').ok, false);
  await fs.rm(path.join(root, 'config.json'));
  const lockDir = path.join(root, 'locks', 'subscriptions');
  await fs.mkdir(lockDir, { recursive: true });
  await fs.writeFile(path.join(lockDir, 'sub_stale.lock'), JSON.stringify({ subscriptionId: 'sub_stale', taskId: 'task_stale', pid: 999999999, createdAt: '2020-01-01T00:00:00.000Z', heartbeatAt: '2020-01-01T00:00:00.000Z' }));
  const result = await execute(['doctor'], root);
  assert.equal(result.ok, true);
  const staleCheck = result.data.checks.find((check) => check.name === 'stale-locks');
  assert.deepEqual(staleCheck.stale, ['sub_stale']);
  const ffprobeCheck = result.data.checks.find((check) => check.name === 'ffprobe');
  assert.equal(typeof ffprobeCheck.available, 'boolean');
});

test('task run failure marks the task failed and settles the queue', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-cli-task-'));
  const input = path.join(root, 'sub.json');
  await fs.writeFile(input, JSON.stringify({ title: 'Task CLI Fail' }));
  const id = (await execute(['subscription', 'add', '--input', input], root)).data.id;
  await execute(['task', 'enqueue', '--subscription', id], root);
  const failed = await execute(['task', 'run', '--subscription', id, '--maximumActiveSubscriptions', '0'], root);
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'QUEUE_FULL');
  assert.equal((await execute(['task', 'status', id], root)).data.status, 'failed');
  assert.deepEqual((await execute(['queue', 'status'], root)).data, { pending: 0, completed: 1 });
  const recover = await execute(['task', 'fail', id, '--message', 'explicit failure'], root);
  assert.equal(recover.ok, true);
});
