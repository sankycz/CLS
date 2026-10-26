// Zabalí obsah dist/ přímo do Cloudflare Workeru (.worker/worker.js).
// Aplikace je malá, takže nepotřebuje samostatné úložiště statických souborů.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

const DIST = 'dist';
const OUT_DIR = '.worker';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

const NO_CACHE = new Set(['/index.html', '/sw.js', '/manifest.webmanifest']);

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });

const files = {};
const hash = createHash('sha256');
for (const path of listFiles(DIST)) {
  const url = `/${relative(DIST, path).split(sep).join('/')}`;
  if (url === '/_headers') continue;
  const body = readFileSync(path);
  hash.update(body);
  const cache = NO_CACHE.has(url) ? 'no-cache' : url.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
  files[url] = [TYPES[extname(path)] ?? 'application/octet-stream', cache, body.toString('base64')];
}

const worker = `// Vygenerováno skriptem scripts/build-worker.mjs – neupravovat ručně.
const VERSION = ${JSON.stringify(hash.digest('hex').slice(0, 12))};
const FILES = ${JSON.stringify(files)};

const decoded = new Map();
const bodyOf = (path) => {
  if (!decoded.has(path)) {
    const binary = atob(FILES[path][2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    decoded.set(path, bytes);
  }
  return decoded.get(path);
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const { pathname } = new URL(request.url);
    let path = pathname === '/' ? '/index.html' : pathname;
    if (!FILES[path]) {
      // Cesty bez přípony obslouží SPA, chybějící soubory vrací 404.
      if (path.split('/').pop().includes('.')) return new Response('Not Found', { status: 404, headers: SECURITY_HEADERS });
      path = '/index.html';
    }
    const [type, cache] = FILES[path];
    const etag = \`"\${VERSION}"\`;
    const headers = { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': cache, ETag: etag };
    if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : bodyOf(path), { headers });
  },
};
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'worker.js'), worker);
console.log(`worker: ${Object.keys(files).length} souborů, ${(worker.length / 1024).toFixed(0)} kB`);
