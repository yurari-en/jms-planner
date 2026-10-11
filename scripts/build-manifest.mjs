#!/usr/bin/env node
// public/data 配下の JSON から manifest.json を作る(npm の prebuild で実行)。
// アプリは manifest.version をクエリに付けてデータを読む(更新時のキャッシュ対策)。
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '../public/data');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.json') && e.name !== 'manifest.json') out.push(p);
  }
  return out;
}

const files = {};
const all = crypto.createHash('sha256');
for (const f of (await walk(DIR)).sort()) {
  const buf = await fs.readFile(f);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  all.update(hash);
  let asOf = null;
  try { const j = JSON.parse(buf.toString('utf8')); asOf = j.meta?.asOf ?? j._meta?.asOf ?? null; } catch {}
  files[path.relative(DIR, f).replace(/\\/g, '/')] = { sha: hash, bytes: buf.length, asOf };
}
const manifest = { version: all.digest('hex').slice(0, 10), generatedAt: new Date().toISOString(), files };
await fs.writeFile(path.join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('manifest', manifest.version, Object.keys(files).length, 'files');
