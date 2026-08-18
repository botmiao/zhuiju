import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { dataPaths } from '../lib/paths.mjs';
import { loadConfig } from '../lib/config.mjs';
import { isStaleLease } from '../lib/file-lock.mjs';
import { createSubscriptionStore } from '../stores/subscription-store.mjs';
import { detectCapabilities } from '../runtime/runtime-detect.mjs';

const execFile = promisify(execFileCallback);

async function staleLeases(root) {
  const stale = [];
  for (const directory of [path.join(root, 'locks', 'subscriptions'), path.join(root, 'locks', 'global-slots')]) {
    let entries = [];
    try { entries = await fs.readdir(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const entry of entries.filter((name) => name.endsWith('.lock'))) {
      try {
        const metadata = JSON.parse(await fs.readFile(path.join(directory, entry), 'utf8'));
        if (isStaleLease(metadata)) stale.push(metadata.subscriptionId || entry.replace(/\.lock$/, ''));
      } catch { stale.push(entry.replace(/\.lock$/, '')); }
    }
  }
  return [...new Set(stale)];
}

export async function runDoctor(root, env = process.env) {
  const paths = dataPaths(root);
  const checks = [];
  try { await fs.access(root); checks.push({ name: 'data-root', ok: true }); } catch { checks.push({ name: 'data-root', ok: false, message: 'data root does not exist yet' }); }
  try {
    const config = await loadConfig(root);
    checks.push({ name: 'config', ok: true, data: { minimumAcquiredLevel: config.validation.minimumAcquiredLevel, useFfprobe: config.validation.useFfprobe } });
  } catch (error) { checks.push({ name: 'config', ok: false, message: error.message }); }
  try { await createSubscriptionStore(root).list(); checks.push({ name: 'subscription-store', ok: true }); } catch (error) { checks.push({ name: 'subscription-store', ok: false, message: error.message }); }
  let ffprobeAvailable = false;
  try { await execFile('ffprobe', ['-version']); ffprobeAvailable = true; } catch { ffprobeAvailable = false; }
  checks.push({ name: 'ffprobe', ok: true, available: ffprobeAvailable });
  try {
    checks.push({ name: 'stale-locks', ok: true, stale: await staleLeases(root) });
  } catch (error) { checks.push({ name: 'stale-locks', ok: false, message: error.message }); }
  checks.push({ name: 'node-fetch', ok: typeof fetch === 'function' });
  checks.push({ name: 'runtime', ok: true, data: await detectCapabilities(env) });
  return { root, checks, ok: checks.every((check) => check.ok || check.name === 'data-root') };
}
