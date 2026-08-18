import { readBoundedBody } from '../lib/bounded-body.mjs';

export async function validateWebm(url, { fetcher } = {}) {
  const result = await fetcher(url, { method: 'GET', headers: { Range: 'bytes=0-65535' } });
  const response = result.response || result;
  if (!response.ok && response.status !== 206) throw new Error(`WebM request failed: HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  const bytes = await readBoundedBody(response, 65536);
  const webm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (!contentType.includes('video/webm') && !webm) throw new Error('Response is not a WebM media resource');
  return { mediaType: 'webm', validationLevel: 'http-valid', availability: 'playable', variants: [] };
}
