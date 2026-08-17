import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRanges, subtractRanges, latestMissing, rangeContains } from '../../scripts/lib/range-set.mjs';

test('normalizes overlapping and adjacent inclusive ranges', () => {
  assert.deepEqual(normalizeRanges([
    { from: 8, to: 8 },
    { from: 1, to: 3 },
    { from: 3, to: 5 },
    { from: 10, to: 9 }
  ]), [
    { from: 1, to: 5 },
    { from: 8, to: 8 }
  ]);
});

test('subtracts acquired ranges from released ranges', () => {
  assert.deepEqual(subtractRanges(
    [{ from: 1, to: 5 }, { from: 8, to: 10 }],
    [{ from: 2, to: 3 }, { from: 9, to: 9 }]
  ), [
    { from: 1, to: 1 },
    { from: 4, to: 5 },
    { from: 8, to: 8 },
    { from: 10, to: 10 }
  ]);
});

test('finds the latest missing episode and checks membership', () => {
  const missing = [{ from: 1, to: 1 }, { from: 4, to: 5 }];
  assert.equal(latestMissing(missing), 5);
  assert.equal(rangeContains(missing, 4), true);
  assert.equal(rangeContains(missing, 2), false);
});
