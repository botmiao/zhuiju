import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../scripts/lib/config.mjs';

test('loadConfig returns schema-valid defaults when config.json is absent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-config-'));
  const config = await loadConfig(root);
  assert.equal(config.validation.minimumAcquiredLevel, 'http-valid');
  assert.equal(config.validation.segmentSampleCount, 2);
  assert.equal(config.validation.useFfprobe, true);
  assert.equal(config.concurrency.maximumActiveSubscriptions, 2);
});

test('loadConfig merges a partial config.json over defaults', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-config-'));
  await fs.writeFile(path.join(root, 'config.json'), JSON.stringify({ validation: { minimumAcquiredLevel: 'segment-valid', useFfprobe: false } }));
  const config = await loadConfig(root);
  assert.equal(config.validation.minimumAcquiredLevel, 'segment-valid');
  assert.equal(config.validation.useFfprobe, false);
  assert.equal(config.validation.segmentSampleCount, 2);
});

test('loadConfig rejects invalid JSON with a clear error', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-config-'));
  await fs.writeFile(path.join(root, 'config.json'), '{oops');
  await assert.rejects(() => loadConfig(root), /config\.json/);
});
