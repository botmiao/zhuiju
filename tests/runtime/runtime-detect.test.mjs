import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCapabilities } from '../../scripts/runtime/runtime-detect.mjs';

test('detects explicit generic runtime capabilities', async () => {
  const capabilities = await detectCapabilities({
    ZHUIJU_RUNTIME: 'generic-local-agent',
    ZHUIJU_TERMINAL: 'true',
    ZHUIJU_HTTP: 'true',
    ZHUIJU_WEB_SEARCH: 'false',
    ZHUIJU_BROWSER: 'false',
    ZHUIJU_SCHEDULER: 'false',
    ZHUIJU_NOTIFICATION: 'false'
  }, async () => false);
  assert.equal(capabilities.runtime, 'generic-local-agent');
  assert.equal(capabilities.capabilities.terminal, true);
  assert.equal(capabilities.capabilities.webSearch, false);
});
