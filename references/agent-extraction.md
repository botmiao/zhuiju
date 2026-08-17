# Agent Extraction

The agent chooses the next observation-producing action dynamically. Do not force a fixed extraction pipeline.

```text
load task context → choose action → execute → record observation
→ extract observed candidates → submit through CLI → inspect result
→ continue or stop
```

Temporary scripts belong under the current task Trace workspace. They may parse ordinary page data, filter JSON, compare manifests, or inspect JavaScript. They may not read unrelated files, upload data, read browser credentials, become daemons, modify Skill source, or edit main JSON.

Stop when the episode is acquired, the budget is exhausted, no new evidence exists, the source is inaccessible within policy, or the authorized scope is insufficient. Historical successful sources are evidence, not permission to skip current observation.
