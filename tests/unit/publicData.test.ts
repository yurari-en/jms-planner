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
    // 名称に前後の空白や改行が混じっていない(maplestory.io の生データ対策)
    expect(
      items.filter((i) => i.name !== i.name.trim() || /[\r\n]/.test(i.name)).map((i) => i.id),
    ).toEqual([]);
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
