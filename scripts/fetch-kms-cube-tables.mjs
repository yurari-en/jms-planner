#!/usr/bin/env node
// KMS公式「확률형 아이템 > 큐브」の行別オプション確率表を取得し、
// public/data/potential/kms-cube-tables.json を生成する(開発時に手元で実行。CIでは実行しない)。
//
//   node scripts/fetch-kms-cube-tables.mjs            # 全取得(約4,000リクエスト / 0.25秒間隔 ≒ 20分)
//   node scripts/fetch-kms-cube-tables.mjs --quick    # Lv200/250帯・レジェ/ユニークのみ(動作確認用)
//
// 2026-10-12 にブラウザ上で同じ手順(POST /Guide/OtherProbability/cube/GetSearchProbList)を実行し、
// レッド/ブラック/エディショナル × 4等級 × 19部位 × Lv100〜250 の取得・帯の境界検出が成功することを確認済み。
// 公開ページへのアクセスなので、間隔(SLEEP_MS)を短くしないこと。

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOption, restrictionGroup, PART_CODES, GRADE_CODES, CUBE_CODES } from './lib/potential-options.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/data/potential/kms-cube-tables.json');
const BASE = 'https://maplestory.nexon.com/Guide/OtherProbability/cube';
const SLEEP_MS = 250;
const QUICK = process.argv.includes('--quick');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cookie = '';

async function init() {
  const res = await fetch(`${BASE}/addi`, { headers: { 'User-Agent': 'Mozilla/5.0 (personal data build)' } });
  const set = res.headers.getSetCookie?.() ?? [];
  cookie = set.map((c) => c.split(';')[0]).join('; ');
  await res.text();
}

function unescapeHtml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// 返り値: null(その部位・Lv帯に表がない) | [line1Map, line2Map, line3Map]  (Map: 文言→%)
function parse(html) {
  const parts = html.split(/<th>(?:첫|두|세) 번째 옵션<\/th>/).slice(1);
  if (!parts.length) return null;
  const out = parts.map((p) => {
    const d = {};
    for (const m of p.matchAll(/<td>([^<]+)<\/td>\s*<td>([\d.]+)%<\/td>/g)) {
      const k = unescapeHtml(m[1]).trim();
      d[k] = (d[k] || 0) + parseFloat(m[2]); // 公式表は下位等級分と同等級分を同じ文言で別行に載せる → 加算
    }
    return d;
  });
  if (out.length !== 3) throw new Error(`表の数が3ではありません: ${out.length}`);
  for (const d of out) {
    const sum = Object.values(d).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.05) throw new Error(`行の確率合計が100%ではありません: ${sum}`);
  }
  return out;
}

async function getTable(cubeId, grade, part, lv) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const body = new URLSearchParams({ nCubeItemID: cubeId, nGrade: String(grade), nPartsType: String(part), nReqLev: String(lv) });
      const res = await fetch(`${BASE}/GetSearchProbList`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Referer: `${BASE}/addi`,
          Cookie: cookie,
          'User-Agent': 'Mozilla/5.0 (personal data build)',
        },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await sleep(SLEEP_MS);
      return parse(html);
    } catch (e) {
      console.warn(`retry ${attempt + 1}: cube=${cubeId} g=${grade} p=${part} lv=${lv}: ${e.message}`);
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`取得失敗: cube=${cubeId} g=${grade} p=${part} lv=${lv}`);
}

async function main() {
  await init();
  const levels = QUICK ? [200, 250] : (() => { const a = []; for (let l = 100; l <= 250; l += 10) a.push(l); a.splice(a.indexOf(210), 0, 201); return a; })();
  const grades = QUICK ? [3, 4] : [1, 2, 3, 4];
  const options = []; const optIndex = new Map();
  const lineDists = []; const lineIndex = new Map();
  const optId = (kr) => {
    if (!optIndex.has(kr)) { optIndex.set(kr, options.length); options.push({ id: options.length, ...normalizeOption(kr), group: restrictionGroup(kr) }); }
    return optIndex.get(kr);
  };
  const lineId = (d) => {
    const enc = Object.entries(d).map(([k, p]) => [optId(k), Math.round(p * 1e6) / 1e6]);
    const s = JSON.stringify(enc);
    if (!lineIndex.has(s)) { lineIndex.set(s, lineDists.length); lineDists.push(enc); }
    return lineIndex.get(s);
  };
  const tables = {};
  for (const [cubeKey, cubeId] of Object.entries(CUBE_CODES)) {
    for (const g of grades) {
      for (const [code, part] of Object.entries(PART_CODES)) {
        const key = `${cubeKey}/${GRADE_CODES[g]}/${part}`;
        const bands = []; let prev = null; let prevLv = null;
        for (const lv of levels) {
          const t = await getTable(cubeId, g, +code, lv);
          const s = JSON.stringify(t);
          if (s !== prev) {
            let minLv = lv;
            if (prevLv !== null) { // 境界を二分探索で特定
              let lo = prevLv + 1, hi = lv;
              while (lo < hi) { const mid = (lo + hi) >> 1; const tm = await getTable(cubeId, g, +code, mid); if (JSON.stringify(tm) === s) hi = mid; else lo = mid + 1; }
              minLv = lo;
            } else minLv = 0; // 最初の帯は「Lv100以下も含む」とみなす(Lv100未満は対象外)
            bands.push({ minLv, lines: t ? t.map(lineId) : null });
            prev = s;
          }
          prevLv = lv;
        }
        tables[key] = bands;
        process.stdout.write(`\r${key}                       `);
      }
    }
  }
  const json = {
    meta: {
      source: `${BASE}/GetSearchProbList (red=5062009, black=5062010, additional=5062500)`,
      asOf: new Date().toISOString().slice(0, 10),
      note: 'KMS公式の行別確率(%)。lines[i] は lineDists のインデックス。band は minLv 以上〜次の band の minLv 未満。JMSは非公開のためKMS基準。',
      quick: QUICK,
    },
    options, lineDists, tables,
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(json));
  console.log(`\nsaved ${OUT} options=${options.length} lineDists=${lineDists.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
