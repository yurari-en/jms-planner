#!/usr/bin/env node
// public/data/items.json に載っている装備のアイコンPNGを maplestory.io から取得して
// public/icons/items/{id}.png に保存する(既にあるファイルはスキップ)。
//   node scripts/fetch-icons.mjs [--version 419]
// エンドポイント: GET https://maplestory.io/api/JMS/{ver}/item/{id}/icon  (image/png, 2026-10-12 確認)
// 追加で UI 用アイコン(キューブ・転生の炎)も public/icons/ui/{name}.png に保存し、
// 同じ画像を public/icons/items/{id}.png にも置く(cubes.json の itemIdIcon がそのまま解決できるように)。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../public');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const VER = arg('--version', '419');
const CONCURRENCY = 6;

// UIアイコン(JMSのアイテムID。2026-10-12 に maplestory.io JMS v419 で名称確認)
const UI_ICONS = {
  'cube-red': 5062009,          // レッドキューブ
  'cube-black': 5062010,        // ブラックキューブ(メガキューブのアイコン代替)
  'cube-neo': 5062018,          // ネオミラクルキューブ(現ネオキューブ)
  'cube-additional': 5062500,   // マスターアディショナルミラクルキューブ(ネオアディショナルの代替)
  'cube-white-additional': 5062503, // ホワイトアディショナルキューブ
  'flame-powerful': 2048716,    // 強力な転生の炎
  'flame-eternal': 2048717,     // 永遠の転生の炎
  'flame-black': 2048753,       // 黒い転生の炎
};

async function save(url, file) {
  try { await fs.access(file); return 'skip'; } catch {}
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return 'missing';
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      await fs.writeFile(file, buf);
      return 'ok';
    } catch (e) { await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  return 'error';
}

async function main() {
  const { items } = JSON.parse(await fs.readFile(path.join(ROOT, 'data/items.json'), 'utf8'));
  await fs.mkdir(path.join(ROOT, 'icons/items'), { recursive: true });
  await fs.mkdir(path.join(ROOT, 'icons/ui'), { recursive: true });
  const stats = {};
  const q = items.map((it) => it.id);
  let n = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (q.length) {
      const id = q.shift();
      const r = await save(`https://maplestory.io/api/JMS/${VER}/item/${id}/icon`, path.join(ROOT, `icons/items/${id}.png`));
      stats[r] = (stats[r] || 0) + 1;
      if (++n % 200 === 0) process.stdout.write(`\r${n}/${items.length}`);
    }
  }));
  for (const [name, id] of Object.entries(UI_ICONS)) {
    const uiFile = path.join(ROOT, `icons/ui/${name}.png`);
    const r = await save(`https://maplestory.io/api/JMS/${VER}/item/${id}/icon`, uiFile);
    stats[r] = (stats[r] || 0) + 1;
    // icons/items/{id}.png にも複製する(既にあればそのまま。ui 側が無ければ何もしない)
    const itemFile = path.join(ROOT, `icons/items/${id}.png`);
    try { await fs.access(itemFile); } catch {
      try { await fs.copyFile(uiFile, itemFile); stats.uiCopied = (stats.uiCopied || 0) + 1; } catch {}
    }
  }
  console.log('\n', stats);
}
main().catch((e) => { console.error(e); process.exit(1); });
