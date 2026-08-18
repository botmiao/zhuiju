import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function runCli(root, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/cli.mjs', ...args], {
      cwd: path.resolve('.'),
      env: { ...process.env, ZHUIJU_HOME: root },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

test('subscription and episode CLI output is structured JSON', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-cli-'));
  const input = path.join(root, 'subscription-input.json');
  await fs.writeFile(input, JSON.stringify({ title: 'CLI Test', slug: 'cli-test' }));
  const added = await runCli(root, ['subscription', 'add', '--input', input]);
  assert.equal(added.code, 0, added.stderr);
  const addedResult = JSON.parse(added.stdout);
  assert.equal(addedResult.ok, true);
  const id = addedResult.data.id;
  const listed = await runCli(root, ['subscription', 'list']);
  assert.equal(JSON.parse(listed.stdout).data.length, 1);
  const ensured = await runCli(root, ['episode', 'ensure', id, 'main:1']);
  assert.equal(ensured.code, 0, ensured.stderr);
  assert.equal(JSON.parse(ensured.stdout).data.episodeKey, 'main:1');
});

test('rejects path-traversing subscription identifiers without touching the filesystem', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-cli-'));
  for (const args of [['subscription', 'get', '../../outside'], ['subscription', 'remove', '..\\..\\outside'], ['schedule', 'show', 'sub_..%2f..']]) {
    const result = await runCli(root, args);
    assert.equal(result.code, 1, `${args.join(' ')}: ${result.stdout}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, false, args.join(' '));
    assert.equal(parsed.code, 'VALIDATION_ERROR', args.join(' '));
  }
  let entries = [];
  try { entries = await fs.readdir(root); } catch { /* root may not exist */ }
  assert.deepEqual(entries, []);
});
