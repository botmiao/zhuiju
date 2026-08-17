# Runtime Capabilities

The runtime contract is `detectCapabilities()`, `schedule()`, `unschedule()`, `sendNotification()`, `invokeBrowser()`, and `getRuntimeInfo()`.

No browser means HTTP/source/script/terminal analysis. No Web Search means user-specified or historical sources only. No scheduler means manual execution with an explicit limitation. No notification means local persistence and user-driven queries.

Adapters return a structured unsupported-capability result rather than pretending an operation succeeded.
