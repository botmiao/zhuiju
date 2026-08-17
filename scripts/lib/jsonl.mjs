import fs from 'node:fs/promises';
import path from 'node:path';

export async function appendJsonLine(filename, value) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.appendFile(filename, `${JSON.stringify(value)}\n`, 'utf8');
}

export async function readJsonLines(filename) {
  try {
    const content = await fs.readFile(filename, 'utf8');
    return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
