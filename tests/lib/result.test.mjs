import test from 'node:test';
import assert from 'node:assert/strict';
import { ok, fail } from '../../scripts/lib/result.mjs';

test('ok returns the canonical success shape', () => {
  assert.deepEqual(ok({ id: 'x' }), {
    ok: true,
    code: 'OK',
    message: null,
    retryable: false,
    data: { id: 'x' },
    warnings: []
  });
});

test('fail returns the canonical failure shape', () => {
  assert.deepEqual(fail('BAD_INPUT', 'bad', true, { field: 'url' }, ['hint']), {
    ok: false,
    code: 'BAD_INPUT',
    message: 'bad',
    retryable: true,
    data: { field: 'url' },
    warnings: ['hint']
  });
});
