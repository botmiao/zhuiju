export async function determineAccessRequirement(url, { fetcher, requestContext = {}, probeTimeoutMs = 10000 } = {}) {
  const contextHeaders = requestContext.headers || {};
  const probe = async (headers) => {
    const result = await fetcher(url, { method: 'HEAD', headers, signal: AbortSignal.timeout(probeTimeoutMs) });
    const response = result.response || result;
    if (response.ok || response.status === 206) return 'ok';
    return response.status;
  };
  let plain = 'error';
  try { plain = await probe({ 'user-agent': 'zhuiju-validator' }); } catch { /* a failed attempt is evidence only for this candidate */ }
  if (plain === 'ok') return { accessRequirement: 'none', requiredHeaderNames: [] };
  let withContext = 'skipped';
  if (Object.keys(contextHeaders).length > 0) {
    try { withContext = await probe(contextHeaders); } catch { withContext = 'error'; }
  }
  if (withContext === 'ok') return { accessRequirement: 'headers', requiredHeaderNames: Object.keys(contextHeaders) };
  if ([plain, withContext].includes(401) || [plain, withContext].includes(403)) return { accessRequirement: 'session', requiredHeaderNames: [] };
  return { accessRequirement: 'unknown', requiredHeaderNames: [] };
}
