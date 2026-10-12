#!/usr/bin/env node
// dist/ を GitHub Pages 相当の条件でローカル配信する(公開不要の検証用。Node 標準モジュールのみ)。
//   npm run build && npm run preview:static
//   VITE_BASE=/foo/ npm run build && VITE_BASE=/foo/ npm run preview:static
// GitHub Pages と同じく SPA フォールバック無し・ベースパス配下のみ配信するので、
// vite preview では隠れる 404(存在しないアイコン等)が検出できる。
// - ベースパス(既定 /jms-planner/)の外は 404。末尾スラッシュ無しのベースは 301 でベースへ転送。
// - 末尾が / のパスはその index.html を返す。存在しないファイルは 404(index.html は返さない)。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const BASE = process.env.VITE_BASE ?? '/jms-planner/';
const PORT = Number(process.env.PORT ?? 4174);

if (!BASE.startsWith('/') || !BASE.endsWith('/')) {
  console.error(`VITE_BASE は / で始まり / で終わる必要があります: ${BASE}`);
  process.exit(1);
}
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist がありません。先に npm run build を実行してください');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>404</h1>');
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  // ベースの末尾スラッシュ無し → ベースへ転送(Pages と同じ挙動)
  if (pathname + '/' === BASE) {
    res.writeHead(301, { Location: BASE });
    res.end();
    return;
  }
  if (!pathname.startsWith(BASE)) return notFound(res);

  let rel = pathname.slice(BASE.length);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(DIST, rel);
  // パストラバーサル対策: 解決後のパスが dist の中に留まること
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return notFound(res);

  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return notFound(res);
  }
  if (!stat.isFile()) return notFound(res);

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'max-age=600',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${PORT}${BASE}`);
  console.log(`配信元: ${DIST}(SPA フォールバック無し。Ctrl+C で終了)`);
});
