import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteJson, readJsonFile } from '../../scripts/lib/atomic-file.mjs';

test('writes JSON atomically and keeps bounded backups', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-atomic-'));
  const target = path.join(root, 'data.json');
  await atomicWriteJson(target, { version: 1 }, { backupCount: 2 });
  await atomicWriteJson(target, { version: 2 }, { backupCount: 2 });
  await atomicWriteJson(target, { version: 3 }, { backupCount: 2 });

  assert.deepEqual(await readJsonFile(target), { version: 3 });
  assert.deepEqual(await readJsonFile(`${target}.bak.1`), { version: 2 });
  assert.deepEqual(await readJsonFile(`${target}.bak.2`), { version: 1 });
  assert.deepEqual((await fs.readdir(root)).filter((name) => name.includes('.tmp-')), []);
});
