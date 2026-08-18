# Schedule Timing

The official release time is not the time content becomes findable. Never schedule the first check at the official time alone.

## Release vs findable time

Some titles offer an advance screening (超前点映) hours before the official slot. Example: official slot Sunday 24:00 (= Monday 00:00), advance screening from Sunday 18:00. Third-party platforms typically index it 30–60 minutes after the screening starts (around 18:30–19:00 in the example).

When creating or updating a subscription, ask whether an advance screening exists and when it starts. If unknown, treat the official time as the earliest availability and say so.

## Choosing trigger times

Derive `triggerTimes` from the earliest realistic availability, not the official time:

1. First trigger ≈ earliest availability + about 1 hour (screening 18:00 → first check ~19:00).
2. Add one or two staggered rechecks to absorb propagation variance (for example 19:40).
3. Keep one fallback trigger shortly after the official time (for example Monday 00:05) for weeks without a screening.

Repeated triggers are safe: cron only enqueues, duplicate triggers coalesce into one logical task, and a running task sets `rerunRequested` instead of starting a second run.

## Date-boundary and timezone traps

"Sunday 24:00" belongs to Monday 00:00. When a slot crosses midnight, set the trigger time and `dayOfWeek` for the next day, and confirm the timezone with the user before writing `releaseSchedule.timezone`. `triggerTimes` is the authoritative trigger source; the official time is recorded in notes when relevant.
