import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSubscriptionStore } from '../../scripts/stores/subscription-store.mjs';
import { createEpisodeStore } from '../../scripts/stores/episode-store.mjs';

test('creates a subscription and computes missing episodes from ranges', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-store-'));
  const subscriptions = createSubscriptionStore(root);
  const episodes = createEpisodeStore(root);
  const subscription = await subscriptions.add({
    title: '仙逆',
    slug: 'xian-ni',
    episodeProgress: {
      totalEpisodes: null,
      totalEpisodesState: 'not-announced',
      releaseCatalog: {
        latestKnownEpisodeKey: 'main:5',
        releasedRanges: [{ from: 1, to: 5 }],
        state: 'confirmed',
        checkedAt: new Date().toISOString(),
        evidence: []
      },
      acquiredRanges: [{ from: 1, to: 3 }]
    }
  });

  assert.match(subscription.id, /^sub_/);
  assert.equal((await subscriptions.list()).length, 1);
  await episodes.ensure(subscription.id, 'main:4', { sequence: 4, displayNumber: '4', title: '第 4 集' });
  await episodes.ensure(subscription.id, 'main:5', { sequence: 5, displayNumber: '5', title: '第 5 集' });
  assert.deepEqual(await episodes.missing(subscription.id), [4, 5]);
  await assert.rejects(() => episodes.markAcquired(subscription.id, 'main:4'), (error) => error.code === 'MEDIA_NOT_VALIDATED');
});
