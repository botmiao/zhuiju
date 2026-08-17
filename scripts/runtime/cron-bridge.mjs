import { buildCronInvocation } from './schedule-planner.mjs';

export function buildCronBridge(subscriptionId, mode = 'incremental') {
  return {
    command: buildCronInvocation(subscriptionId, mode),
    purpose: 'enqueue-only',
    executesExtraction: false
  };
}
