import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBrowserRequest } from '../../scripts/browser-helper.mjs';

test('browser request guard accepts public requests and rejects local targets', () => {
  assert.equal(inspectBrowserRequest({ url: 'https://media.example/video.m3u8', resourceType: 'media' }).allowed, true);
  assert.throws(() => inspectBrowserRequest({ url: 'http://127.0.0.1/private', resourceType: 'xhr' }), /unsafe|private|local/i);
});
