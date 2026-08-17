import { atomicWriteJson } from '../lib/atomic-file.mjs';
import { createId } from '../lib/ids.mjs';
import { episodePath } from '../lib/paths.mjs';
import { assertSchema } from '../lib/schema.mjs';
import { validateMediaCandidate } from '../validation/media-validator.mjs';
import { createEpisodeStore } from './episode-store.mjs';

const now = () => new Date().toISOString();

function mergeProvenance(existing, incoming) {
  const values = [...(existing || [])];
  for (const item of incoming || []) {
    const key = JSON.stringify([item.type, item.url, item.observationMethod, item.parentUrl]);
    const current = values.find((candidate) => JSON.stringify([candidate.type, candidate.url, candidate.observationMethod, candidate.parentUrl]) === key);
    if (current) current.seenCount = (current.seenCount || 1) + (item.seenCount || 1);
    else values.push({ ...item });
  }
  return values;
}

function isAcquirable(media, minimumLevel = 'segment-valid') {
  const levels = ['discovered', 'http-valid', 'manifest-valid', 'playlist-valid', 'segment-valid', 'decodable'];
  return media.availability === 'playable' && media.accessRequirement === 'none' && media.lifetimeState !== 'expired' && levels.indexOf(media.validationLevel) >= levels.indexOf(minimumLevel);
}

function withMediaId(media, id) {
  return {
    schemaVersion: 1,
    url: media.url,
    normalizedKey: media.normalizedKey,
    mediaType: media.mediaType || 'unknown',
    availability: media.availability || 'discovered',
    accessRequirement: media.accessRequirement || 'unknown',
    lifetimeState: media.lifetimeState || 'unknown',
    validationLevel: media.validationLevel || 'discovered',
    variants: media.variants || [],
    requestContext: media.requestContext || {},
    provenance: media.provenance || [],
    id,
    sameResourceGroup: media.sameResourceGroup ?? null,
    firstSeenAt: media.firstSeenAt || now(),
    lastSeenAt: now(),
    lastValidatedAt: media.lastValidatedAt || now(),
    estimatedExpiresAt: media.estimatedExpiresAt ?? null,
    seenCount: media.seenCount || 1,
    note: media.note ?? null
  };
}

export function createMediaStore(root, { validator = validateMediaCandidate, minimumAcquiredLevel = 'segment-valid' } = {}) {
  const episodes = createEpisodeStore(root);
  return {
    async submit(subscriptionId, episodeKey, candidate) {
      const episode = await episodes.get(subscriptionId, episodeKey);
      let validated;
      try {
        validated = await validator(candidate);
      } catch (error) {
        error.code ||= 'MEDIA_VALIDATION_FAILED';
        error.retryable ??= /timeout|network|HTTP 5\d\d|DNS/i.test(error.message);
        throw error;
      }
      const nextMedia = withMediaId(validated, validated.id || createId('media'));
      const existing = episode.mediaUrls.find((media) => media.normalizedKey === nextMedia.normalizedKey);
      const merged = existing ? {
        ...existing,
        ...nextMedia,
        id: existing.id,
        firstSeenAt: existing.firstSeenAt,
        seenCount: existing.seenCount + 1,
        provenance: mergeProvenance(existing.provenance, nextMedia.provenance)
      } : nextMedia;
      assertSchema('media-url', merged);
      const nextEpisode = { ...episode, mediaUrls: [...episode.mediaUrls.filter((media) => media.id !== existing?.id), merged], acquisitionStatus: isAcquirable(merged, minimumAcquiredLevel) ? 'acquired' : episode.acquisitionStatus, updatedAt: now() };
      assertSchema('episode', nextEpisode);
      await atomicWriteJson(episodePath(root, subscriptionId, episodeKey), nextEpisode);
      if (isAcquirable(merged, minimumAcquiredLevel)) await episodes.markAcquired(subscriptionId, episodeKey);
      return merged;
    },
    async list(subscriptionId, episodeKey) { return (await episodes.get(subscriptionId, episodeKey)).mediaUrls; },
    async validate(subscriptionId, episodeKey) {
      const episode = await episodes.get(subscriptionId, episodeKey);
      const validated = [];
      for (const media of episode.mediaUrls) {
        try {
          const next = withMediaId(await validator({ url: media.url, requestContext: media.requestContext }), media.id);
          validated.push({ ...media, ...next, id: media.id, provenance: media.provenance, seenCount: media.seenCount });
        } catch (error) {
          validated.push({ ...media, availability: 'invalid', lifetimeState: 'possibly-expired', lastValidatedAt: now(), note: error.message });
        }
      }
      const nextEpisode = { ...episode, mediaUrls: validated, acquisitionStatus: validated.some((media) => isAcquirable(media, minimumAcquiredLevel)) ? 'acquired' : 'failed', updatedAt: now() };
      assertSchema('episode', nextEpisode);
      await atomicWriteJson(episodePath(root, subscriptionId, episodeKey), nextEpisode);
      return validated;
    },
    async history(mediaId) {
      const subscriptionStore = (await import('./subscription-store.mjs')).createSubscriptionStore(root);
      const results = [];
      for (const subscription of await subscriptionStore.list()) {
        for (const episode of await episodes.list(subscription.id)) {
          for (const media of episode.mediaUrls) if (media.id === mediaId) results.push({ subscriptionId: subscription.id, episodeKey: episode.episodeKey, media });
        }
      }
      return results;
    }
  };
}
