import fs from 'node:fs/promises';
import path from 'node:path';
import { dataPaths } from '../lib/paths.mjs';
import { createSubscriptionStore } from '../stores/subscription-store.mjs';
import { detectCapabilities } from '../runtime/runtime-detect.mjs';

export async function runDoctor(root, env = process.env) {
  const paths = dataPaths(root);
  const checks = [];
  try { await fs.access(root); checks.push({ name: 'data-root', ok: true }); } catch { checks.push({ name: 'data-root', ok: false, message: 'data root does not exist yet' }); }
  try { await createSubscriptionStore(root).list(); checks.push({ name: 'subscription-store', ok: true }); } catch (error) { checks.push({ name: 'subscription-store', ok: false, message: error.message }); }
  checks.push({ name: 'node-fetch', ok: typeof fetch === 'function' });
  checks.push({ name: 'runtime', ok: true, data: await detectCapabilities(env) });
  return { root, checks, ok: checks.every((check) => check.ok || check.name === 'data-root') };
}
