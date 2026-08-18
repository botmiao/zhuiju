import { ffprobeValidate } from '../lib/ffprobe.mjs';

function attributes(text) {
  return Object.fromEntries([...text.matchAll(/([A-Z0-9-]+)=((?:"[^"]*")|[^,]*)/g)].map((match) => [match[1], match[2].replace(/^"|"$/g, '')]));
}

function parsePlaylist(body, url) {
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const variants = [];
  const variantLines = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
    const variantIndex = lines.findIndex((candidate, position) => position > index && candidate && !candidate.startsWith('#'));
    if (variantIndex === -1) continue;
    variantLines.add(variantIndex);
    const info = attributes(line.slice('#EXT-X-STREAM-INF:'.length));
    const resolution = info.RESOLUTION?.match(/^(\d+)x(\d+)$/);
    variants.push({
      url: new URL(lines[variantIndex], url).toString(),
      width: resolution ? Number(resolution[1]) : null,
      height: resolution ? Number(resolution[2]) : null,
      bandwidth: info.BANDWIDTH ? Number(info.BANDWIDTH) : null,
      codecs: info.CODECS ? info.CODECS.split(',').map((codec) => codec.trim()) : []
    });
  }
  const segments = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => line && !line.startsWith('#') && !variantLines.has(index))
    .map(({ line }) => new URL(line, url).toString());
  return { variants, segments };
}

function assertPlaylist(body, label) {
  if (!body.includes('#EXTM3U') || /^\s*<(!doctype|html)/i.test(body)) throw new Error(`${label} is not a valid manifest`);
}

export async function validateHls(url, { fetcher, segmentSampleCount = 2, useFfprobe = true, ffprobeRunner = ffprobeValidate } = {}) {
  const result = await fetcher(url, { method: 'GET' });
  const response = result.response || result;
  if (!response.ok) throw new Error(`HLS request failed: HTTP ${response.status}`);
  const body = await response.text();
  assertPlaylist(body, 'HLS response');
  const parsed = parsePlaylist(body, url);
  const variants = parsed.variants;
  let segments = parsed.segments;
  if (variants.length > 0) {
    const variantResult = await fetcher(variants[0].url, { method: 'GET' });
    const variantResponse = variantResult.response || variantResult;
    if (!variantResponse.ok) throw new Error(`HLS variant request failed: HTTP ${variantResponse.status}`);
    const variantBody = await variantResponse.text();
    assertPlaylist(variantBody, 'HLS variant response');
    segments = parsePlaylist(variantBody, variants[0].url).segments;
  }
  if (useFfprobe) {
    const outcome = await ffprobeRunner(url, [...variants.map((variant) => variant.url), ...segments]);
    if (outcome.status === 'valid') {
      return {
        mediaType: variants.length ? 'hls-master' : 'hls-media',
        validationLevel: 'decodable',
        availability: 'playable',
        variants,
        segmentCount: segments.length
      };
    }
    if (outcome.status === 'invalid') throw new Error(`ffprobe validation failed: ${outcome.reason}`);
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
