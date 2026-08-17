import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson, readJsonFile } from '../lib/atomic-file.mjs';
import { episodePath, subscriptionPaths } from '../lib/paths.mjs';
import { expandRanges, normalizeRanges, subtractRanges } from '../lib/range-set.mjs';
import { assertSchema } from '../lib/schema.mjs';
import { createSubscriptionStore } from './subscription-store.mjs';

const now = () => new Date().toISOString();

function defaultEpisode(episodeKey, input = {}) {
  const timestamp = now();
  const sequence = input.sequence ?? (Number(episodeKey.match(/(?:^|:)(\d+)$/)?.[1] || 0) || null);
  const kind = input.kind || episodeKey.split(':')[0] || 'main';
  return {
    schemaVersion: 1,
    episodeKey,
    sequence,
    displayNumber: input.displayNumber || String(sequence ?? episodeKey),
    kind,
    title: input.title || `第 ${input.displayNumber || sequence || episodeKey} 集`,
    releaseAt: input.releaseAt ?? null,
    releaseStatus: input.releaseStatus || 'unknown',
    acquisitionStatus: input.acquisitionStatus || 'pending',
    mediaUrls: input.mediaUrls || [],
    notes: input.notes || [],
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp
  };
}

export function createEpisodeStore(root) {
  return {
    async ensure(subscriptionId, episodeKey, input = {}) {
      const location = episodePath(root, subscriptionId, episodeKey);
      await fs.mkdir(path.dirname(location), { recursive: true });
      let episode;
      try { episode = await readJsonFile(location); } catch (error) { if (error.code !== 'ENOENT') throw error; episode = defaultEpisode(episodeKey, input); }
      if (episode !== undefined && input && Object.keys(input).length > 0 && episode.createdAt) episode = { ...episode, ...input, updatedAt: now() };
      assertSchema('episode', episode);
      await atomicWriteJson(location, episode);
      return episode;
    },
    async get(subscriptionId, episodeKey) { return readJsonFile(episodePath(root, subscriptionId, episodeKey)); },
    async list(subscriptionId) {
      const directory = subscriptionPaths(root, subscriptionId).episodes;
      let entries = [];
      try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const episodes = [];
      for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith('.json'))) episodes.push(await readJsonFile(path.join(directory, entry.name)));
      return episodes.sort((a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER));
    },
    async missing(subscriptionId) {
      const subscription = await createSubscriptionStore(root).get(subscriptionId);
      return expandRanges(subtractRanges(
        subscription.episodeProgress.releaseCatalog.releasedRanges,
        subscription.episodeProgress.acquiredRanges
      ));
    },
    async markAcquired(subscriptionId, episodeKey) {
      const episode = await this.get(subscriptionId, episodeKey);
      const sequence = episode.sequence;
      const levels = ['discovered', 'http-valid', 'manifest-valid', 'playlist-valid', 'segment-valid', 'decodable'];
      const minimumLevel = 'segment-valid';
      const usable = episode.mediaUrls.some((media) => media.availability === 'playable' && media.accessRequirement === 'none' && media.lifetimeState !== 'expired' && levels.indexOf(media.validationLevel) >= levels.indexOf(minimumLevel));
      if (!usable) {
        const error = new Error('Episode has no Media URL at the minimum acquired validation level');
        error.code = 'MEDIA_NOT_VALIDATED';
        throw error;
      }
      const subscriptionStore = createSubscriptionStore(root);
      const subscription = await subscriptionStore.get(subscriptionId);
      const acquiredRanges = sequence ? normalizeRanges([...subscription.episodeProgress.acquiredRanges, { from: sequence, to: sequence }]) : subscription.episodeProgress.acquiredRanges;
      const updatedEpisode = { ...episode, acquisitionStatus: 'acquired', updatedAt: now() };
      assertSchema('episode', updatedEpisode);
      await atomicWriteJson(episodePath(root, subscriptionId, episodeKey), updatedEpisode);
      await subscriptionStore.update(subscriptionId, { episodeProgress: { acquiredRanges } });
      return updatedEpisode;
    }
  };
}
