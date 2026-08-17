# zhuiju Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete local `zhuiju` Skill described by the attached design, including deterministic CLI operations, local persistence, media validation, task orchestration, runtime adapters, safety rules, and verification.

**Architecture:** Keep the current directory as the Skill package root. Put agent-facing behavior in `SKILL.md` and references, deterministic behavior in focused ESM modules under `scripts/`, and all runtime data under `ZHUIJU_HOME`. Build vertical slices so each domain capability has tests before the next layer depends on it.

**Tech Stack:** Node.js 20+ ESM, built-in `node:test`, built-in `fetch`/`http`/`dns`/`fs`, `ajv` for JSON Schema validation, and `fast-xml-parser` for DASH manifests.

## Global Constraints

- The package name is `zhuiju` and the current workspace is the package root.
- Data never lives in the installation directory; use `ZHUIJU_HOME` or platform defaults.
- All main-data writes are schema-validated and atomic; direct LLM edits are forbidden.
- All Media URLs must come from observed input and pass deterministic validation before `acquired` is set.
- Reject login bypass, CAPTCHA bypass, paywall bypass, DRM bypass, credential theft, URL guessing, and full-video downloads.
- Every initial URL, redirect, iframe, XHR/Fetch, media request, WebSocket target, and browser subresource must pass SSRF checks.
- One logical task per subscription; subscription-internal execution is serial; global concurrency is configurable.
- Cron only enqueues a task; it never performs extraction itself.
- CLI stdout is structured JSON with `ok`, `code`, `message`, `retryable`, `data`, and `warnings` fields.
- Every new behavior follows RED-GREEN-REFACTOR with a test that failed for the intended reason before implementation.

---

### Task 1: Package foundation, schemas, and test harness

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `schemas/config.schema.json`
- Create: `schemas/subscription.schema.json`
- Create: `schemas/episode.schema.json`
- Create: `schemas/media-url.schema.json`
- Create: `schemas/task-state.schema.json`
- Create: `schemas/queue-item.schema.json`
- Create: `schemas/schedule.schema.json`
- Create: `scripts/lib/result.mjs`
- Create: `scripts/lib/ids.mjs`
- Create: `scripts/lib/paths.mjs`
- Create: `scripts/lib/schema.mjs`
- Test: `tests/lib/schema.test.mjs`
- Test: `tests/lib/result.test.mjs`

**Interfaces:**
- `ok(data, warnings = [])` returns the canonical success result.
- `fail(code, message, retryable = false, data = {}, warnings = [])` returns the canonical failure result.
- `createId(prefix)` returns a non-empty stable identifier with the requested prefix.
- `resolveDataRoot(env = process.env, platform = process.platform)` resolves `ZHUIJU_HOME` first and otherwise the platform data directory.
- `loadSchema(name)` and `assertSchema(name, value)` validate JSON data through Ajv.

- [ ] **Step 1: Write failing schema and result tests.** Assert invalid subscription data fails, a valid minimal configuration passes, and result fields are stable.
- [ ] **Step 2: Run `npm test -- --test-name-pattern='schema|result'`.** Expected: FAIL because the package and modules do not exist.
- [ ] **Step 3: Add package metadata and minimal implementations.** Use ESM, Node 20 engine, `ajv`, and `fast-xml-parser`; set `npm test` to `node --test`.
- [ ] **Step 4: Run the focused tests.** Expected: PASS with zero failures.
- [ ] **Step 5: Add all seven schemas.** Encode enum values, required identifiers, version fields, range shapes, task phases, media validation fields, and schedule exceptions from the design.
- [ ] **Step 6: Run `npm install` and `npm test`.** Expected: dependency installation succeeds and the complete current test set passes.

### Task 2: Range sets, atomic persistence, locks, stores, and migrations

**Files:**
- Create: `scripts/lib/range-set.mjs`
- Create: `scripts/lib/atomic-file.mjs`
- Create: `scripts/lib/file-lock.mjs`
- Create: `scripts/lib/jsonl.mjs`
- Create: `scripts/stores/store-context.mjs`
- Create: `scripts/stores/subscription-store.mjs`
- Create: `scripts/stores/episode-store.mjs`
- Create: `scripts/stores/media-store.mjs`
- Create: `scripts/stores/task-store.mjs`
- Create: `scripts/stores/queue-store.mjs`
- Create: `scripts/stores/schedule-store.mjs`
- Create: `scripts/system/migrations.mjs`
- Create: `migrations/subscription-v1-to-v2.mjs`
- Create: `migrations/episode-v1-to-v2.mjs`
- Create: `migrations/media-v1-to-v2.mjs`
- Test: `tests/lib/range-set.test.mjs`
- Test: `tests/lib/atomic-file.test.mjs`
- Test: `tests/lib/file-lock.test.mjs`
- Test: `tests/stores/stores.test.mjs`
- Test: `tests/system/migrations.test.mjs`

**Interfaces:**
- `normalizeRanges(ranges)`, `subtractRanges(released, acquired)`, `rangeContains(ranges, number)`, and `formatRanges(ranges)` operate on inclusive integer ranges.
- `atomicWriteJson(path, value, options)` writes a validated JSON document through a same-directory temporary file and backup.
- `acquireLease(path, metadata, options)`, `heartbeatLease(lease)`, and `releaseLease(lease)` implement expiring file leases.
- Stores expose `add`, `get`, `list`, `update`, and domain-specific operations without exposing raw filesystem details.
- `runMigrations(root)` upgrades known versioned documents and reports counts.

- [ ] **Step 1: Write failing Range Set tests for overlap, adjacency, subtraction, sorting, empty input, and latest missing.**
- [ ] **Step 2: Run `npm test -- tests/lib/range-set.test.mjs`.** Expected: FAIL with missing module errors.
- [ ] **Step 3: Implement Range Set as pure functions.** Do not put filesystem or model state into the module.
- [ ] **Step 4: Run the Range Set tests and confirm PASS.**
- [ ] **Step 5: Write failing atomic-write and lease tests.** Cover backup creation, malformed JSON recovery, stale lease recovery, and active lease refusal.
- [ ] **Step 6: Implement atomic writes and locks.** Use a unique temporary filename, file flush, rename, bounded backups, PID metadata, heartbeat timestamps, and process liveness checks.
- [ ] **Step 7: Run persistence tests and confirm PASS.** On platforms without directory fsync, return a warning while preserving file-level atomicity.
- [ ] **Step 8: Implement StoreContext and each domain store.** Validate on read and write, reject unknown schema versions, and keep execution history separate from domain documents.
- [ ] **Step 9: Add migration registry and v1-to-v2 entry points.** A migration must be idempotent and write a backup before replacing a document.
- [ ] **Step 10: Run `npm test -- tests/stores tests/system`.** Expected: PASS with no corrupted fixtures.

### Task 3: Subscription, episode, media CLI, URL normalization, and safe HTTP

**Files:**
- Create: `scripts/lib/url-normalizer.mjs`
- Create: `scripts/lib/network-policy.mjs`
- Create: `scripts/lib/safe-fetch.mjs`
- Create: `scripts/validation/hls-validator.mjs`
- Create: `scripts/validation/media-validator.mjs`
- Create: `scripts/validation/mp4-validator.mjs`
- Create: `scripts/validation/webm-validator.mjs`
- Create: `scripts/validation/dash-validator.mjs`
- Create: `scripts/validation/access-requirement.mjs`
- Create: `scripts/cli.mjs`
- Create: `tests/lib/url-normalizer.test.mjs`
- Create: `tests/lib/network-policy.test.mjs`
- Create: `tests/validation/hls-validator.test.mjs`
- Create: `tests/validation/media-validator.test.mjs`
- Create: `tests/validation/dash-validator.test.mjs`
- Create: `tests/cli/subscription-episode-media.test.mjs`

**Interfaces:**
- `normalizeUrl(rawUrl)` returns `{ url, normalizedKey }` while preserving unknown query parameters.
- `assertSafeUrl(rawUrl, options)` rejects unsafe schemes, loopback, private, link-local, and reserved addresses.
- `safeFetch(rawUrl, options)` validates every redirect target and returns a response plus redirect trace.
- `validateMediaCandidate(candidate, config)` returns media type, availability, access requirement, validation level, variants, and warnings.
- `submitMediaCandidate(root, subscriptionId, episodeKey, candidate)` validates, deduplicates, merges provenance, and atomically updates the Episode.
- CLI commands return the canonical JSON result and exit `0` for `ok` and `1` for failure.

- [ ] **Step 1: Write failing URL and SSRF tests.** Include `file://`, localhost, private IPv4, mapped IPv6, link-local, unsafe redirect, fragment removal, default port normalization, and signed parameter preservation.
- [ ] **Step 2: Run `npm test -- tests/lib/url-normalizer.test.mjs tests/lib/network-policy.test.mjs`.** Expected: FAIL for missing modules.
- [ ] **Step 3: Implement URL normalization and network policy.** Resolve DNS before connecting, validate every redirect manually, cap redirect count, and never forward cookies.
- [ ] **Step 4: Run focused network tests and confirm PASS.**
- [ ] **Step 5: Write failing local-server media tests.** Fixtures must distinguish HTML error pages, HLS master/media playlists, MP4/WebM headers, DASH MPD, relative segments, and sampled segment failures.
- [ ] **Step 6: Implement validators.** Use bounded HEAD/Range/sample requests; never download a full video; use `fast-xml-parser` for DASH.
- [ ] **Step 7: Run validation tests and confirm PASS.**
- [ ] **Step 8: Implement `subscription`, `episode`, and `media` CLI subcommands.** Support every command listed in the attachment, including `media history`, `episode missing`, and `episode latest-missing`.
- [ ] **Step 9: Add CLI integration tests in an isolated temporary `ZHUIJU_HOME`.** Verify multiple Media URLs and Provenance records survive, duplicates merge, invalid candidates do not set `acquired`, and output remains JSON-only.
- [ ] **Step 10: Run `npm test -- tests/cli`.** Expected: PASS with clean temporary directories.

### Task 4: Tasks, queue, concurrency, exceptions, and notifications

**Files:**
- Create: `scripts/tasks/task-policy.mjs`
- Create: `scripts/tasks/task-controller.mjs`
- Create: `scripts/tasks/queue-manager.mjs`
- Create: `scripts/tasks/subscription-runner.mjs`
- Create: `scripts/tasks/trace-store.mjs`
- Create: `scripts/tasks/notification-policy.mjs`
- Extend: `scripts/cli.mjs`
- Test: `tests/tasks/task-policy.test.mjs`
- Test: `tests/tasks/task-controller.test.mjs`
- Test: `tests/tasks/queue-manager.test.mjs`
- Test: `tests/tasks/trace-and-notification.test.mjs`

**Interfaces:**
- `selectTargets(subscription, mode)` computes Bootstrap, Incremental, Repair, Manual, and Validate targets.
- `enqueueSubscriptionTask(root, input)` coalesces same-subscription triggers and returns the active task.
- `runSubscriptionTask(root, subscriptionId)` acquires the subscription lease and global slot before changing status.
- `appendObservation(root, taskId, observation)` writes redacted append-only Trace data.
- `buildNotification(event, subscription, episodes)` returns a summary without full URLs.

- [ ] **Step 1: Write failing policy tests for all five modes, latest-missing default, historical gaps, skip/delay/reschedule exceptions, and no auto-increment on not-found.**
- [ ] **Step 2: Run the policy tests and confirm the expected missing-module failure.**
- [ ] **Step 3: Implement target selection and exception handling as pure functions.**
- [ ] **Step 4: Write failing queue and lease tests for coalescing, one task per subscription, global slot limits, heartbeat, stale recovery, pause, resume, and cancel.**
- [ ] **Step 5: Implement the task controller and queue manager.** Persist every state transition atomically and make crash recovery idempotent.
- [ ] **Step 6: Add Trace redaction and notification policy.** Redact credentials, signed query values, and identity data before JSONL append.
- [ ] **Step 7: Extend CLI with `task`, `queue`, and task context/heartbeat/observation operations.** `task run` prepares structured context for the agent; it does not pretend to perform web extraction itself.
- [ ] **Step 8: Run all task tests and confirm PASS.**

### Task 5: Skill protocol, references, capability detection, and runtime adapters

**Files:**
- Create: `SKILL.md`
- Create: `references/conversation-protocol.md`
- Create: `references/agent-extraction.md`
- Create: `references/task-lifecycle.md`
- Create: `references/media-validation.md`
- Create: `references/runtime-capabilities.md`
- Create: `references/security.md`
- Create: `references/openclaw.md`
- Create: `scripts/runtime/runtime-adapter.mjs`
- Create: `scripts/runtime/generic-runtime.mjs`
- Create: `scripts/runtime/openclaw-runtime.mjs`
- Create: `scripts/runtime/runtime-detect.mjs`
- Extend: `scripts/cli.mjs`
- Test: `tests/runtime/runtime-detect.test.mjs`
- Test: `tests/runtime/runtime-adapters.test.mjs`

**Interfaces:**
- `detectCapabilities(env, commandRunner)` returns normalized runtime capability data.
- `GenericLocalRuntimeAdapter` supports manual execution and reports unavailable scheduling/notification/browser features.
- `OpenClawRuntimeAdapter` uses detected OpenClaw commands or explicit configured bridges and returns unsupported results when unavailable.
- `SKILL.md` instructs the agent to use only observed URLs, submit through CLI, obey task budgets, and treat web content as untrusted.

- [ ] **Step 1: Write failing runtime detection tests for terminal/http/search/browser/scheduler/notification combinations.**
- [ ] **Step 2: Run runtime tests and confirm failure for missing adapter modules.**
- [ ] **Step 3: Implement runtime detection and both adapters.** Never invent a host API; unsupported operations return structured capability errors.
- [ ] **Step 4: Extend CLI with `runtime detect`, `schedule sync/show/remove`, and `doctor`.**
- [ ] **Step 5: Write `SKILL.md` under 500 lines with rich trigger description, exact tool protocol, five task modes, degradation rules, safety constraints, and structured CLI examples.**
- [ ] **Step 6: Add references with detailed lifecycle, extraction, validation, runtime, OpenClaw, and security guidance.**
- [ ] **Step 7: Run runtime tests and manually validate that every CLI example in `SKILL.md` maps to a real command.**

### Task 6: OpenClaw schedules, exceptions, and external Cron bridge

**Files:**
- Create: `scripts/runtime/schedule-planner.mjs`
- Create: `scripts/runtime/cron-bridge.mjs`
- Extend: `scripts/runtime/openclaw-runtime.mjs`
- Extend: `scripts/stores/schedule-store.mjs`
- Extend: `scripts/cli.mjs`
- Test: `tests/runtime/schedule-planner.test.mjs`
- Test: `tests/runtime/cron-bridge.test.mjs`

**Interfaces:**
- `planSchedule(subscription)` emits one logical task definition and its trigger times.
- `syncSchedule(root, subscriptionId, adapter)` reconciles local schedules with host Job IDs.
- `buildCronInvocation(subscriptionId, mode)` emits an enqueue-only command.

- [ ] **Step 1: Write failing schedule tests for multiple trigger times, one logical task, skip, delayed, rescheduled, cancelled, and special exceptions.**
- [ ] **Step 2: Implement schedule planning and exception-aware trigger generation.**
- [ ] **Step 3: Implement OpenClaw reconciliation using host-provided commands or explicit bridge configuration, preserving local state when the host is unavailable.**
- [ ] **Step 4: Implement external Cron bridge output and tests proving it only calls `task enqueue`.**
- [ ] **Step 5: Run schedule tests and confirm PASS.**

### Task 7: System doctor, fixtures, integration path, and documentation

**Files:**
- Create: `scripts/system/doctor.mjs`
- Create: `tests/fixtures/server.mjs`
- Create: `tests/integration/full-flow.test.mjs`
- Create: `README.md`
- Create: `AGENTS.md`
- Extend: `scripts/cli.mjs`
- Extend: `.gitignore`

- [ ] **Step 1: Write the full-flow test.** Use a local HTTP fixture server, create a subscription, seed release/acquired ranges, compute a Bootstrap target, submit a valid HLS and MP4 candidate, query provenance, enqueue Incremental, and verify task coalescing.
- [ ] **Step 2: Run the integration test and confirm it fails for the unimplemented path.**
- [ ] **Step 3: Implement `doctor` checks for data root, schema validity, stale locks, dependency availability, runtime capabilities, and safe HTTP behavior.**
- [ ] **Step 4: Complete README with installation, `ZHUIJU_HOME`, CLI examples, task modes, OpenClaw setup, generic fallback, security boundaries, and test commands.**
- [ ] **Step 5: Complete AGENTS.md with repository conventions, PowerShell/RTK command rules, package layout, and verification commands.**
- [ ] **Step 6: Run the full integration test and confirm PASS.**

### Task 8: Full verification and requirements audit

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-zhuiju-design.md` only if verification discovers a documented contradiction
- Modify: `README.md` for verified command/output corrections
- Modify: `AGENTS.md` for verified workflow corrections

- [ ] **Step 1: Run `npm test` and record the complete output.**
- [ ] **Step 2: Run every CLI help and doctor command in an isolated temporary data root.**
- [ ] **Step 3: Exercise every command from the attachment’s Subscription, Episode, Media, Task, Schedule, and System sections.**
- [ ] **Step 4: Verify safety invariants with dedicated SSRF, credential-redaction, no-full-download, and direct-file-edit tests.**
- [ ] **Step 5: Audit every numbered requirement from the attachment against a test, schema, implementation, or documentation evidence.
- [ ] **Step 6: Run `git status` if a Git repository exists; otherwise report that the workspace is not a Git repository and do not claim a commit.
- [ ] **Step 7: Report only verified results, including any host-dependent OpenClaw operations that cannot run without an installed host.
