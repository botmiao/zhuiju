import fs from 'node:fs/promises';
import path from 'node:path';

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function isStaleLease(metadata, leaseTimeoutMs = 30 * 60_000) {
  const heartbeat = Date.parse(metadata.heartbeatAt || metadata.createdAt || '');
  return !Number.isFinite(heartbeat) || Date.now() - heartbeat > leaseTimeoutMs && !isProcessAlive(metadata.pid);
}

export async function acquireLease(filename, metadata = {}, { leaseTimeoutMs = 30 * 60_000 } = {}) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const payload = {
    ...metadata,
    pid: process.pid,
    createdAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString()
  };
  try {
    const handle = await fs.open(filename, 'wx');
    await handle.writeFile(`${JSON.stringify(payload)}\n`, 'utf8');
    await handle.close();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let current;
    try { current = JSON.parse(await fs.readFile(filename, 'utf8')); } catch { current = {}; }
    if (!isStaleLease(current, leaseTimeoutMs)) {
      const busy = new Error(`Lease is active: ${filename}`);
      busy.code = 'LOCKED';
      throw busy;
    }
    await fs.rm(filename, { force: true });
    const handle = await fs.open(filename, 'wx');
    await handle.writeFile(`${JSON.stringify(payload)}\n`, 'utf8');
    await handle.close();
  }

  let released = false;
  return {
    filename,
    metadata: payload,
    async heartbeat(extra = {}) {
      if (released) return;
      const next = { ...payload, ...extra, heartbeatAt: new Date().toISOString() };
      const temporary = `${filename}.tmp-${process.pid}`;
      await fs.writeFile(temporary, `${JSON.stringify(next)}\n`, 'utf8');
      await fs.rename(temporary, filename);
      Object.assign(payload, next);
    },
    async release() {
      if (released) return;
      released = true;
      await fs.rm(filename, { force: true });
    }
  };
}
