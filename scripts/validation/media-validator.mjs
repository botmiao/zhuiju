import { normalizeUrl } from '../lib/url-normalizer.mjs';
import { safeFetch } from '../lib/safe-fetch.mjs';
import { validateHls } from './hls-validator.mjs';
import { validateMp4 } from './mp4-validator.mjs';
import { validateWebm } from './webm-validator.mjs';
import { validateDash } from './dash-validator.mjs';
import { determineAccessRequirement } from './access-requirement.mjs';

function defaultFetcher(url, options) {
  return safeFetch(url, options);
}

export async function validateMediaCandidate(candidate, config = {}) {
  const { url, normalizedKey } = normalizeUrl(candidate.url);
  const fetcher = config.fetcher || defaultFetcher;
  const parsed = new URL(url);
  const observedHeaders = {
    ...(candidate.requestContext?.referer ? { referer: candidate.requestContext.referer } : {}),
    ...(candidate.requestContext?.origin ? { origin: candidate.requestContext.origin } : {})
  };
  const mediaFetcher = (requestUrl, options = {}) => fetcher(requestUrl, { ...options, headers: { ...(options.headers || {}), ...observedHeaders } });
  const access = config.checkAccessRequirements === false ? { accessRequirement: 'none', requiredHeaderNames: [] } : await determineAccessRequirement(url, { fetcher, requestContext: { headers: observedHeaders }, probeTimeoutMs: config.accessProbeTimeoutMs });
  if (access.accessRequirement === 'session') throw new Error('Media URL requires an authenticated session and cannot be validated');
  let result;
  if (/\.m3u8(?:$|\?)/i.test(parsed.pathname)) result = await validateHls(url, { ...config, fetcher: mediaFetcher });
  else if (/\.mpd(?:$|\?)/i.test(parsed.pathname)) result = await validateDash(url, { ...config, fetcher: mediaFetcher });
  else if (/\.webm(?:$|\?)/i.test(parsed.pathname)) result = await validateWebm(url, { ...config, fetcher: mediaFetcher });
  else if (/\.mp4(?:$|\?)/i.test(parsed.pathname)) result = await validateMp4(url, { ...config, fetcher: mediaFetcher });
  else {
    const responseResult = await mediaFetcher(url, { method: 'GET', headers: { Range: 'bytes=0-65535' } });
    const response = responseResult.response || responseResult;
    const contentType = response.headers.get('content-type') || '';
    await response.body?.cancel?.().catch(() => {});
    if (contentType.includes('mpegurl')) result = await validateHls(url, { ...config, fetcher: mediaFetcher });
    else if (contentType.includes('dash') || contentType.includes('xml')) result = await validateDash(url, { ...config, fetcher: mediaFetcher });
    else if (contentType.includes('webm')) result = await validateWebm(url, { ...config, fetcher: mediaFetcher });
    else if (contentType.includes('mp4')) result = await validateMp4(url, { ...config, fetcher: mediaFetcher });
    else throw new Error('Candidate response is not a supported media resource');
  }
  const requestContext = { headers: observedHeaders };
  return {
    ...result,
    url,
    normalizedKey,
    accessRequirement: access.accessRequirement,
    lifetimeState: 'active',
    requestContext: {
      referer: candidate.requestContext?.referer || null,
      origin: candidate.requestContext?.origin || null,
      userAgentRequired: false,
      cookieRequired: false,
      requiredHeaderNames: access.requiredHeaderNames
    },
    provenance: candidate.observedFrom ? [{ ...candidate.observedFrom, observationMethod: candidate.observationMethod || 'agent-observation', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), seenCount: 1 }] : [],
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    lastValidatedAt: new Date().toISOString(),
    estimatedExpiresAt: null,
    seenCount: 1,
    note: null
  };
}
