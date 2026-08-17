import test from 'node:test';
import assert from 'node:assert/strict';
import { GenericLocalRuntimeAdapter } from '../../scripts/runtime/generic-runtime.mjs';
import { OpenClawRuntimeAdapter } from '../../scripts/runtime/openclaw-runtime.mjs';

test('generic adapter reports unsupported host operations instead of pretending', async () => {
  const adapter = new GenericLocalRuntimeAdapter({ runtime: 'generic-local-agent', capabilities: { terminal: true, http: true, webSearch: false, browser: false, scheduler: false, notification: false } });
  assert.equal((await adapter.schedule({})).code, 'UNSUPPORTED_CAPABILITY');
  assert.equal((await adapter.getRuntimeInfo()).runtime, 'generic-local-agent');
});

test('OpenClaw adapter does not invent an API when no bridge is configured', async () => {
  const adapter = new OpenClawRuntimeAdapter({ runtime: 'openclaw', capabilities: { scheduler: false } });
  assert.equal((await adapter.schedule({})).code, 'UNSUPPORTED_CAPABILITY');
});
