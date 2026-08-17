import { XMLParser } from 'fast-xml-parser';

export async function validateDash(url, { fetcher } = {}) {
  const result = await fetcher(url, { method: 'GET' });
  const response = result.response || result;
  if (!response.ok) throw new Error(`DASH request failed: HTTP ${response.status}`);
  const body = await response.text();
  if (!/<MPD(?:\s|>)/i.test(body)) throw new Error('Response is not a DASH MPD');
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(body);
  const mpd = parsed.MPD;
  if (!mpd) throw new Error('DASH MPD is malformed');
  const adaptationSets = mpd.Period?.AdaptationSet || [];
  const sets = Array.isArray(adaptationSets) ? adaptationSets : [adaptationSets];
  const variants = sets.flatMap((set) => {
    const representations = set.Representation || [];
    return (Array.isArray(representations) ? representations : [representations]).filter(Boolean).map((representation) => ({
      id: representation['@_id'] || null,
      width: representation['@_width'] ? Number(representation['@_width']) : null,
      height: representation['@_height'] ? Number(representation['@_height']) : null,
      bandwidth: representation['@_bandwidth'] ? Number(representation['@_bandwidth']) : null
    }));
  });
  return { mediaType: 'dash', validationLevel: 'manifest-valid', availability: 'playable', variants };
}
