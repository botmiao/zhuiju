import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { validateMediaCandidate } from '../../scripts/validation/media-validator.mjs';

async function fixtureServer() {
  const server = http.createServer((request, response) => {
    if (request.url === '/master.m3u8') {
      response.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' });
      response.end('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=640x360\n/media.m3u8\n');
    } else if (request.url === '/media.m3u8') {
      response.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' });
      response.end('#EXTM3U\n#EXTINF:4,\n/segment.ts\n');
    } else if (request.url === '/segment.ts') {
      response.writeHead(200, { 'content-type': 'video/mp2t', 'content-length': '7' });
      response.end('segment');
    } else if (request.url === '/video.mp4') {
      response.writeHead(206, { 'content-type': 'video/mp4', 'content-range': 'bytes 0-7/100', 'content-length': '8' });
      response.end(Buffer.from([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]));
    } else {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html>not media</html>');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('validates an HLS master and samples a media segment', async (t) => {
  const fixture = await fixtureServer();
  t.after(() => fixture.server.close());
  const result = await validateMediaCandidate({
    url: `${fixture.base}/master.m3u8`,
    observedFrom: { type: 'page', url: `${fixture.base}/page` },
    observationMethod: 'html-attribute'
  }, { fetcher: (url, options) => fetch(url, { ...options, redirect: 'manual' }), segmentSampleCount: 1 });
  assert.equal(result.mediaType, 'hls-master');
  assert.equal(result.availability, 'playable');
  assert.equal(result.validationLevel, 'segment-valid');
  assert.equal(result.variants.length, 1);
});

test('validates an MP4 by a bounded range response', async (t) => {
  const fixture = await fixtureServer();
  t.after(() => fixture.server.close());
  const result = await validateMediaCandidate({ url: `${fixture.base}/video.mp4` }, {
    fetcher: (url, options) => fetch(url, { ...options, redirect: 'manual' })
  });
  assert.equal(result.mediaType, 'mp4');
  assert.equal(result.availability, 'playable');
  assert.equal(result.validationLevel, 'http-valid');
});

test('rejects an HTML error page as media', async (t) => {
  const fixture = await fixtureServer();
  t.after(() => fixture.server.close());
  await assert.rejects(
    () => validateMediaCandidate({ url: `${fixture.base}/error` }, { fetcher: (url, options) => fetch(url, { ...options, redirect: 'manual' }) }),
    /media|HTML|invalid/i
  );
});
