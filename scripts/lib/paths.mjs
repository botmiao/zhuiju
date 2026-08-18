import os from 'node:os';
import path from 'node:path';

export function resolveDataRoot(env = process.env, platform = process.platform) {
  if (env.ZHUIJU_HOME) return path.resolve(env.ZHUIJU_HOME);
  if (platform === 'win32') {
    return path.join(env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'zhuiju');
  }
  if (platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'zhuiju');
  return path.join(env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'zhuiju');
}

export function dataPaths(root) {
  return {
    root,
    config: path.join(root, 'config.json'),
    subscriptions: path.join(root, 'subscriptions'),
    queue: path.join(root, 'queue'),
    schedules: path.join(root, 'schedules'),
    logs: path.join(root, 'logs'),
    traces: path.join(root, 'traces'),
    locks: path.join(root, 'locks'),
    backups: path.join(root, 'backups')
  };
}

export function assertSubscriptionId(id) {
  if (typeof id !== 'string' || !/^sub_[A-Za-z0-9_-]+$/.test(id)) {
    const error = new Error(`Invalid subscription id: ${id}`);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return id;
}

export function subscriptionPaths(root, subscriptionId) {
  const base = path.join(root, 'subscriptions', assertSubscriptionId(subscriptionId));
  return {
    base,
    subscription: path.join(base, 'subscription.json'),
    task: path.join(base, 'task.json'),
    episodes: path.join(base, 'episodes')
  };
}

export function episodePath(root, subscriptionId, episodeKey) {
  const safeKey = episodeKey.replaceAll(':', '-').replaceAll(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(subscriptionPaths(root, subscriptionId).episodes, `${safeKey}.json`);
}
