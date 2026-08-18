import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeUrl, isUnsafeAddress } from '../../scripts/lib/network-policy.mjs';

test('rejects unsafe schemes and local/private targets', () => {
  for (const url of [
    'file:///C:/Users/private.txt',
    'http://localhost/video.m3u8',
    'http://127.0.0.1/video.m3u8',
    'http://10.0.0.1/video.m3u8',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/video.m3u8',
    'http://[fc00::1]/video.m3u8'
  ]) assert.throws(() => assertSafeUrl(url), /unsafe|private|local|scheme/i);
});

test('accepts public HTTP and HTTPS URLs', () => {
  assert.doesNotThrow(() => assertSafeUrl('https://media.example.com/video/master.m3u8'));
  assert.doesNotThrow(() => assertSafeUrl('http://media.example.com:8080/video.mp4'));
});

test('rejects private, reserved, and CGNAT IPv4 addresses', () => {
  for (const host of ['0.0.0.0', '10.0.0.1', '100.64.0.1', '100.127.255.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '198.18.0.1', '224.0.0.1']) {
    assert.equal(isUnsafeAddress(host), true, host);
    assert.throws(() => assertSafeUrl(`http://${host}/`), /Unsafe URL/, host);
  }
});

test('rejects IPv6 loopback, mapped, NAT64, link-local, and unique-local equivalents', () => {
  for (const host of ['::', '::1', '::ffff:7f00:1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::127.0.0.1', '64:ff9b::10.0.0.1', 'fe80::1', 'fe90::1', 'febf::1', 'fc00::1', 'fd12:3456::1']) {
    assert.equal(isUnsafeAddress(host), true, host);
    assert.throws(() => assertSafeUrl(`http://[${host}]/`), /Unsafe URL/, host);
  }
});

test('accepts public IPv4 and IPv6 addresses including public mapped forms', () => {
  for (const host of ['1.1.1.1', '8.8.8.8', '2606:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8']) {
    assert.equal(isUnsafeAddress(host), false, host);
    assert.doesNotThrow(() => assertSafeUrl(host.includes(':') ? `http://[${host}]/` : `http://${host}/`), host);
  }
});
