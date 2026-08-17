import { planSchedule } from './schedule-planner.mjs';
import { createSubscriptionStore } from '../stores/subscription-store.mjs';
import { createScheduleStore } from '../stores/schedule-store.mjs';

export async function syncSchedule(root, subscriptionId, adapter = null) {
  const subscription = await createSubscriptionStore(root).get(subscriptionId);
  const plan = planSchedule(subscription);
  let hostJobIds = [];
  let hostResult = null;
  if (adapter) {
    hostResult = await adapter.schedule(plan);
    if (hostResult.ok) hostJobIds = hostResult.data?.jobIds || [];
  }
  const schedule = {
    schemaVersion: 1,
    subscriptionId,
    timezone: plan.timezone,
    rule: subscription.releaseSchedule?.rule || {},
    triggerTimes: plan.triggers.map((trigger) => trigger.time),
    oneTimeTriggers: plan.oneTimeTriggers,
    suppressed: plan.suppressed,
    hostJobIds,
    updatedAt: new Date().toISOString()
  };
  await createScheduleStore(root).save(schedule);
  return { schedule, plan, hostResult };
}
