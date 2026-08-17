function attributes(text) {
  return Object.fromEntries([...text.matchAll(/([A-Z0-9-]+)=((?:"[^"]*")|[^,]*)/g)].map((match) => [match[1], match[2].replace(/^"|"$/g, '')]));
}

export async function validateHls(url, { fetcher, segmentSampleCount = 2 } = {}) {
  const result = await fetcher(url, { method: 'GET' });
  const response = result.response || result;
  if (!response.ok) throw new Error(`HLS request failed: HTTP ${response.status}`);
  const body = await response.text();
  if (!body.includes('#EXTM3U') || /^\s*<(!doctype|html)/i.test(body)) throw new Error('HLS response is not a valid manifest');
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const variants = [];
  const segments = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const variantUrl = lines.slice(index + 1).find((candidate) => candidate && !candidate.startsWith('#'));
      if (variantUrl) {
        const info = attributes(line.slice('#EXT-X-STREAM-INF:'.length));
        const resolution = info.RESOLUTION?.match(/^(\d+)x(\d+)$/);
        variants.push({
          url: new URL(variantUrl, url).toString(),
          width: resolution ? Number(resolution[1]) : null,
          height: resolution ? Number(resolution[2]) : null,
          bandwidth: info.BANDWIDTH ? Number(info.BANDWIDTH) : null,
          codecs: info.CODECS ? info.CODECS.split(',').map((codec) => codec.trim()) : []
        });
      }
    } else if (line && !line.startsWith('#')) segments.push(new URL(line, url).toString());
  }
  const samples = segments.slice(0, Math.max(0, segmentSampleCount));
  for (const segment of samples) {
    const sampled = await fetcher(segment, { method: 'GET', headers: { Range: 'bytes=0-65535' } });
    const sampledResponse = sampled.response || sampled;
    if (!sampledResponse.ok && sampledResponse.status !== 206) throw new Error(`HLS segment failed: HTTP ${sampledResponse.status}`);
  }
  return {
    mediaType: variants.length ? 'hls-master' : 'hls-media',
    validationLevel: samples.length ? 'segment-valid' : 'playlist-valid',
    availability: 'playable',
    variants,
    segmentCount: segments.length
  };
}
