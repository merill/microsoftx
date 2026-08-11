#!/usr/bin/env node

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 4173);
const sourceResolver = import('../src/learn-source-resolver.mjs');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function resolveFile(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  const relative = decoded.replace(/^\/+/, '');
  const candidates = [relative, path.join(relative, 'index.html')];
  for (const candidate of candidates) {
    const absolute = path.resolve(distDir, candidate);
    if (!absolute.startsWith(`${distDir}${path.sep}`) && absolute !== distDir) continue;
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) return absolute;
  }
  return path.join(distDir, 'index.html');
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(`${JSON.stringify(body)}\n`);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;
  if (pathname === '/api/resolve-source') {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }
    try {
      const { resolveLearnSource } = await sourceResolver;
      const result = await resolveLearnSource(requestUrl.searchParams.get('url'), fetch, AbortSignal.timeout(8000));
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, Number(error?.status) || 500, { error: error?.message || 'Microsoft Learn source lookup failed.' });
    }
    return;
  }
  const file = resolveFile(pathname);
  if (!file || !fs.existsSync(file)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Run npm run build first.');
    return;
  }
  response.writeHead(200, {
    'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Microsoft Docs X-Ray preview: http://127.0.0.1:${port}`);
});
