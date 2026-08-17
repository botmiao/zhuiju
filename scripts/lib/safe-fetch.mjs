import dns from 'node:dns/promises';
import { assertSafeResolvedAddresses, assertSafeUrl } from './network-policy.mjs';

export async function safeFetch(rawUrl, options = {}) {
  const maxRedirects = options.maxRedirects ?? 5;
  const headers = new Headers(options.headers || {});
  headers.delete('cookie');
  headers.delete('authorization');
  let current = rawUrl;
  const redirects = [];
  for (let count = 0; count <= maxRedirects; count += 1) {
    const parsed = assertSafeUrl(current);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      const records = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
      assertSafeResolvedAddresses(records.map((record) => record.address));
    }
    const response = await fetch(current, { ...options, headers, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: current, redirects };
    const location = response.headers.get('location');
    if (!location) return { response, finalUrl: current, redirects };
    const next = new URL(location, current).toString();
    assertSafeUrl(next);
    redirects.push({ from: current, to: next, status: response.status });
    current = next;
  }
  throw new Error(`Too many redirects (>${maxRedirects})`);
}
