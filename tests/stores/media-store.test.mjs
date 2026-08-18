import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createSubscriptionStore } from '../../scripts/stores/subscription-store.mjs';
import { createEpisodeStore } from '../../scripts/stores/episode-store.mjs';
import { createMediaStore } from '../../scripts/stores/media-store.mjs';
import { validateMediaCandidate } from '../../scripts/validation/media-validator.mjs';

test('update refuses to patch immutable identity fields', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-sub-'));
  const store = createSubscriptionStore(root);
  const added = await store.add({ title: 'Immutable' });
  const updated = await store.update(added.id, { id: 'sub_evil', createdAt: '1999-01-01T00:00:00.000Z', schemaVersion: 99, status: 'paused' });
  assert.equal(updated.id, added.id);
  assert.equal(updated.createdAt, added.createdAt);
  assert.equal(updated.schemaVersion, added.schemaVersion);
  assert.equal(updated.status, 'paused');
});

test('a failed revalidation releases the episode from acquiredRanges', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-media-'));
  const server = http.createServer((request, response) => {
    response.writeHead(206, { 'content-type': 'video/mp4', 'content-range': 'bytes 0-7/100', 'content-length': '8' });
    response.end(Buffer.from([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const subscription = await createSubscriptionStore(root).add({
    title: 'Expiry Test',
    episodeProgress: {
      releaseCatalog: { releasedRanges: [{ from: 1, to: 1 }], state: 'confirmed', latestKnownEpisodeKey: 'main:1', checkedAt: new Date().toISOString(), evidence: [] },
      acquiredRanges: [], totalEpisodes: 1, totalEpisodesState: 'known'
    }
  });
  await createEpisodeStore(root).ensure(subscription.id, 'main:1', { sequence: 1, displayNumber: '1', title: 'Episode 1' });
  const workingFetcher = (url, options) => fetch(url, { ...options, redirect: 'manual' });
  const store = createMediaStore(root, { validator: (candidate) => validateMediaCandidate(candidate, { fetcher: workingFetcher }) });
  await store.submit(subscription.id, 'main:1', { url: `${base}/video.mp4`, observedFrom: { type: 'page', url: `${base}/page` } });
  assert.deepEqual((await createSubscriptionStore(root).get(subscription.id)).episodeProgress.acquiredRanges, [{ from: 1, to: 1 }]);
  const failingStore = createMediaStore(root, { validator: async () => { throw new Error('HTTP 410 Gone'); } });
  await failingStore.validate(subscription.id, 'main:1');
  const after = await createSubscriptionStore(root).get(subscription.id);
  assert.deepEqual(after.episodeProgress.acquiredRanges, []);
  assert.deepEqual(await createEpisodeStore(root).missing(subscription.id), [1]);
});

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

test('a real MP4 candidate reaches acquired at the default minimum level', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuiju-media-'));
  const server = http.createServer((request, response) => {
    response.writeHead(206, { 'content-type': 'video/mp4', 'content-range': 'bytes 0-7/100', 'content-length': '8' });
    response.end(Buffer.from([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const subscription = await createSubscriptionStore(root).add({
    title: 'MP4 Test',
    episodeProgress: {
      releaseCatalog: { releasedRanges: [{ from: 1, to: 1 }], state: 'confirmed', latestKnownEpisodeKey: 'main:1', checkedAt: new Date().toISOString(), evidence: [] },
      acquiredRanges: [], totalEpisodes: 1, totalEpisodesState: 'known'
    }
  });
  await createEpisodeStore(root).ensure(subscription.id, 'main:1', { sequence: 1, displayNumber: '1', title: 'Episode 1' });
  const store = createMediaStore(root, { validator: (candidate) => validateMediaCandidate(candidate, { fetcher: (url, options) => fetch(url, { ...options, redirect: 'manual' }) }) });
  await store.submit(subscription.id, 'main:1', { url: `${base}/video.mp4`, observedFrom: { type: 'page', url: `${base}/page` } });
  const episode = await createEpisodeStore(root).get(subscription.id, 'main:1');
  assert.equal(episode.acquisitionStatus, 'acquired');
  const updated = await createSubscriptionStore(root).get(subscription.id);
  assert.deepEqual(updated.episodeProgress.acquiredRanges, [{ from: 1, to: 1 }]);
});
