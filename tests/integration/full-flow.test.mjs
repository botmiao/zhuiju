import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startMediaFixture } from '../fixtures/server.mjs';
import { validateMediaCandidate } from '../../scripts/validation/media-validator.mjs';
import { createSubscriptionStore } from '../../scripts/stores/subscription-store.mjs';
import { createEpisodeStore } from '../../scripts/stores/episode-store.mjs';
import { createMediaStore } from '../../scripts/stores/media-store.mjs';
import { enqueueSubscriptionTask } from '../../scripts/tasks/queue-manager.mjs';

test('completes subscription, validation, persistence, and coalesced task flow', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-flow-'));
  const fixture = await startMediaFixture();
  t.after(() => fixture.server.close());
  const subscription = await createSubscriptionStore(root).add({
    title: 'Flow Test',
    episodeProgress: {
      totalEpisodes: null,
      totalEpisodesState: 'not-announced',
      releaseCatalog: { latestKnownEpisodeKey: 'main:2', releasedRanges: [{ from: 1, to: 2 }], state: 'confirmed', checkedAt: new Date().toISOString(), evidence: [] },
      acquiredRanges: [{ from: 1, to: 1 }]
    }
  });
  const episodes = createEpisodeStore(root);
  await episodes.ensure(subscription.id, 'main:2', { sequence: 2, displayNumber: '2', title: 'Episode 2' });
  assert.deepEqual(await episodes.missing(subscription.id), [2]);
  const media = createMediaStore(root, { validator: (candidate) => validateMediaCandidate(candidate, { fetcher: (url, options) => fetch(url, { ...options, redirect: 'manual' }), segmentSampleCount: 1, ffprobeRunner: async () => ({ status: 'unavailable' }) }) });
  await media.submit(subscription.id, 'main:2', { url: `${fixture.base}/master.m3u8`, observedFrom: { type: 'page', url: `${fixture.base}/page` }, observationMethod: 'html-attribute' });
  assert.deepEqual(await episodes.missing(subscription.id), []);
  const first = await enqueueSubscriptionTask(root, { subscriptionId: subscription.id, mode: 'incremental', trigger: 'cron', reason: '18:25' });
  const second = await enqueueSubscriptionTask(root, { subscriptionId: subscription.id, mode: 'incremental', trigger: 'cron', reason: '18:50' });
  assert.equal(first.task.id, second.task.id);
  assert.deepEqual(second.task.reasons, ['18:25', '18:50']);
});
