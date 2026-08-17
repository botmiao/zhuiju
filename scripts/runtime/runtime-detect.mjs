function asBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export async function detectCapabilities(env = process.env, commandRunner = async () => false) {
  const openclaw = env.ZHUIJU_RUNTIME === 'openclaw' || Boolean(env.OPENCLAW_RUNTIME || env.OPENCLAW_HOME);
  const browserCommand = await commandRunner('browser');
  return {
    runtime: openclaw ? 'openclaw' : (env.ZHUIJU_RUNTIME || 'generic-local-agent'),
    capabilities: {
      terminal: asBoolean(env.ZHUIJU_TERMINAL, true),
      http: asBoolean(env.ZHUIJU_HTTP, true),
      webSearch: asBoolean(env.ZHUIJU_WEB_SEARCH, openclaw),
      browser: asBoolean(env.ZHUIJU_BROWSER, openclaw || browserCommand),
      scheduler: asBoolean(env.ZHUIJU_SCHEDULER, openclaw),
      notification: asBoolean(env.ZHUIJU_NOTIFICATION, openclaw)
    }
  };
}
