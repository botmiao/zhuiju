import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

async function ensureParent(filename) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
}

export async function readJsonFile(filename) {
  return JSON.parse(await fs.readFile(filename, 'utf8'));
}

export async function atomicWriteJson(filename, value, { backupCount = 3, spacing = 2 } = {}) {
  await ensureParent(filename);
  const temporary = `${filename}.tmp-${process.pid}-${randomUUID()}`;
  const content = `${JSON.stringify(value, null, spacing)}\n`;
  const handle = await fs.open(temporary, 'w');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  for (let index = backupCount; index >= 1; index -= 1) {
    const current = `${filename}.bak.${index}`;
    const next = `${filename}.bak.${index + 1}`;
    if (index === backupCount) await fs.rm(current, { force: true });
    else {
      try { await fs.rename(current, next); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  if (backupCount > 0) {
    try { await fs.rename(filename, `${filename}.bak.1`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await fs.rename(temporary, filename);
}
