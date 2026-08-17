import http from 'node:http';

export async function startMediaFixture() {
  const server = http.createServer((request, response) => {
    if (request.url === '/master.m3u8') {
      response.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' });
      response.end('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n/media.m3u8\n');
    } else if (request.url === '/media.m3u8') {
      response.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' });
      response.end('#EXTM3U\n#EXTINF:4,\n/segment.ts\n');
    } else if (request.url === '/segment.ts') {
      response.writeHead(206, { 'content-type': 'video/mp2t', 'content-range': 'bytes 0-6/7' });
      response.end('segment');
    } else {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
