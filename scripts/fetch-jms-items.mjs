#!/usr/bin/env node
// JMS(日本版)の装備マスタを maplestory.io から生成する(開発時に手元で実行)。
//   node scripts/fetch-jms-items.mjs [--version 419] [--min-level 100] [--wz-folders Accessory,Weapon]
// 出力: public/data/items.json
//
// 手順(2026-10-12 にブラウザ上で全エンドポイントの応答形式を確認済み):
//   1) GET /api/JMS/{ver}/item?overallCategoryFilter=Equip&cashFilter=false&minLevelFilter=100&maxLevelFilter=300
//      → [{id, name(日本語), requiredLevel, requiredJobs, typeInfo:{category, subCategory}}]  (Lv100以上 約4,200件)
//   2) GET /api/wz/JMS/{ver}/Character/{Folder} → children に "01004422.img" 形式で ID 一覧 → ID→フォルダ対応表
//   3) GET /api/wz/JMS/{ver}/Character/{Folder}/{8桁ID}.img/info → children(プロパティ名一覧)
//      GET .../info/{prop} → { value }   (必要なプロパティだけ取得する。/api/JMS/{ver}/item/{id} は1件約270KBと重いので使わない)
//   4) 一覧 API の補完(WZ_SUPPLEMENT_FOLDERS = Accessory, Weapon。--wz-folders で変更可):
//      一覧 API は typeInfo が Unknown になる JMS 独自の ID 範囲(カンナの霊符 1354300〜、エンブレム 1190500〜、
//      Lv200 補助武器 1722400〜 など)を返さない(2026-10-12 確認)。そこで wz のフォルダ一覧にあって一覧 API に無い ID を
//      安い順に調べる: 部位(ID から判定・通信なし) → info/cash(1 なら除外) → info/reqLevel(MIN_LV 未満は除外)
//      → GET /api/wz/JMS/{ver}/String/Eqp.img/Eqp/{Folder}/{id}/name(空なら除外)。残ったものは 3) と同じ手順で
//      プロパティを取り、同じ形のレコードにする。cash / reqLevel の結果は scripts/.cache/wz-probe-{ver}.json に
//      保存して再実行時に使う(3) のプロパティも scripts/.cache/wz-props-{ver}.json に保存)。(防具フォルダの欠けはすべてキャッシュアイテムだったので補完対象外。2026-10-12 確認)
//   5) GET /api/wz/JMS/{ver}/Etc/SetItemInfo.img/{setItemID}/setItemName → セット名(日本語)
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
const WZ_SUPPLEMENT_FOLDERS = arg('--wz-folders', 'Accessory,Weapon').split(',').map((x) => x.trim()).filter(Boolean);
const CACHE = path.resolve(__dirname, `.cache/wz-probe-${VER}.json`);
const PROPS_CACHE = path.resolve(__dirname, `.cache/wz-props-${VER}.json`);

const EXCLUDE_SUB = new Set(['Badge', 'Totem', 'Mechanical Heart', 'Dragon Equipment', 'Mechanic Equipment', 'Mount']);
// 'Medal' は勲章(Accessory)と戦士の補助武器「メダル」(Secondary Weapon)の両方に付くので、勲章だけ除外する
const isExcluded = (it) => EXCLUDE_SUB.has(it.typeInfo.subCategory) || (it.typeInfo.subCategory === 'Medal' && it.typeInfo.category !== 'Secondary Weapon');
const FOLDERS = ['Accessory', 'Cap', 'Cape', 'Coat', 'Glove', 'Longcoat', 'Pants', 'Ring', 'Shield', 'Shoes', 'Weapon'];
const PROPS = ['reqLevel', 'bossReward', 'superiorEqp', 'setItemID', 'tuc', 'incSTR', 'incDEX', 'incINT', 'incLUK', 'incPAD', 'incMAD', 'incMHP', 'exceptUpgrade', 'onlyUpgrade', 'exGrade', 'noPotential', 'fixedPotential', 'blockGoldHammer', 'cuttable', 'reqJob', 'only', 'equipTradeBlock'];

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

// 一覧 API に無い(wz 補完の)装備の部位を ID の上4桁(Math.floor(id / 10000))から決める。対象外の部位は null。
//   114 勲章 / 117 バッジ / 118 / 170 キャッシュ武器 / 171 などは対象外。
//   172 は Lv200 補助武器(アストラ狐玉など、2026-10-12 確認)。
function slotFromId(id) {
  const b = Math.floor(id / 10000);
  const map = {
    100: 'hat', 101: 'face', 102: 'eye', 103: 'earrings', 104: 'top', 105: 'overall', 106: 'bottom', 107: 'shoes',
    108: 'gloves', 109: 'shield', 110: 'cape', 111: 'ring', 112: 'pendant', 113: 'belt', 115: 'shoulder', 116: 'pocket',
    119: 'emblem', 135: 'secondary', 172: 'secondary',
  };
  if (map[b]) return map[b];
  if (b >= 120 && b <= 169) return 'weapon';
  return null;
}

// 一覧 API に分類が無い JMS 独自の補助武器の種別名。
// 引く順番: 100 単位のブロック(id - id % 100)の表 → 10 単位のブロック(id - id % 10)の表 → 武器の 1000 単位の表
const JMS_SUB_100 = { 1354300: '霊符', 1353800: '飾り房' };
const JMS_SUB_10 = { 1354000: 'ブレスレット', 1354010: 'ウェポンベルト', 1354020: '四玉飾り', 1354030: 'ヘックスシーカー', 1354040: '如意宝珠' };
// 武器(1000 単位): 1254xxx はカンナの武器「扇」(陰陽の扇など)
const JMS_SUB_1000 = { 1254000: '扇' };
// 強化可能回数 0 でも潜在が付く装備(ゲーム内で確認済みの例外。equip.ts の潜在可否判定で使う)
const JMS_POTENTIAL_OK = { 1114324: 'エターナルフレイムリング(ユーザー確認 2026-10-12)' };

// reqJob のビットマスク → 一覧 API の requiredJobs と同じ形式(0/なし = Beginner = 全職)
const JOB_BITS = [[1, 'Warrior'], [2, 'Magician'], [4, 'Bowman'], [8, 'Thief'], [16, 'Pirate']];
function jobsFromMask(mask) {
  const m = mask ?? 0;
  if (m <= 0) return ['Beginner'];
  const jobs = JOB_BITS.filter(([b]) => m & b).map(([, n]) => n);
  return jobs.length ? jobs : ['Beginner'];
}

// wz のプロパティ値は数値でも文字列("123")で返ることがある → 数値に正規化(数値にできなければ undefined)
function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

// maplestory.io の名称に末尾の改行・空白が混じるので、空白類を1つの空白にまとめて前後を削る
function normName(s) {
  return String(s).replace(/[\r\n\t ]+/g, ' ').trim();
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

// 値ではなく子ノードの一覧で入っていることがあるフラグ系プロパティ。
//   onlyUpgrade は「使える専用強化アイテム(書)の ID の一覧」(専用呪文書のみ。★可否とは無関係で、デスティニー武器も持つ。
//   例: 1114318 アウェイクリングは
//   children ["0".."9"]・value なし。2026-10-12 確認)なので、子ノードがあれば 1 とみなす。
const LIST_FLAG_PROPS = new Set(['onlyUpgrade', 'exceptUpgrade', 'noPotential', 'exGrade']);

// wz の info から PROPS にあるプロパティだけ取得する(一覧 API の装備と wz 補完分で共通)
async function fetchProps(folder, id) {
  const cached = propsCache.items[id];
  if (cached) return cached;
  const base = `${API}/wz/JMS/${VER}/Character/${folder}/${String(id).padStart(8, '0')}.img/info`;
  const info = await getJson(base);
  const o = {};
  for (const p of (info?.children ?? []).filter((c) => PROPS.includes(c))) {
    const v = await getJson(`${base}/${p}`);
    const isList = v && v.value === undefined && Array.isArray(v.children) && v.children.length > 0;
    o[p] = isList && LIST_FLAG_PROPS.has(p) ? 1 : num(v?.value);
  }
  propsCache.items[id] = o;
  if (++propsCacheDirty % 500 === 0) await writeJson(PROPS_CACHE, propsCache);
  return o;
}

// プロパティ取得結果のキャッシュ(id → props)。PROPS や読み方を変えたら PROPS_SIG が変わって作り直しになる。
// 最新の wz で取り直したいときは scripts/.cache/ を消す。
const PROPS_SIG = `v2:${PROPS.join(',')}`;
let propsCache = { sig: PROPS_SIG, items: {} };
let propsCacheDirty = 0;
async function writeJson(file, obj) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(obj));
}

// wz 補完の調査結果キャッシュ(id → { cash, reqLevel })
async function readCache() {
  try { return JSON.parse(await fs.readFile(CACHE, 'utf8')); } catch { return {}; }
}
async function writeCache(c) {
  await fs.mkdir(path.dirname(CACHE), { recursive: true });
  await fs.writeFile(CACHE, JSON.stringify(c));
}

// wz 補完の装備の種別名: 一覧 API の同じブロックの装備から借りる → JMS_SUB_100 → JMS_SUB_10 → JMS_SUB_1000 → 'Unknown'
//   補助武器は同じ 100 単位のブロック(最多の subCategory)、武器は同じ 1000 単位、それ以外は同じ上4桁ブロックで
//   subCategory が1種類のときだけ
function subFor(id, slot, apiItems) {
  if (slot === 'secondary') {
    const h = id - (id % 100);
    const cnt = {};
    for (const it of apiItems) {
      if (it.id - (it.id % 100) === h && slotOf(it) === 'secondary') cnt[it.typeInfo.subCategory] = (cnt[it.typeInfo.subCategory] ?? 0) + 1;
    }
    const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];
  } else {
    // 武器は種類が 1000 単位(1252xxx スタッフ系、1254xxx 扇 など)で分かれるので、上4桁ブロックではなく 1000 単位で見る
    // (上4桁で見ると 1254xxx の扇が 1252xxx の Scepter と同じ扱いになる。2026-10-12 確認)
    const width = slot === 'weapon' ? 1000 : 10000;
    const blk = Math.floor(id / width);
    const subs = new Set(apiItems.filter((it) => Math.floor(it.id / width) === blk).map((it) => it.typeInfo.subCategory));
    if (subs.size === 1) return [...subs][0];
  }
  return JMS_SUB_100[id - (id % 100)] ?? JMS_SUB_10[id - (id % 10)] ?? JMS_SUB_1000[id - (id % 1000)] ?? 'Unknown';
}

async function main() {
  const list = await getJson(`${API}/JMS/${VER}/item?overallCategoryFilter=Equip&cashFilter=false&minLevelFilter=${MIN_LV}&maxLevelFilter=300`);
  // 一覧 API は同じ ID を2回返すことがある(1122262 / 1122263。内容は同一、2026-10-12 確認)ので先勝ちで重複を除く
  const seen = new Set();
  const items = list.filter((it) => !isExcluded(it) && !seen.has(it.id) && seen.add(it.id));
  console.log(`list: ${list.length} → 対象 ${items.length}`);

  const want = new Set(items.map((i) => i.id)); const folderOf = {}; const wzIds = {};
  for (const f of new Set([...FOLDERS, ...WZ_SUPPLEMENT_FOLDERS])) {
    const x = await getJson(`${API}/wz/JMS/${VER}/Character/${f}`);
    wzIds[f] = [];
    for (const c of x?.children ?? []) {
      const id = parseInt(typeof c === 'string' ? c : c?.name, 10);
      if (!Number.isFinite(id)) continue; // "_Canvas" など
      wzIds[f].push(id);
      if (want.has(id) && FOLDERS.includes(f)) folderOf[id] = f;
    }
  }
  console.log(`folder mapped: ${Object.keys(folderOf).length}`);

  try {
    const pc = JSON.parse(await fs.readFile(PROPS_CACHE, 'utf8'));
    if (pc?.sig === PROPS_SIG && pc.items) propsCache = pc;
  } catch { /* キャッシュなし */ }
  console.log(`props cache: ${Object.keys(propsCache.items).length} 件`);

  const meta = {};
  await pool(items.filter((i) => folderOf[i.id]), CONCURRENCY, async (it) => {
    meta[it.id] = await fetchProps(folderOf[it.id], it.id);
  });

  // ---- wz 補完: 一覧 API(除外前の全件)に無い ID を安い順に調べる
  const listIds = new Set(list.map((i) => i.id));
  const cache = await readCache();
  const stat = { probed: 0, cash: 0, lowLevel: 0, noName: 0, unsupportedSlot: 0, added: 0 };
  const extra = []; // { id, folder, name, slot }
  for (const f of WZ_SUPPLEMENT_FOLDERS) {
    const missing = [...new Set(wzIds[f] ?? [])].filter((id) => !listIds.has(id)).sort((a, b) => a - b);
    console.log(`wz ${f}: ${wzIds[f]?.length ?? 0} 件中 一覧 API に無い ${missing.length} 件`);
    let n = 0;
    await pool(missing, CONCURRENCY, async (id) => {
      const slot = slotFromId(id);
      if (!slot) { stat.unsupportedSlot++; return; }
      stat.probed++;
      const base = `${API}/wz/JMS/${VER}/Character/${f}/${String(id).padStart(8, '0')}.img/info`;
      const c = cache[id] ?? (cache[id] = {});
      if (!('cash' in c)) c.cash = num((await getJson(`${base}/cash`))?.value) ?? 0;
      if (c.cash === 1) { stat.cash++; return; }
      if (!('reqLevel' in c)) c.reqLevel = num((await getJson(`${base}/reqLevel`))?.value) ?? 0;
      if (++n % 500 === 0) await writeCache(cache);
      if (c.reqLevel < MIN_LV) { stat.lowLevel++; return; }
      const nm = await getJson(`${API}/wz/JMS/${VER}/String/Eqp.img/Eqp/${f}/${id}/name`);
      const name = nm?.value != null ? normName(nm.value) : '';
      if (!name) { stat.noName++; return; }
      meta[id] = await fetchProps(f, id);
      extra.push({ id, folder: f, name, slot });
    });
  }
  await writeCache(cache);
  await writeJson(PROPS_CACHE, propsCache);

  const setIds = [...new Set(Object.values(meta).map((m) => m.setItemID).filter(Boolean))];
  const setNames = {};
  await pool(setIds, CONCURRENCY, async (sid) => {
    const v = await getJson(`${API}/wz/JMS/${VER}/Etc/SetItemInfo.img/${sid}/setItemName`);
    if (v?.value) setNames[sid] = normName(v.value);
  });

  const out = items.map((it) => {
    const m = meta[it.id] ?? {};
    return {
      id: it.id,
      name: normName(it.name),
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
      // 装備固有の成長システムを持つ装備(アウェイクリング・コスモスリング等。★不可の判定に使う。2026-10-12 確認)
      exGrade: m.exGrade ? 1 : 0,
      exceptUpgrade: m.exceptUpgrade ? 1 : 0,
      noPotential: m.noPotential ? 1 : 0,
      ...(JMS_POTENTIAL_OK[it.id] ? { potentialOk: 1 } : {}),
      base: {
        str: m.incSTR ?? 0, dex: m.incDEX ?? 0, int: m.incINT ?? 0, luk: m.incLUK ?? 0,
        att: m.incPAD ?? 0, matt: m.incMAD ?? 0, hp: m.incMHP ?? 0,
      },
    };
  }).filter((x) => x.slot !== 'other');
  const apiCount = out.length;

  for (const e of extra.sort((a, b) => a.id - b.id)) {
    const m = meta[e.id] ?? {};
    out.push({
      id: e.id,
      name: e.name,
      lv: m.reqLevel ?? cache[e.id]?.reqLevel ?? 0,
      slot: e.slot,
      sub: subFor(e.id, e.slot, items),
      jobs: jobsFromMask(m.reqJob),
      boss: m.bossReward ? 1 : 0,
      superior: m.superiorEqp ? 1 : 0,
      setId: m.setItemID ?? null,
      setName: m.setItemID ? setNames[m.setItemID] ?? null : null,
      tuc: m.tuc ?? 0,
      onlyUpgrade: m.onlyUpgrade ? 1 : 0,
      // 装備固有の成長システムを持つ装備(アウェイクリング・コスモスリング等。★不可の判定に使う。2026-10-12 確認)
      exGrade: m.exGrade ? 1 : 0,
      exceptUpgrade: m.exceptUpgrade ? 1 : 0,
      noPotential: m.noPotential ? 1 : 0,
      ...(JMS_POTENTIAL_OK[e.id] ? { potentialOk: 1 } : {}),
      base: {
        str: m.incSTR ?? 0, dex: m.incDEX ?? 0, int: m.incINT ?? 0, luk: m.incLUK ?? 0,
        att: m.incPAD ?? 0, matt: m.incMAD ?? 0, hp: m.incMHP ?? 0,
      },
    });
    stat.added++;
  }
  console.log(`API 由来 ${apiCount} 件 / wz 補完: 調査 ${stat.probed} 件、除外 キャッシュ ${stat.cash}・Lv不足 ${stat.lowLevel}`
    + `・名称なし ${stat.noName}・対象外部位 ${stat.unsupportedSlot}、追加 ${stat.added} 件`);

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({ meta: { source: `maplestory.io JMS v${VER}`, asOf: new Date().toISOString().slice(0, 10), minLevel: MIN_LV }, items: out }));
  console.log(`saved ${OUT} items=${out.length} sets=${Object.keys(setNames).length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
