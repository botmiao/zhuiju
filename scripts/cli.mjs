import fs from 'node:fs/promises';
import { resolveDataRoot } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { fail, ok } from './lib/result.mjs';
import { createSubscriptionStore } from './stores/subscription-store.mjs';
import { createEpisodeStore } from './stores/episode-store.mjs';
import { createMediaStore } from './stores/media-store.mjs';
import { createTaskStore } from './stores/task-store.mjs';
import { createScheduleStore } from './stores/schedule-store.mjs';
import { enqueueSubscriptionTask, readQueueStatus } from './tasks/queue-manager.mjs';
import { updateTaskStatus, heartbeatSubscriptionTask } from './tasks/task-controller.mjs';
import { prepareSubscriptionRun, finishSubscriptionRun, failSubscriptionRun } from './tasks/subscription-runner.mjs';
import { appendObservation } from './tasks/trace-store.mjs';
import { validateMediaCandidate } from './validation/media-validator.mjs';
import { detectCapabilities } from './runtime/runtime-detect.mjs';
import { syncSchedule } from './runtime/schedule-sync.mjs';
import { OpenClawRuntimeAdapter } from './runtime/openclaw-runtime.mjs';
import { GenericLocalRuntimeAdapter } from './runtime/generic-runtime.mjs';
import { runDoctor } from './system/doctor.mjs';
import { runInit } from './system/init.mjs';
import { runMigrations } from './system/migrations.mjs';
import { usageFor } from './system/usage.mjs';

function runtimeAdapter(env = process.env) {
  return env.ZHUIJU_RUNTIME === 'openclaw' || env.OPENCLAW_RUNTIME || env.OPENCLAW_HOME
    ? new OpenClawRuntimeAdapter({})
    : new GenericLocalRuntimeAdapter({});
}

function flags(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token.startsWith('--')) {
      const next = args[index + 1];
      if (next === undefined || next.startsWith('--')) result[token.slice(2)] = true;
      else { result[token.slice(2)] = next; index += 1; }
    } else (result._ ||= []).push(token);
  }
  return result;
}

async function inputFile(filename) {
  if (!filename) return {};
  return JSON.parse(await fs.readFile(filename, 'utf8'));
}

async function runCommand(argv, root) {
  const [group, action, ...rest] = argv;
  const options = flags(rest);
  if (!group || group === 'help' || group === '--help' || group === '-h') return ok({ usage: usageFor() });
  if (action === 'help' || action === '--help' || options.help === true) return ok({ usage: usageFor(group) });
  if (group === 'doctor') return ok(await runDoctor(root));
  if (group === 'init') {
    const { warnings = [], ...data } = await runInit(root);
    return ok(data, warnings);
  }
  if (group === 'migrate') return ok(await runMigrations(root));
  const config = await loadConfig(root);
  const subscriptions = createSubscriptionStore(root);
  const episodes = createEpisodeStore(root, { minimumAcquiredLevel: config.validation.minimumAcquiredLevel });
  const media = createMediaStore(root, {
    minimumAcquiredLevel: config.validation.minimumAcquiredLevel,
    validator: (candidate) => validateMediaCandidate(candidate, { segmentSampleCount: config.validation.segmentSampleCount, useFfprobe: config.validation.useFfprobe })
  });
  if (group === 'subscription') {
    if (action === 'add') return ok(await subscriptions.add(await inputFile(options.input)));
    if (action === 'get') return ok(await subscriptions.get(options._?.[0]));
    if (action === 'list') return ok(await subscriptions.list());
    if (action === 'update') return ok(await subscriptions.update(options._?.[0], await inputFile(options.input)));
    if (action === 'pause') return ok(await subscriptions.pause(options._?.[0]));
    if (action === 'resume') return ok(await subscriptions.resume(options._?.[0], options.status || 'airing'));
    if (action === 'remove') return ok(await subscriptions.remove(options._?.[0]));
  }
  if (group === 'episode') {
    const subscriptionId = options._?.[0];
    const episodeKey = options._?.[1];
    if (action === 'ensure') return ok(await episodes.ensure(subscriptionId, episodeKey, await inputFile(options.input)));
    if (action === 'get') return ok(await episodes.get(subscriptionId, episodeKey));
    if (action === 'list') return ok(await episodes.list(subscriptionId));
    if (action === 'missing') return ok(await episodes.missing(subscriptionId));
    if (action === 'latest-missing') return ok((await episodes.missing(subscriptionId)).at(-1) ?? null);
    if (action === 'mark-acquired') return ok(await episodes.markAcquired(subscriptionId, episodeKey));
  }
  if (group === 'media') {
    const subscriptionId = options.subscription;
    const episodeKey = options.episode;
    if (action === 'submit') return ok(await media.submit(subscriptionId, episodeKey, await inputFile(options.input)));
    if (action === 'list') return ok(await media.list(options._?.[0], options._?.[1]));
    if (action === 'validate') return ok(await media.validate(options._?.[0], options._?.[1]));
    if (action === 'history') return ok(await media.history(options._?.[0]));
  }
  if (group === 'task') {
    const subscriptionId = options.subscription || options._?.[0];
    if (action === 'enqueue') return ok(await enqueueSubscriptionTask(root, { subscriptionId, mode: options.mode || 'incremental', trigger: options.trigger || 'manual', reason: options.reason || options.trigger || 'manual' }));
    if (action === 'status') return ok(await createTaskStore(root).get(subscriptionId));
    if (action === 'run') {
      try {
        return ok(await prepareSubscriptionRun(root, subscriptionId, { maximumActiveSubscriptions: Number(options.maximumActiveSubscriptions || config.concurrency.maximumActiveSubscriptions) }));
      } catch (error) {
        await failSubscriptionRun(root, subscriptionId, error).catch(() => {});
        throw error;
      }
    }
    if (action === 'complete') return ok(await finishSubscriptionRun(root, subscriptionId, { source: 'cli' }));
    if (action === 'heartbeat') return ok(await heartbeatSubscriptionTask(root, subscriptionId));
    if (action === 'fail') return ok(await failSubscriptionRun(root, subscriptionId, { code: 'TASK_FAILED', message: options.message || 'task failed' }));
    if (action === 'observe') {
      const task = await createTaskStore(root).get(subscriptionId);
      return ok(await appendObservation(root, subscriptionId, task.id, await inputFile(options.input)));
    }
    if (['pause', 'resume', 'cancel'].includes(action)) return ok(await updateTaskStatus(root, subscriptionId, action === 'resume' ? 'queued' : action === 'pause' ? 'paused' : 'cancelled'));
    if (action === 'context') return ok({ task: await createTaskStore(root).get(subscriptionId), subscription: await subscriptions.get(subscriptionId), episodes: await episodes.list(subscriptionId) });
  }
  if (group === 'queue' && action === 'status') return ok(await readQueueStatus(root));
  if (group === 'runtime' && action === 'detect') return ok(await detectCapabilities());
  if (group === 'schedule') {
    const subscriptionId = options._?.[0] || options.subscription;
    if (action === 'sync') return ok(await syncSchedule(root, subscriptionId, runtimeAdapter()));
    if (action === 'show') return ok(await createScheduleStore(root).get(subscriptionId));
    if (action === 'remove') return ok(await createScheduleStore(root).remove(subscriptionId));
  }
  return fail('UNKNOWN_COMMAND', `Unknown command: ${argv.join(' ')}`);
}

export async function execute(argv, root = resolveDataRoot()) {
  try {
    return await runCommand(argv, root);
  } catch (error) {
    return fail(error.code || 'COMMAND_FAILED', error.message, Boolean(error.retryable));
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  execute(process.argv.slice(2)).then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.ok) process.exitCode = 1;
  });
}
