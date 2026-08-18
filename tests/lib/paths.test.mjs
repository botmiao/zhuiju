import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { resolveDataRoot, assertSubscriptionId } from '../../scripts/lib/paths.mjs';

test('resolves the data root under ~/.zhuiju by default on every platform', () => {
  assert.equal(resolveDataRoot({}, 'win32'), path.join(os.homedir(), '.zhuiju'));
  assert.equal(resolveDataRoot({}, 'darwin'), path.join(os.homedir(), '.zhuiju'));
  assert.equal(resolveDataRoot({}, 'linux'), path.join(os.homedir(), '.zhuiju'));
});

test('ZHUIJU_HOME always wins over the default location', () => {
  assert.equal(resolveDataRoot({ ZHUIJU_HOME: 'D:\\data\\zhuiju' }, 'win32'), path.resolve('D:\\data\\zhuiju'));
});

test('rejects subscription ids that could traverse paths', () => {
  assert.throws(() => assertSubscriptionId('../../etc'), /Invalid subscription id/);
  assert.throws(() => assertSubscriptionId('sub_../../etc'), /Invalid subscription id/);
  assert.doesNotThrow(() => assertSubscriptionId('sub_abc-123'));
});
