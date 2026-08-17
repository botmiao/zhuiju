# Conversation Protocol

Use natural language to collect intent, but turn every state-changing operation into a deterministic CLI call.

| User intent | Mode or command |
|---|---|
| Subscribe to a work | Create a Subscription, then `bootstrap` |
| Check newest release | `incremental` |
| Find historical gaps | `episode missing`, then `repair` |
| Process one episode/source | `manual` |
| Re-check saved addresses | `validate` or `media validate` |
| Pause/resume/cancel | Subscription or task command |
| Change trigger times | Update schedule, then `schedule sync` |

Ask only for missing information that changes the operation: title identity, acquired ranges, authorized source restrictions, or timezone. Preserve unknown totals as an explicit unknown state. Never silently widen `specified-only` to public search.
