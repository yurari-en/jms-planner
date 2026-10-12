// 配布する public/data の実ファイルがスキーマを通ることを確認する(生成スクリプトの出力崩れを検出する)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cubeTablesSchema,
  cubesSchema,
  describeZodError,
  flameSchema,
  itemsSchema,
  jobsSchema,
  manifestSchema,
  starforceSchema,
} from '../../src/data/schemas';
import type { CubeTables, ItemsMaster } from '../../src/data/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../../public/data');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')) as unknown;

const files = [
  ['starforce.json', starforceSchema],
  ['cubes.json', cubesSchema],
  ['flame.json', flameSchema],
  ['jobs.json', jobsSchema],
  ['potential/kms-cube-tables.json', cubeTablesSchema],
  ['manifest.json', manifestSchema],
] as const;

describe('public/data の実ファイル', () => {
  for (const [file, schema] of files) {
    it(`${file} がスキーマを通る`, () => {
      const r = schema.safeParse(read(file));
      expect(r.success, r.success ? '' : describeZodError(r.error)).toBe(true);
    });
  }

  it('items.json がスキーマを通る(生成済みのとき)', () => {
    const p = path.join(dataDir, 'items.json');
    if (!fs.existsSync(p)) return; // まだ生成していない環境では省略
    const r = itemsSchema.safeParse(read('items.json'));
    expect(r.success, r.success ? '' : describeZodError(r.error, 10)).toBe(true);
    const items = (r.data as ItemsMaster).items;
    expect(items.length).toBeGreaterThan(1000);
    // 戦士の補助武器「メダル」が含まれている(勲章の除外に巻き込まれていない)
    expect(items.some((i) => i.slot === 'secondary' && i.sub === 'Medal')).toBe(true);
    // 名称・セット名に前後の空白や改行が混じっていない(maplestory.io の生データ対策)
    const untrimmed = (t: string | null) => t !== null && (t !== t.trim() || /[\r\n]/.test(t));
    expect(items.filter((i) => untrimmed(i.name) || untrimmed(i.setName)).map((i) => i.id)).toEqual(
      [],
    );
    // 一覧 API が返さない JMS 独自 ID 範囲(typeInfo が Unknown)を wz から補完できている
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get(1354309)).toMatchObject({
      name: '天魂降臨霊符',
      slot: 'secondary',
      sub: '霊符',
      tuc: 9,
    });
    expect(byId.get(1191103)).toMatchObject({
      name: 'ゴールドブロッサムエンブレム',
      slot: 'emblem',
    });
    expect(byId.get(1191101)).toMatchObject({
      name: 'ゴールドクレセントエンブレム',
      slot: 'emblem',
    });
    expect(byId.get(1722400)).toMatchObject({ name: 'アストラ狐玉', slot: 'secondary', lv: 200 });
    expect(items.filter((i) => i.slot === 'emblem').length).toBeGreaterThanOrEqual(40);
    // onlyUpgrade は wz では専用呪文書 ID の一覧ノード → 1 に変換できている。★不可の印は exGrade(成長システム)
    expect(byId.get(1114318)).toMatchObject({
      name: 'アウェイクリング',
      onlyUpgrade: 1,
      exGrade: 1,
      tuc: 3,
    });
    expect(byId.get(1212145)).toMatchObject({
      name: 'デスティニーシャイニングロッド',
      exGrade: 0,
      onlyUpgrade: 1,
      tuc: 9,
    });
    const exGradeCount = items.filter((i) => i.exGrade === 1).length;
    expect(exGradeCount).toBeGreaterThanOrEqual(1);
    // 2026-10-12 時点で 299 件(イベント成長武器・アウェイクリング等)。大きく増えたら判定の見直しを疑う
    expect(exGradeCount).toBeLessThanOrEqual(350);
    expect(byId.get(1113098)).toMatchObject({ tuc: 0 });
    expect(items.filter((i) => i.onlyUpgrade === 1).length).toBeGreaterThan(0);
    for (const id of [1354309, 1191103, 1191101, 1722400]) {
      const icon = path.resolve(here, '../../public/icons/items', `${id}.png`);
      expect(fs.existsSync(icon), `${id}.png が無い`).toBe(true);
    }
  });

  it('cubes.json: メル換算の既定はメルマーケット 1億メル = 130 ポイント', () => {
    const r = cubesSchema.safeParse(read('cubes.json'));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.currency.pointsPer100MMelDefault).toBe(130);
  });

  it('cubes.json の itemIdIcon に対応するアイコンが public/icons/items にある', () => {
    const r = cubesSchema.safeParse(read('cubes.json'));
    expect(r.success).toBe(true);
    if (!r.success) return;
    for (const cube of r.data.cubes) {
      const icon = path.resolve(here, '../../public/icons/items', `${cube.itemIdIcon}.png`);
      expect(fs.existsSync(icon), `${cube.itemIdIcon}.png が無い`).toBe(true);
    }
  });

  it('kms-cube-tables.json: 各行の確率合計が 100%、表のキーが揃っている', () => {
    const t = read('potential/kms-cube-tables.json') as CubeTables;
    for (const dist of t.lineDists) {
      const sum = dist.reduce((a, [, p]) => a + p, 0);
      expect(Math.abs(sum - 100)).toBeLessThan(0.05);
    }
    for (const key of ['black/legendary/weapon', 'additional/legendary/top', 'black/unique/hat']) {
      expect(t.tables[key]).toBeDefined();
    }
  });
});
