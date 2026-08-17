import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runMigrations } from '../../scripts/system/migrations.mjs';

test('migrates version-one documents with backups', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-migrate-'));
  const directory = path.join(root, 'subscriptions', 'sub_test');
  await fs.mkdir(path.join(directory, 'episodes'), { recursive: true });
  await fs.writeFile(path.join(directory, 'subscription.json'), JSON.stringify({ schemaVersion: 1, id: 'sub_test' }));
  await fs.writeFile(path.join(directory, 'episodes', 'main-001.json'), JSON.stringify({ schemaVersion: 1, episodeKey: 'main:1' }));
  const result = await runMigrations(root);
  assert.equal(result.migrated, 2);
  assert.equal(JSON.parse(await fs.readFile(path.join(directory, 'subscription.json'), 'utf8')).schemaVersion, 2);
  assert.equal(JSON.parse(await fs.readFile(path.join(directory, 'subscription.json.bak.1'), 'utf8')).schemaVersion, 1);
});
