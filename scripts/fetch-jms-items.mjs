#!/usr/bin/env node
// JMS(日本版)の装備マスタを maplestory.io から生成する(開発時に手元で実行)。
//   node scripts/fetch-jms-items.mjs [--version 419] [--min-level 100]
// 出力: public/data/items.json
//
// 手順(2026-10-12 にブラウザ上で全エンドポイントの応答形式を確認済み):
//   1) GET /api/JMS/{ver}/item?overallCategoryFilter=Equip&cashFilter=false&minLevelFilter=100&maxLevelFilter=300
//      → [{id, name(日本語), requiredLevel, requiredJobs, typeInfo:{category, subCategory}}]  (Lv100以上 約4,200件)
//   2) GET /api/wz/JMS/{ver}/Character/{Folder} → children に "01004422.img" 形式で ID 一覧 → ID→フォルダ対応表
//   3) GET /api/wz/JMS/{ver}/Character/{Folder}/{8桁ID}.img/info → children(プロパティ名一覧)
//      GET .../info/{prop} → { value }   (必要なプロパティだけ取得する。/api/JMS/{ver}/item/{id} は1件約270KBと重いので使わない)
//   4) GET /api/wz/JMS/{ver}/Etc/SetItemInfo.img/{setItemID}/setItemName → セット名(日本語)
// maplestory.io は有志運営の無料API。並列数(CONCURRENCY)を上げすぎないこと。

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/data/items.json');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const VER = arg('--version', '419');
const MIN_LV = +arg('--min-level', '100');
const API = 'https://maplestory.io/api';
const CONCURRENCY = 6;

const EXCLUDE_SUB = new Set(['Medal', 'Badge', 'Totem', 'Mechanical Heart', 'Dragon Equipment', 'Mechanic Equipment', 'Mount']);
const FOLDERS = ['Accessory', 'Cap', 'Cape', 'Coat', 'Glove', 'Longcoat', 'Pants', 'Ring', 'Shield', 'Shoes', 'Weapon'];
const PROPS = ['reqLevel', 'bossReward', 'superiorEqp', 'setItemID', 'tuc', 'incSTR', 'incDEX', 'incINT', 'incLUK', 'incPAD', 'incMAD', 'incMHP', 'exceptUpgrade', 'onlyUpgrade', 'noPotential', 'fixedPotential', 'blockGoldHammer', 'cuttable', 'reqJob', 'only', 'equipTradeBlock'];

// maplestory.io subCategory → アプリの部位キー
function slotOf(it) {
  const s = it.typeInfo.subCategory; const c = it.typeInfo.category;
  const map = {
    Hat: 'hat', Top: 'top', Bottom: 'bottom', Overall: 'overall', Shoes: 'shoes', Glove: 'gloves', Cape: 'cape',
    Belt: 'belt', 'Shoulder Accessory': 'shoulder', 'Face Accessory': 'face', 'Eye Decoration': 'eye',
    Earrings: 'earrings', Ring: 'ring', Pendant: 'pendant', Emblem: 'emblem', 'Pocket Item': 'pocket', Shield: 'shield',
  };
  if (map[s]) return map[s];
  if (c === 'Secondary Weapon') return 'secondary';
  if (/Weapon/.test(c)) return 'weapon';
  return 'other';
}

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

async function pool(items, n, fn) {
  const q = [...items]; let done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (q.length) { const x = q.shift(); await fn(x); if (++done % 100 === 0) process.stdout.write(`\r${done}/${items.length}`); }
  }));
  process.stdout.write(`\r${done}/${items.length}\n`);
}

async function main() {
  const list = await getJson(`${API}/JMS/${VER}/item?overallCategoryFilter=Equip&cashFilter=false&minLevelFilter=${MIN_LV}&maxLevelFilter=300`);
  const items = list.filter((it) => !EXCLUDE_SUB.has(it.typeInfo.subCategory));
  console.log(`list: ${list.length} → 対象 ${items.length}`);

  const want = new Set(items.map((i) => i.id)); const folderOf = {};
  for (const f of FOLDERS) {
    const x = await getJson(`${API}/wz/JMS/${VER}/Character/${f}`);
    for (const c of x?.children ?? []) { const id = parseInt(c, 10); if (want.has(id)) folderOf[id] = f; }
  }
  console.log(`folder mapped: ${Object.keys(folderOf).length}`);

  const meta = {};
  await pool(items.filter((i) => folderOf[i.id]), CONCURRENCY, async (it) => {
    const base = `${API}/wz/JMS/${VER}/Character/${folderOf[it.id]}/${String(it.id).padStart(8, '0')}.img/info`;
    const info = await getJson(base);
    const o = {};
    for (const p of (info?.children ?? []).filter((c) => PROPS.includes(c))) {
      const v = await getJson(`${base}/${p}`);
      o[p] = v?.value;
    }
    meta[it.id] = o;
  });

  const setIds = [...new Set(Object.values(meta).map((m) => m.setItemID).filter(Boolean))];
  const setNames = {};
  await pool(setIds, CONCURRENCY, async (sid) => {
    const v = await getJson(`${API}/wz/JMS/${VER}/Etc/SetItemInfo.img/${sid}/setItemName`);
    if (v?.value) setNames[sid] = v.value;
  });

  const out = items.map((it) => {
    const m = meta[it.id] ?? {};
    return {
      id: it.id,
      name: it.name,
      lv: m.reqLevel ?? it.requiredLevel,
      slot: slotOf(it),
      sub: it.typeInfo.subCategory,
      jobs: it.requiredJobs,
      boss: m.bossReward ? 1 : 0,
      superior: m.superiorEqp ? 1 : 0,
      setId: m.setItemID ?? null,
      setName: m.setItemID ? setNames[m.setItemID] ?? null : null,
      tuc: m.tuc ?? 0,
      onlyUpgrade: m.onlyUpgrade ? 1 : 0,
      exceptUpgrade: m.exceptUpgrade ? 1 : 0,
      noPotential: m.noPotential ? 1 : 0,
      base: {
        str: m.incSTR ?? 0, dex: m.incDEX ?? 0, int: m.incINT ?? 0, luk: m.incLUK ?? 0,
        att: m.incPAD ?? 0, matt: m.incMAD ?? 0, hp: m.incMHP ?? 0,
      },
    };
  }).filter((x) => x.slot !== 'other');

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({ meta: { source: `maplestory.io JMS v${VER}`, asOf: new Date().toISOString().slice(0, 10), minLevel: MIN_LV }, items: out }));
  console.log(`saved ${OUT} items=${out.length} sets=${Object.keys(setNames).length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
