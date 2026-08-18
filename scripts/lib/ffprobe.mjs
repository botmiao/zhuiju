import dns from 'node:dns/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertSafeUrl, assertSafeResolvedAddresses } from './network-policy.mjs';

const execFileAsync = promisify(execFile);

const maxDistinctHosts = 32;

async function assertSafeTargets(urls) {
  const hostnames = new Set();
  for (const target of urls) {
    const parsed = assertSafeUrl(target);
    hostnames.add(parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase());
    if (hostnames.size > maxDistinctHosts) throw new Error(`ffprobe validation refused: manifest resolves to more than ${maxDistinctHosts} distinct hosts`);
  }
  for (const hostname of hostnames) {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    assertSafeResolvedAddresses(records.map((record) => record.address));
  }
}

export async function ffprobeValidate(url, manifestUrls = []) {
  await assertSafeTargets([url, ...manifestUrls]);
  try {
    const { stderr } = await execFileAsync('ffprobe', ['-v', 'error', '-rw_timeout', '15000000', url], { timeout: 30000, maxBuffer: 1024 * 1024 });
    if (stderr && stderr.trim()) return { status: 'invalid', reason: stderr.trim() };
    return { status: 'valid' };
  } catch (error) {
    if (error.code === 'ENOENT') return { status: 'unavailable' };
    return { status: 'invalid', reason: (error.stderr && error.stderr.trim()) || error.message };
  }
}
