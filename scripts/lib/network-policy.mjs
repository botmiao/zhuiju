import net from 'node:net';

function normalizeHost(hostname) {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function ipv4Parts(value) {
  if (net.isIP(value) !== 4) return null;
  const parts = value.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function isPrivateIpv4(value) {
  const [a, b] = ipv4Parts(value) || [];
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 198 && (b === 18 || b === 19) || a >= 224;
}

function isPrivateIpv6(value) {
  const host = normalizeHost(value);
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')) return true;
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return Boolean(mapped && isPrivateIpv4(mapped[1]));
}

export function isUnsafeAddress(address) {
  return net.isIP(address) === 4 ? isPrivateIpv4(address) : net.isIP(address) === 6 && isPrivateIpv6(address);
}

export function assertSafeUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error('Unsafe URL: invalid URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Unsafe URL scheme: ${parsed.protocol}`);
  if (parsed.username || parsed.password) throw new Error('Unsafe URL: embedded credentials are not allowed');
  const host = normalizeHost(parsed.hostname);
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host === 'local') throw new Error('Unsafe URL: local hostname');
  if (isUnsafeAddress(host)) throw new Error('Unsafe URL: private or reserved address');
  return parsed;
}

export function assertSafeResolvedAddresses(addresses) {
  for (const address of addresses) if (isUnsafeAddress(address)) throw new Error(`Unsafe URL resolution: private or reserved address ${address}`);
  return true;
}
