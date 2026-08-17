import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson } from '../lib/atomic-file.mjs';
import { migrateSubscriptionV1ToV2 } from '../../migrations/subscription-v1-to-v2.mjs';
import { migrateEpisodeV1ToV2 } from '../../migrations/episode-v1-to-v2.mjs';
import { migrateMediaV1ToV2 } from '../../migrations/media-v1-to-v2.mjs';

export async function runMigrations(root) {
  const summary = { root, migrated: 0, skipped: 0, errors: [] };
  const subscriptionRoot = path.join(root, 'subscriptions');
  let entries = [];
  try { entries = await fs.readdir(subscriptionRoot, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return summary; throw error; }
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const filename = path.join(subscriptionRoot, entry.name, 'subscription.json');
    try {
      const value = JSON.parse(await fs.readFile(filename, 'utf8'));
      if (value.schemaVersion === 1) {
        await atomicWriteJson(filename, migrateSubscriptionV1ToV2(value));
        summary.migrated += 1;
      } else summary.skipped += 1;
      const episodesDirectory = path.join(subscriptionRoot, entry.name, 'episodes');
      let episodes = [];
      try { episodes = await fs.readdir(episodesDirectory, { withFileTypes: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      for (const episode of episodes.filter((item) => item.isFile() && item.name.endsWith('.json'))) {
        const episodeFilename = path.join(episodesDirectory, episode.name);
        const episodeValue = JSON.parse(await fs.readFile(episodeFilename, 'utf8'));
        if (episodeValue.schemaVersion === 1) {
          const migratedEpisode = migrateEpisodeV1ToV2(episodeValue);
          migratedEpisode.mediaUrls = (migratedEpisode.mediaUrls || []).map((media) => media.schemaVersion === 1 ? migrateMediaV1ToV2(media) : media);
          await atomicWriteJson(episodeFilename, migratedEpisode);
          summary.migrated += 1;
        }
      }
    } catch (error) { summary.errors.push({ file: filename, message: error.message }); }
  }
  return summary;
}
