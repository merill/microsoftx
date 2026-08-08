#!/usr/bin/env node

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 4173);
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

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
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
