import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../cli.mjs', import.meta.url));

export function planSchedule(subscription) {
  const schedule = subscription.releaseSchedule || {};
  const exceptions = subscription.exceptions || [];
  const triggers = (subscription.enabled === false ? [] : (schedule.triggerTimes || [])).map((time) => ({
    time,
    timezone: schedule.timezone || 'UTC',
    dayOfWeek: schedule.rule?.dayOfWeek || null,
    command: buildCronInvocation(subscription.id, 'incremental')
  }));
  const oneTimeTriggers = exceptions.filter((exception) => ['delayed', 'rescheduled'].includes(exception.type) && exception.replacementReleaseAt).map((exception) => ({
    at: exception.replacementReleaseAt,
    episodeKey: exception.expectedEpisodeKey || null,
    command: buildCronInvocation(subscription.id, 'incremental')
  }));
  const suppressed = exceptions.filter((exception) => ['skip', 'cancelled'].includes(exception.type)).map((exception) => exception.date).filter(Boolean);
  return { logicalTask: 'incremental', subscriptionId: subscription.id, timezone: schedule.timezone || 'UTC', triggers, oneTimeTriggers, suppressed, exceptions };
}

export function buildCronInvocation(subscriptionId, mode = 'incremental') {
  return `"${process.execPath}" "${cliPath}" task enqueue --subscription ${subscriptionId} --mode ${mode} --trigger cron`;
}
