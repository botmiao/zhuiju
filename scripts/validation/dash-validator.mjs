import { XMLParser } from 'fast-xml-parser';

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function baseUrlOf(mpd, set, representation, url) {
  for (const candidate of [representation?.BaseURL, set?.BaseURL, mpd.Period?.BaseURL, mpd.BaseURL]) {
    if (typeof candidate === 'string' && candidate.trim()) return new URL(candidate.trim(), url).toString();
  }
  return url;
}

function initializationUrl(mpd, set, representation, base) {
  const template = representation?.SegmentTemplate?.['@_initialization'] || set?.SegmentTemplate?.['@_initialization'] || null;
  if (!template) return null;
  const startNumber = representation?.SegmentTemplate?.['@_startNumber'] || set?.SegmentTemplate?.['@_startNumber'] || 1;
  const substituted = template
    .replaceAll('$RepresentationID$', representation?.['@_id'] ?? '')
    .replaceAll('$Bandwidth$', String(representation?.['@_bandwidth'] ?? ''))
    .replaceAll('$Number$', String(startNumber));
  if (/\$\w+\$/.test(substituted)) return null;
  return new URL(substituted, base).toString();
}

export async function validateDash(url, { fetcher } = {}) {
  const result = await fetcher(url, { method: 'GET' });
  const response = result.response || result;
  if (!response.ok) throw new Error(`DASH request failed: HTTP ${response.status}`);
  const body = await response.text();
  if (!/<MPD(?:\s|>)/i.test(body)) throw new Error('Response is not a DASH MPD');
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(body);
  const mpd = parsed.MPD;
  if (!mpd) throw new Error('DASH MPD is malformed');
  const sets = asArray(mpd.Period?.AdaptationSet);
  const variants = sets.flatMap((set) => {
    const representations = asArray(set.Representation);
    return representations.map((representation) => ({
      id: representation['@_id'] || null,
      width: representation['@_width'] ? Number(representation['@_width']) : null,
      height: representation['@_height'] ? Number(representation['@_height']) : null,
      bandwidth: representation['@_bandwidth'] ? Number(representation['@_bandwidth']) : null
    }));
  });
  let validationLevel = 'manifest-valid';
  const firstSet = sets[0];
  const firstRepresentation = asArray(firstSet?.Representation)[0];
  if (firstRepresentation) {
    const initUrl = initializationUrl(mpd, firstSet, firstRepresentation, baseUrlOf(mpd, firstSet, firstRepresentation, url));
    if (initUrl) {
      const initResult = await fetcher(initUrl, { method: 'GET', headers: { Range: 'bytes=0-65535' } });
      const initResponse = initResult.response || initResult;
      if (!initResponse.ok && initResponse.status !== 206) throw new Error(`DASH initialization segment failed: HTTP ${initResponse.status}`);
      const contentType = initResponse.headers.get('content-type') || '';
      await initResponse.body?.cancel?.().catch(() => {});
      if (contentType.includes('text/html')) throw new Error('DASH initialization segment is not a media resource');
      validationLevel = 'segment-valid';
    }
  }
  return { mediaType: 'dash', validationLevel, availability: 'playable', variants };
}
