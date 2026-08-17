import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { acquireLease } from '../../scripts/lib/file-lock.mjs';

test('prevents a second active lease for the same path', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-lock-'));
  const lockPath = path.join(root, 'subscription.lock');
  const first = await acquireLease(lockPath, { subscriptionId: 'sub_a' }, { leaseTimeoutMs: 60_000 });
  await assert.rejects(
    () => acquireLease(lockPath, { subscriptionId: 'sub_b' }, { leaseTimeoutMs: 60_000 }),
    /locked|active/i
  );
  await first.release();
  const second = await acquireLease(lockPath, { subscriptionId: 'sub_b' }, { leaseTimeoutMs: 60_000 });
  await second.release();
});
