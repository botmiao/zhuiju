# OpenClaw Adapter

The adapter detects capabilities and uses an installed host command or explicit bridge configuration. It never invents an undocumented API. When scheduling is unavailable, local schedule state is preserved and `schedule sync` returns a structured capability failure.

Cron triggers only:

```text
node scripts/cli.mjs task enqueue --subscription <id> --mode incremental --trigger cron
```

Multiple trigger times may map to multiple host triggers, but all enqueue the same logical subscription task. Host Job IDs are stored locally for reconciliation. Skip, delay, reschedule, cancelled, and special exceptions are evaluated before extraction.
