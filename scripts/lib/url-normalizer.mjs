import { createHash } from 'node:crypto';

export function normalizeUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) parsed.port = '';
  parsed.hash = '';
  const url = parsed.toString();
  const normalizedKey = `sha256:${createHash('sha256').update(url).digest('hex')}`;
  return { url, normalizedKey };
}
