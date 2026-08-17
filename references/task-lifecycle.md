# Task Lifecycle

```text
idle → queued → running → completed
                    ├── failed
                    ├── paused
                    └── cancelled
```

Phases are `refreshing-catalog`, `selecting-target`, `searching`, `extracting`, `validating`, `persisting`, `notifying`, and `idle`.

One subscription has one `task.json`. Repeated Cron triggers coalesce reasons. A running task sets `rerunRequested`; it does not create another task. Global slots limit active subscriptions. Lease files contain subscription, task, PID, creation time, and heartbeat. Recovery uses atomically saved data and redacted append-only Trace observations.
