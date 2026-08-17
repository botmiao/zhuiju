export async function determineAccessRequirement(url, { fetcher, requestContext = {} } = {}) {
  const attempts = [
    { name: 'context', headers: requestContext.headers || {} },
    { name: 'headers', headers: {} },
    { name: 'plain', headers: { 'user-agent': 'zhuiju-validator' } }
  ];
  const successful = [];
  for (const attempt of attempts) {
    try {
      const result = await fetcher(url, { method: 'HEAD', headers: attempt.headers });
      const response = result.response || result;
      if (response.ok || response.status === 206) successful.push(attempt.name);
    } catch { /* a failed attempt is evidence only for this candidate */ }
  }
  if (successful.includes('plain')) return { accessRequirement: 'none', requiredHeaderNames: [] };
  if (successful.includes('headers')) return { accessRequirement: 'headers', requiredHeaderNames: [] };
  if (successful.includes('context')) return { accessRequirement: 'headers', requiredHeaderNames: Object.keys(requestContext.headers || {}) };
  return { accessRequirement: 'unknown', requiredHeaderNames: [] };
}
