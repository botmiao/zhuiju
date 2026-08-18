import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson, readJsonFile } from '../lib/atomic-file.mjs';
import { createId } from '../lib/ids.mjs';
import { subscriptionPaths } from '../lib/paths.mjs';
import { normalizeRanges, subtractRanges } from '../lib/range-set.mjs';
import { assertSchema } from '../lib/schema.mjs';

const now = () => new Date().toISOString();

function defaultSubscription(input) {
  const timestamp = now();
  const title = input.title || input.slug || '未命名订阅';
  const slug = input.slug || title.toLowerCase().replaceAll(/[^a-z0-9一-龥]+/g, '-').replaceAll(/^-|-$/g, '') || 'subscription';
  const progress = input.episodeProgress || {};
  const catalog = progress.releaseCatalog || {};
  return {
    schemaVersion: 1,
    id: input.id || createId('sub'),
    slug,
    title,
    aliases: input.aliases || [],
    contentType: input.contentType || 'unknown',
    status: input.status || 'airing',
    enabled: input.enabled ?? true,
    episodeProgress: {
      totalEpisodes: progress.totalEpisodes ?? null,
      totalEpisodesState: progress.totalEpisodesState || 'not-announced',
      releaseCatalog: {
        latestKnownEpisodeKey: catalog.latestKnownEpisodeKey || null,
        releasedRanges: normalizeRanges(catalog.releasedRanges || []),
        state: catalog.state || 'never-checked',
        checkedAt: catalog.checkedAt || null,
        evidence: catalog.evidence || []
      },
      acquiredRanges: normalizeRanges(progress.acquiredRanges || [])
    },
    releaseSchedule: input.releaseSchedule || {
      timezone: 'UTC',
      rule: { dayOfWeek: null },
      triggerTimes: []
    },
    sourcePolicy: input.sourcePolicy || {
      mode: 'agent-planned', specifiedSources: [], preferredDomains: [], blockedDomains: []
    },
    incrementalPolicy: input.incrementalPolicy || {
      target: 'latest-missing', maximumEpisodesPerRun: 1, includeHistoricalGaps: false
    },
    exceptions: input.exceptions || [],
    notes: input.notes || [],
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp
  };
}

export function createSubscriptionStore(root) {
  return {
    async add(input) {
      const subscription = defaultSubscription(input);
      const location = subscriptionPaths(root, subscription.id);
      await fs.mkdir(location.episodes, { recursive: true });
      try { await fs.access(location.subscription); throw new Error(`Subscription already exists: ${subscription.id}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      assertSchema('subscription', subscription);
      await atomicWriteJson(location.subscription, subscription);
      return subscription;
    },
    async get(id) {
      return readJsonFile(subscriptionPaths(root, id).subscription);
    },
    async list() {
      let entries = [];
      try { entries = await fs.readdir(path.join(root, 'subscriptions'), { withFileTypes: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const values = [];
      for (const entry of entries.filter((item) => item.isDirectory())) {
        try { values.push(await this.get(entry.name)); } catch { /* broken records are reported by doctor */ }
      }
      return values.sort((a, b) => a.title.localeCompare(b.title));
    },
    async update(id, patch) {
      const { id: _ignoredId, createdAt: _ignoredCreatedAt, schemaVersion: _ignoredSchemaVersion, ...safePatch } = patch || {};
      const current = await this.get(id);
      const next = {
        ...current,
        ...safePatch,
        episodeProgress: safePatch.episodeProgress ? {
          ...current.episodeProgress,
          ...safePatch.episodeProgress,
          releaseCatalog: safePatch.episodeProgress.releaseCatalog ? {
            ...current.episodeProgress.releaseCatalog,
            ...safePatch.episodeProgress.releaseCatalog
          } : current.episodeProgress.releaseCatalog
        } : current.episodeProgress,
        updatedAt: now()
      };
      next.episodeProgress.acquiredRanges = normalizeRanges(next.episodeProgress.acquiredRanges);
      next.episodeProgress.releaseCatalog.releasedRanges = normalizeRanges(next.episodeProgress.releaseCatalog.releasedRanges);
      assertSchema('subscription', next);
      await atomicWriteJson(subscriptionPaths(root, id).subscription, next);
      return next;
    },
    async releaseAcquired(id, sequence) {
      const current = await this.get(id);
      const acquiredRanges = Number.isInteger(sequence)
        ? subtractRanges(current.episodeProgress.acquiredRanges, [{ from: sequence, to: sequence }])
        : current.episodeProgress.acquiredRanges;
      return this.update(id, { episodeProgress: { acquiredRanges } });
    },
    pause(id) { return this.update(id, { status: 'paused', enabled: false }); },
    resume(id, status = 'airing') { return this.update(id, { status, enabled: true }); },
    async remove(id) {
      await fs.rm(subscriptionPaths(root, id).base, { recursive: true, force: true });
      return { id, removed: true };
    }
  };
}
