#!/usr/bin/env node
// 同梱シード: GitHub bat1120/maple-optimizer の engine/data/cube_tables.json
// (KMS公式 GetSearchProbList を 2026-10-11 に取得したもの。ブラック/エディショナル、Lv200以下・201以上の2帯)を
// アプリ形式 public/data/potential/kms-cube-tables.json に変換する。
// fetch-kms-cube-tables.mjs を実行すれば完全版(レッド・全部位・全Lv帯)で上書きされる。
//   node scripts/build-seed-cube-tables.mjs <path/to/cube_tables.json>
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOption, restrictionGroup } from './lib/potential-options.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/data/potential/kms-cube-tables.json');
const src = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));

const KIND = { 잠재: 'black', 에디: 'additional' };
const GRADE = { 레어: 'rare', 에픽: 'epic', 유니크: 'unique', 레전드리: 'legendary' };
const PART = { 무기: 'weapon', 엠블렘: 'emblem', 보조무기: 'secondary', 모자: 'hat', 상의: 'top', 하의: 'bottom', 신발: 'shoes', 장갑: 'gloves', 망토: 'cape', 벨트: 'belt', 어깨장식: 'shoulder', 얼굴장식: 'face', 눈장식: 'eye', 귀고리: 'earrings', 반지: 'ring', 펜던트: 'pendant' };
const BAND_MIN = { 200: 0, 250: 201 };

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
for (const [kk, grades] of Object.entries(src.tables)) {
  for (const [gk, parts] of Object.entries(grades)) {
    for (const [pk, bands] of Object.entries(parts)) {
      const key = `${KIND[kk]}/${GRADE[gk]}/${PART[pk]}`;
      tables[key] = Object.entries(bands)
        .map(([b, lines]) => ({ minLv: BAND_MIN[b], lines: lines.map(lineId) }))
        .sort((a, b) => a.minLv - b.minLv);
    }
  }
}
// 全身(overall)はシードに無い → 上着(top)の表で代用(完全版取得で解消)
for (const k of Object.keys(tables)) {
  if (k.endsWith('/top')) tables[k.replace('/top', '/overall')] = tables[k];
}

const json = {
  meta: {
    source: 'seed: github.com/bat1120/maple-optimizer engine/data/cube_tables.json (KMS公式 GetSearchProbList, as_of ' + src._as_of + ')',
    asOf: src._as_of,
    note: 'シード版: black/additional のみ、Lv帯は「〜200」「201〜」の2帯(〜200帯はLv120〜200で確認済み。帽子はLv119以下で値が異なる)。red(ネオキューブ)は未収録→アプリはblackで代用し警告表示。overallはtopで代用。scripts/fetch-kms-cube-tables.mjs で完全版に更新すること。',
    seed: true,
  },
  options, lineDists, tables,
};
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(json));
console.log(`saved ${OUT} options=${options.length} lineDists=${lineDists.length} tables=${Object.keys(tables).length}`);
