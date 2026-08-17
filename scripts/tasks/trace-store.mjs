import path from 'node:path';
import { appendJsonLine } from '../lib/jsonl.mjs';

const sensitiveKey = /cookie|authorization|token|api[-_]?key|password|credential|secret/i;
const sensitiveQuery = /^(sig|signature|token|auth|key|expires|expiry|credential)$/i;

function redact(value, key = '') {
  if (sensitiveKey.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    try {
      const parsed = new URL(value);
      for (const name of [...parsed.searchParams.keys()]) if (sensitiveQuery.test(name)) parsed.searchParams.set(name, '[REDACTED]');
      return parsed.toString();
    } catch { return value.replaceAll(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]'); }
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  return value;
}

export async function appendObservation(root, subscriptionId, taskId, observation) {
  const filename = path.join(root, 'traces', subscriptionId, taskId, 'observations.jsonl');
  const record = { observedAt: new Date().toISOString(), observation: redact(observation) };
  await appendJsonLine(filename, record);
  return record;
}

export { redact };
