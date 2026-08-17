import fs from 'node:fs/promises';
import { dataPaths, resolveDataRoot } from '../lib/paths.mjs';

export async function createStoreContext({ root = resolveDataRoot() } = {}) {
  const paths = dataPaths(root);
  await Promise.all([
    paths.subscriptions,
    paths.queue,
    paths.schedules,
    paths.logs,
    paths.traces,
    paths.locks,
    paths.backups
  ].map((directory) => fs.mkdir(directory, { recursive: true })));
  return { root, paths };
}
