import { createId } from '../lib/ids.mjs';
import { expandRanges, normalizeRanges, subtractRanges } from '../lib/range-set.mjs';

function blockedByException(subscription, sequence) {
  return (subscription.exceptions || []).some((exception) => exception.expectedEpisodeKey === `main:${sequence}` && ['skip', 'cancelled'].includes(exception.type));
}

export function selectTargets(subscription, mode, { episodeKeys = [] } = {}) {
  if (mode === 'manual') return episodeKeys;
  if (mode === 'validate') return episodeKeys;
  const missing = expandRanges(subtractRanges(
    subscription.episodeProgress.releaseCatalog.releasedRanges,
    subscription.episodeProgress.acquiredRanges
  )).filter((sequence) => !blockedByException(subscription, sequence)).sort((a, b) => b - a);
  const selected = mode === 'incremental' ? missing.slice(0, subscription.incrementalPolicy?.maximumEpisodesPerRun || 1) : missing;
  return selected.map((sequence) => `main:${sequence}`);
}

export function createTaskState(subscription, mode, trigger = 'manual', overrides = {}) {
  const targets = selectTargets(subscription, mode, { episodeKeys: overrides.episodeKeys || [] });
  const budgetOverrides = overrides.budget || {
    maximumDurationMinutes: overrides.maximumDurationMinutes,
    maximumPages: overrides.maximumPages,
    maximumBrowserNavigations: overrides.maximumBrowserNavigations,
    maximumCandidateUrls: overrides.maximumCandidateUrls
  };
  return {
    schemaVersion: 1,
    id: overrides.id || createId('task'),
    subscriptionId: subscription.id,
    status: 'queued',
    mode,
    trigger,
    reasons: overrides.reasons || [],
    currentEpisodeKey: targets[0] || null,
    phase: 'selecting-target',
    startedAt: null,
    heartbeatAt: null,
    rerunRequested: false,
    budget: {
      maximumDurationMinutes: 20,
      maximumPages: 15,
      maximumBrowserNavigations: 10,
      maximumCandidateUrls: 100,
      ...Object.fromEntries(Object.entries(budgetOverrides).filter(([, value]) => value !== undefined))
    },
    progress: { completedEpisodes: [], pendingEpisodes: targets },
    lastError: null
  };
}

export function transitionTask(task, patch) {
  return { ...task, ...patch, heartbeatAt: new Date().toISOString() };
}
