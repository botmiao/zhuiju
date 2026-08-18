import { readJsonFile } from './atomic-file.mjs';
import { dataPaths } from './paths.mjs';
import { assertSchema } from './schema.mjs';

export const defaultConfig = {
  schemaVersion: 2,
  defaultTimezone: 'UTC',
  concurrency: { maximumActiveSubscriptions: 2, perSubscription: 1, onSubscriptionOverlap: 'coalesce', leaseTimeoutMinutes: 30 },
  taskDefaults: { maximumDurationMinutes: 30, maximumPages: 50, maximumBrowserNavigations: 20, maximumCandidateUrls: 20 },
  incremental: { target: 'latest-missing', maximumEpisodesPerRun: 1, includeHistoricalGaps: false },
  validation: { minimumAcquiredLevel: 'http-valid', checkSegments: true, segmentSampleCount: 2, useFfprobe: true, revalidateOnUserRead: false },
  storage: { retainInvalidMediaUrls: true, retainExpiredMediaUrls: true, retainLogsDays: 30, retainTracesDays: 90, backupCount: 3 },
  notifications: { notifyOnNewMedia: true, notifyOnBootstrapComplete: true, notifyOnAllMediaExpired: true, notifyOnTemporaryFailure: false }
};

export async function loadConfig(root) {
  let stored = {};
  try {
    stored = await readJsonFile(dataPaths(root).config);
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(defaultConfig);
    if (error instanceof SyntaxError) throw new Error(`config.json is not valid JSON: ${error.message}`);
    throw error;
  }
  const merged = structuredClone(defaultConfig);
  for (const [key, value] of Object.entries(stored)) {
    const current = merged[key];
    merged[key] = value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)
      ? { ...current, ...value }
      : value;
  }
  assertSchema('config', merged);
  return merged;
}
