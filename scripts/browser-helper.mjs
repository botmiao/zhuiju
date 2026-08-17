import { assertSafeUrl } from './lib/network-policy.mjs';

export function inspectBrowserRequest(request) {
  const url = request.url || request;
  assertSafeUrl(url);
  return {
    url: new URL(url).toString(),
    resourceType: request.resourceType || 'unknown',
    allowed: true
  };
}

export function createBrowserRequestGuard() {
  return (request) => inspectBrowserRequest(request);
}
