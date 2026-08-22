import fs from 'node:fs/promises';
import { dataPaths } from '../lib/paths.mjs';
import { defaultConfig } from '../lib/config.mjs';
import { atomicWriteJson } from '../lib/atomic-file.mjs';
import { runDoctor } from './doctor.mjs';

const INIT_DIRECTORIES = ['subscriptions', 'queue', 'schedules', 'logs', 'traces', 'locks', 'backups'];
const REQUIRED_NODE_MAJOR = 20;

async function exists(target) {
  try { await fs.access(target); return true; } catch { return false; }
}

export async function runInit(root) {
  const paths = dataPaths(root);
  const created = [];
  for (const name of INIT_DIRECTORIES) {
    if (!(await exists(paths[name]))) {
      await fs.mkdir(paths[name], { recursive: true });
      created.push(name);
    }
  }
  const configWritten = !(await exists(paths.config));
  if (configWritten) await atomicWriteJson(paths.config, structuredClone(defaultConfig), { backupCount: 0 });
  const major = Number(process.versions.node.split('.')[0]);
  const node = { version: process.versions.node, major, ok: major >= REQUIRED_NODE_MAJOR };
  const warnings = node.ok ? [] : [`Node ${node.version} is below the required >=${REQUIRED_NODE_MAJOR}`];
  const doctor = await runDoctor(root);
  return { root, created, configWritten, node, doctor, ok: doctor.ok, warnings };
}
