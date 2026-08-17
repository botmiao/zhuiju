import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../../scripts/lib/url-normalizer.mjs';

test('normalizes host, default port, and fragment without dropping signatures', () => {
  const result = normalizeUrl('HTTPS://Example.COM:443/video/master.m3u8?sig=abc&expires=10#player');
  assert.equal(result.url, 'https://example.com/video/master.m3u8?sig=abc&expires=10');
  assert.match(result.normalizedKey, /^sha256:/);
});

test('keeps non-default ports and unknown query parameters', () => {
  assert.equal(normalizeUrl('http://Example.com:8080/a?token=x').url, 'http://example.com:8080/a?token=x');
});
