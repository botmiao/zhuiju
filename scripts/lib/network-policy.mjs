import net from 'node:net';

function normalizeHost(hostname) {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase().split('%')[0];
}

function ipv4Parts(value) {
  if (net.isIP(value) !== 4) return null;
  const parts = value.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function isPrivateIpv4(value) {
  const [a, b] = ipv4Parts(value) || [];
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 198 && (b === 18 || b === 19) || a === 100 && b >= 64 && b <= 127 || a >= 224;
}

function parseIpv6Groups(host) {
  const trimmed = host.replace(/^\[|\]$/g, '');
  const doubleColon = trimmed.indexOf('::');
  const chunks = doubleColon === -1 ? [trimmed] : [trimmed.slice(0, doubleColon), trimmed.slice(doubleColon + 2)];
  const groups = [[], []];
  for (let part = 0; part < chunks.length; part += 1) {
    const pieces = chunks[part] ? chunks[part].split(':') : [];
    for (const piece of pieces) {
      if (piece.includes('.')) {
        const parts = ipv4Parts(piece);
        if (!parts) return null;
        groups[part].push((parts[0] << 8) | parts[1], (parts[2] << 8) | parts[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(piece)) return null;
        groups[part].push(Number.parseInt(piece, 16));
      }
    }
  }
  if (doubleColon === -1) {
    if (groups[0].length !== 8) return null;
    return groups[0];
  }
  const missing = 8 - groups[0].length - groups[1].length;
  if (missing < 1 || groups[1].length === 8) return null;
  return [...groups[0], ...Array(missing).fill(0), ...groups[1]];
}

function ipv4InGroups(groups, start) {
  return `${(groups[start] >> 8) & 0xff}.${groups[start] & 0xff}.${(groups[start + 1] >> 8) & 0xff}.${groups[start + 1] & 0xff}`;
}

function isPrivateIpv6(host) {
  const groups = parseIpv6Groups(normalizeHost(host));
  if (!groups) return true;
  const allZero = groups.every((group) => group === 0);
  if (allZero) return true;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true;
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) return isPrivateIpv4(ipv4InGroups(groups, 6));
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((group) => group === 0)) return isPrivateIpv4(ipv4InGroups(groups, 6));
  if ((groups[0] & 0xfff0) === 0x2002) return isPrivateIpv4(ipv4InGroups(groups, 1));
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  if ((groups[0] & 0xff00) === 0xff00) return true;
  return false;
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
