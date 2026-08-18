export async function readBoundedBody(response, maxBytes = 65536, { timeoutMs = 30000 } = {}) {
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error('Response has no readable body');
  const chunks = [];
  const start = Date.now();
  let total = 0;
  while (total < maxBytes) {
    const remaining = timeoutMs - (Date.now() - start);
    if (remaining <= 0) throw new Error('Bounded body read timed out');
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Bounded body read timed out')), remaining); });
    let step;
    try {
      step = await Promise.race([reader.read(), timeout]);
    } finally {
      clearTimeout(timer);
    }
    const { done, value } = step;
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  const bounded = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = bounded.length - offset;
    if (remaining <= 0) break;
    bounded.set(chunk.subarray(0, remaining), offset);
    offset += Math.min(chunk.length, remaining);
  }
  return bounded;
}
