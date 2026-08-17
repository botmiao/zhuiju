import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSubscriptionStore } from '../../scripts/stores/subscription-store.mjs';
import { createEpisodeStore } from '../../scripts/stores/episode-store.mjs';
import { createMediaStore } from '../../scripts/stores/media-store.mjs';

test('saves multiple media URLs, merges duplicate provenance, and marks acquired', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-media-'));
  const subscription = await createSubscriptionStore(root).add({
    title: 'Test',
    episodeProgress: {
      releaseCatalog: { releasedRanges: [{ from: 1, to: 1 }], state: 'confirmed', latestKnownEpisodeKey: 'main:1', checkedAt: new Date().toISOString(), evidence: [] },
      acquiredRanges: [], totalEpisodes: 1, totalEpisodesState: 'known'
    }
  });
  await createEpisodeStore(root).ensure(subscription.id, 'main:1', { sequence: 1, displayNumber: '1', title: 'Episode 1' });
  const validator = async (candidate) => ({
    schemaVersion: 1, id: 'media_test', url: candidate.url, normalizedKey: candidate.url.endsWith('/a.mp4') ? 'sha256:a' : 'sha256:b', sameResourceGroup: null,
    mediaType: 'mp4', availability: 'playable', accessRequirement: 'none', lifetimeState: 'active', validationLevel: 'segment-valid', variants: [],
    requestContext: {}, provenance: [{ type: 'page', url: candidate.observedFrom?.url || 'https://source.example', observationMethod: 'html-text', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), seenCount: 1 }],
    firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), lastValidatedAt: new Date().toISOString(), estimatedExpiresAt: null, seenCount: 1, note: null
  });
  const store = createMediaStore(root, { validator });
  await store.submit(subscription.id, 'main:1', { url: 'https://cdn.example/a.mp4', observedFrom: { type: 'page', url: 'https://source.example/a' } });
  await store.submit(subscription.id, 'main:1', { url: 'https://cdn.example/a.mp4', observedFrom: { type: 'page', url: 'https://source.example/b' } });
  await store.submit(subscription.id, 'main:1', { url: 'https://cdn.example/b.mp4', observedFrom: { type: 'page', url: 'https://source.example/c' } });
  const media = await store.list(subscription.id, 'main:1');
  assert.equal(media.length, 2);
  assert.equal(media[0].seenCount, 2);
  assert.equal((await createEpisodeStore(root).get(subscription.id, 'main:1')).acquisitionStatus, 'acquired');
});
