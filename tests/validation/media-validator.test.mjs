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
    } else if (request.url === '/refer.mp4') {
      if (!(request.headers.referer || '').includes('source.example')) {
        response.writeHead(403, { 'content-type': 'text/plain' });
        response.end('hotlinking denied');
      } else {
        response.writeHead(206, { 'content-type': 'video/mp4', 'content-range': 'bytes 0-7/100', 'content-length': '8' });
        response.end(Buffer.from([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]));
      }
    } else if (request.url === '/manifest.mpd') {
      response.writeHead(200, { 'content-type': 'application/dash+xml' });
      response.end('<?xml version="1.0"?><MPD><Period><AdaptationSet><SegmentTemplate initialization="init-$RepresentationID$.m4s" media="chunk-$RepresentationID$-$Number$.m4s" startNumber="1"/><Representation id="video-1" bandwidth="1000" width="640" height="360"/></AdaptationSet></Period></MPD>');
    } else if (request.url === '/init-video-1.m4s') {
      response.writeHead(206, { 'content-type': 'video/iso.segment', 'content-range': 'bytes 0-7/100', 'content-length': '8' });
      response.end('initseg!');
    } else if (request.url === '/auth.mp4') {
      response.writeHead(403, { 'content-type': 'text/plain' });
      response.end('login required');
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
  let segmentRequests = 0;
  const result = await validateMediaCandidate({
    url: `${fixture.base}/master.m3u8`,
    observedFrom: { type: 'page', url: `${fixture.base}/page` },
    observationMethod: 'html-attribute'
  }, {
    fetcher: (url, options) => {
      if (url.endsWith('/segment.ts')) segmentRequests += 1;
      return fetch(url, { ...options, redirect: 'manual' });
    },
    segmentSampleCount: 1,
    ffprobeRunner: async () => ({ status: 'unavailable' })
  });
  assert.equal(result.mediaType, 'hls-master');
  assert.equal(result.availability, 'playable');
  assert.equal(result.validationLevel, 'segment-valid');
  assert.equal(result.variants.length, 1);
  assert.equal(segmentRequests, 1);
});

test('uses ffprobe for HLS validation when available', async (t) => {
  const fixture = await fixtureServer();
  t.after(() => fixture.server.close());
  let sampledRequests = 0;
  let probedUrl = null;
  const result = await validateMediaCandidate({
    url: `${fixture.base}/master.m3u8`,
    observedFrom: { type: 'page', url: `${fixture.base}/page` },
    observationMethod: 'html-attribute'
  }, {
    fetcher: (url, options) => {
      if (url.endsWith('/segment.ts')) sampledRequests += 1;
      return fetch(url, { ...options, redirect: 'manual' });
    },
    ffprobeRunner: async (url) => {
      probedUrl = url;
      return { status: 'valid' };
    }
  });
  assert.equal(probedUrl, `${fixture.base}/master.m3u8`);
  assert.equal(result.mediaType, 'hls-master');
  assert.equal(result.validationLevel, 'decodable');
  assert.equal(sampledRequests, 0);
});

test('falls back to segment sampling when ffprobe is unavailable', async (t) => {
  const fixture = await fixtureServer();
  t.after(() => fixture.server.close());
  let runnerCalls = 0;
  const result = await validateMediaCandidate({
    url: `${fixture.base}/master.m3u8`,
    observedFrom: { type: 'page', url: `${fixture.base}/page` }
  }, {
    fetcher: (url, options) => fetch(url, { ...options, redirect: 'manual' }),
    segmentSampleCount: 1,
    ffprobeRunner: async () => {
      runnerCalls += 1;
      return { status: 'unavailable' };
    }
  });
  assert.equal(runnerCalls, 1);
  assert.equal(result.validationLevel, 'segment-valid');
});

test('rejects an HLS candidate when ffprobe reports errors', async (t) => {
  const fixture = await fixtureServer();
  t.after(() => fixture.server.close());
  await assert.rejects(
    () => validateMediaCandidate({
      url: `${fixture.base}/master.m3u8`,
      observedFrom: { type: 'page', url: `${fixture.base}/page` }
    }, {
      fetcher: (url, options) => fetch(url, { ...options, redirect: 'manual' }),
      ffprobeRunner: async () => ({ status: 'invalid', reason: 'HTTP error 404 Not Found' })
    }),
    /ffprobe/i
  );
});

test('skips ffprobe validation when useFfprobe is false', async (t) => {
  const fixture = await fixtureServer();
  t.after(() => fixture.server.close());
  let runnerCalls = 0;
  const result = await validateMediaCandidate({
    url: `${fixture.base}/master.m3u8`,
    observedFrom: { type: 'page', url: `${fixture.base}/page` }
  }, {
    fetcher: (url, options) => fetch(url, { ...options, redirect: 'manual' }),
    segmentSampleCount: 1,
    useFfprobe: false,
    ffprobeRunner: async () => {
      runnerCalls += 1;
      return { status: 'valid' };
    }
  });
  assert.equal(runnerCalls, 0);
  assert.equal(result.validationLevel, 'segment-valid');
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

test('bounds MP4 validation when the server ignores Range and streams forever', { timeout: 5000 }, async (t) => {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'video/mp4' });
    response.write(Buffer.from([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]));
    const timer = setInterval(() => { response.write(Buffer.alloc(1024)); }, 5);
    request.on('close', () => { clearInterval(timer); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections?.(); server.close(); });
  const result = await validateMediaCandidate({ url: `http://127.0.0.1:${server.address().port}/video.mp4` }, {
    fetcher: (url, options) => fetch(url, { ...options, redirect: 'manual' }),
    accessProbeTimeoutMs: 500
  });
  assert.equal(result.mediaType, 'mp4');
  assert.equal(result.validationLevel, 'http-valid');
});

test('classifies header-gated and session-gated access requirements', async (t) => {
  const fixture = await fixtureServer();
  t.after(() => fixture.server.close());
  const fetcher = (url, options) => fetch(url, { ...options, redirect: 'manual' });
  const headered = await validateMediaCandidate({
    url: `${fixture.base}/refer.mp4`,
    requestContext: { referer: 'https://source.example/page' }
  }, { fetcher });
  assert.equal(headered.accessRequirement, 'headers');
  assert.deepEqual(headered.requestContext.requiredHeaderNames, ['referer']);
  await assert.rejects(
    () => validateMediaCandidate({ url: `${fixture.base}/auth.mp4` }, { fetcher }),
    /authenticated session/i
  );
});

test('validates DASH by sampling an initialization segment', async (t) => {
  const fixture = await fixtureServer();
  t.after(() => fixture.server.close());
  let initRequests = 0;
  const result = await validateMediaCandidate({
    url: `${fixture.base}/manifest.mpd`,
    observedFrom: { type: 'page', url: `${fixture.base}/page` }
  }, {
    fetcher: (url, options) => {
      if (url.endsWith('/init-video-1.m4s')) initRequests += 1;
      return fetch(url, { ...options, redirect: 'manual' });
    }
  });
  assert.equal(result.mediaType, 'dash');
  assert.equal(result.validationLevel, 'segment-valid');
  assert.equal(initRequests, 1);
});
