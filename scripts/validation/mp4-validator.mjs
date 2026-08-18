import { readBoundedBody } from '../lib/bounded-body.mjs';

export async function validateMp4(url, { fetcher } = {}) {
  const result = await fetcher(url, { method: 'GET', headers: { Range: 'bytes=0-65535' } });
  const response = result.response || result;
  if (!response.ok && response.status !== 206) throw new Error(`MP4 request failed: HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  const bytes = await readBoundedBody(response, 65536);
  const ftyp = new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp';
  if (!contentType.includes('video/mp4') && !ftyp) throw new Error('Response is not an MP4 media resource');
  return { mediaType: 'mp4', validationLevel: 'http-valid', availability: 'playable', variants: [] };
}
