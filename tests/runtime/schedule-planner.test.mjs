import test from 'node:test';
import assert from 'node:assert/strict';
import { planSchedule, buildCronInvocation } from '../../scripts/runtime/schedule-planner.mjs';

test('plans multiple trigger times as one logical enqueue task', () => {
  const plan = planSchedule({ id: 'sub_test', enabled: true, releaseSchedule: { timezone: 'Asia/Shanghai', rule: { frequency: 'weekly', dayOfWeek: 'sunday' }, triggerTimes: ['18:25', '18:50'] }, exceptions: [] });
  assert.equal(plan.logicalTask, 'incremental');
  assert.deepEqual(plan.triggers.map((trigger) => trigger.time), ['18:25', '18:50']);
  assert.match(buildCronInvocation('sub_test', 'incremental'), /task enqueue/);
});

test('plans rescheduled releases as one-time enqueue triggers and keeps skip dates explicit', () => {
  const plan = planSchedule({ id: 'sub_test', enabled: true, releaseSchedule: { timezone: 'UTC', triggerTimes: ['18:25'] }, exceptions: [
    { date: '2026-08-09', type: 'skip' },
    { date: '2026-08-16', type: 'rescheduled', replacementReleaseAt: '2026-08-17T18:00:00Z', expectedEpisodeKey: 'main:2' }
  ] });
  assert.deepEqual(plan.suppressed, ['2026-08-09']);
  assert.equal(plan.oneTimeTriggers[0].episodeKey, 'main:2');
});

test('cron invocation uses absolute interpreter and script paths', () => {
  assert.match(buildCronInvocation('sub_test', 'incremental'), /^".+" ".+cli\.mjs" task enqueue --subscription sub_test --mode incremental --trigger cron$/);
});
