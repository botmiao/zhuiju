import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSchema } from '../../scripts/lib/schema.mjs';

test('accepts a valid minimal config', async () => {
  const config = {
    schemaVersion: 1,
    defaultTimezone: 'Asia/Shanghai',
    concurrency: {
      maximumActiveSubscriptions: 2,
      perSubscription: 1,
      onSubscriptionOverlap: 'coalesce',
      leaseTimeoutMinutes: 30
    },
    taskDefaults: {
      maximumDurationMinutes: 20,
      maximumPages: 15,
      maximumBrowserNavigations: 10,
      maximumCandidateUrls: 100
    },
    incremental: {
      target: 'latest-missing',
      maximumEpisodesPerRun: 1,
      includeHistoricalGaps: false
    },
    validation: {
      minimumAcquiredLevel: 'segment-valid',
      checkSegments: true,
      segmentSampleCount: 2,
      useFfprobe: false,
      revalidateOnUserRead: false
    },
    storage: {
      retainInvalidMediaUrls: true,
      retainExpiredMediaUrls: true,
      retainLogsDays: 90,
      retainTracesDays: 14,
      backupCount: 3
    },
    notifications: {
      notifyOnNewMedia: true,
      notifyOnBootstrapComplete: true,
      notifyOnAllMediaExpired: true,
      notifyOnTemporaryFailure: false
    }
  };

  assert.doesNotThrow(() => assertSchema('config', config));
});

test('rejects a config with the wrong schema version', () => {
  assert.throws(() => assertSchema('config', { schemaVersion: 9 }), /schema/i);
});
