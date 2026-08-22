const groups = {
  subscription: `subscription add --input subscription.json
subscription get <id>
subscription list
subscription update <id> --input patch.json
subscription pause <id>
subscription resume <id> [--status airing|completed|cancelled]
subscription remove <id>`,
  episode: `episode ensure <subscription> <episode-key> [--input episode.json]
episode get <subscription> <episode-key>
episode list <subscription>
episode missing <subscription>
episode latest-missing <subscription>
episode mark-acquired <subscription> <episode-key>`,
  media: `media submit --subscription <id> --episode <episode-key> --input candidate.json
media list <subscription> <episode-key>
media validate <subscription> <episode-key>
media history <media-id>`,
  task: `task enqueue --subscription <id> [--mode bootstrap|incremental|repair|manual|validate] [--trigger manual|cron|rerun|system] [--reason text]
task run <subscription> [--maximumActiveSubscriptions n]
task status <subscription>
task heartbeat <subscription>
task observe <subscription> --input observation.json
task pause <subscription>
task resume <subscription>
task cancel <subscription>
task fail <subscription> --message <text>
task complete <subscription>
task context <subscription>`,
  queue: `queue status`,
  schedule: `schedule sync <subscription>
schedule show <subscription>
schedule remove <subscription>`,
  runtime: `runtime detect`,
  init: `init`,
  doctor: `doctor`,
  migrate: `migrate`
};

export function usageFor(group) {
  if (group && groups[group]) return `usage:\n${groups[group]}`;
  const overview = Object.entries(groups).map(([name, body]) => `${name}\n${body.split('\n').map((line) => `  ${line}`).join('\n')}`).join('\n\n');
  return `usage: cli <group> <command> [args]\nEvery command prints one JSON object with ok, code, message, retryable, data, warnings.\n\n${overview}\n\nUse "cli <group> --help" for group details. Data root defaults to ~/.zhuiju and can be overridden with ZHUIJU_HOME.`;
}
