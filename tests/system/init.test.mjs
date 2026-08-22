import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInit } from '../../scripts/system/init.mjs';
import { dataPaths } from '../../scripts/lib/paths.mjs';
import { defaultConfig } from '../../scripts/lib/config.mjs';

const INIT_DIRECTORIES = ['subscriptions', 'queue', 'schedules', 'logs', 'traces', 'locks', 'backups'];

test('init creates the data directories, default config and passes doctor on a fresh root', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-init-'));
  const result = await runInit(root);
  assert.equal(result.ok, true);
  assert.equal(result.configWritten, true);
  assert.equal(result.doctor.ok, true);
  assert.equal(result.node.version, process.versions.node);
  assert.deepEqual(result.created.sort(), [...INIT_DIRECTORIES].sort());
  for (const name of INIT_DIRECTORIES) await fs.access(dataPaths(root)[name]);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8')), defaultConfig);
});

test('init is idempotent and preserves an existing config', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-init-idem-'));
  assert.equal((await runInit(root)).configWritten, true);
  const customized = { schemaVersion: 2, defaultTimezone: 'Asia/Shanghai' };
  await fs.writeFile(path.join(root, 'config.json'), JSON.stringify(customized));
  const second = await runInit(root);
  assert.equal(second.ok, true);
  assert.equal(second.configWritten, false);
  assert.deepEqual(second.created, []);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8')), customized);
});

test('init reports an invalid existing config without overwriting it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-init-invalid-'));
  await fs.writeFile(path.join(root, 'config.json'), '{not json');
  const result = await runInit(root);
  assert.equal(result.ok, false);
  assert.equal(result.configWritten, false);
  assert.equal(await fs.readFile(path.join(root, 'config.json'), 'utf8'), '{not json');
});
