import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeUrl } from '../../scripts/lib/network-policy.mjs';

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
