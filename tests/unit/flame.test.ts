import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { FlameMaster } from '../../src/data/types';
import { EMPTY_FLAME, type FlameState } from '../../src/domain/character';
import {
  flameDelta,
  flameEfficiency,
  flameLineValues,
  flamePool,
  flameScore,
  lineCountDistribution,
  normalizeWeights,
  scoreDistributionDP,
  scoreDistributionEnum,
  tierDistribution,
  weaponFlameAtt,
  type FlameEquip,
  type FlameKindKey,
  type FlameValueKey,
  type FlameWeights,
} from '../../src/domain/flame';

const here = path.dirname(fileURLToPath(import.meta.url));
const fm = JSON.parse(
  fs.readFileSync(path.resolve(here, '../../public/data/flame.json'), 'utf8'),
) as FlameMaster;
interface ExpectedRow {
  L: number;
  flame: string;
  mean: number;
  [k: string]: number | string;
}
const expected = JSON.parse(
  fs.readFileSync(path.resolve(here, '../reference/flame_expected.json'), 'utf8'),
) as ExpectedRow[];

const sumP = (d: Map<number, number>): number => [...d.values()].reduce((a, b) => a + b, 0);
const meanOf = (d: Map<number, number>): number =>
  [...d.entries()].reduce((a, [k, p]) => a + k * p, 0);
const pAtLeast = (d: Map<number, number>, t: number): number =>
  [...d.entries()].reduce((a, [k, p]) => (k >= t ? a + p : a), 0);

describe('weaponFlameAtt', () => {
  it.each(fm.weaponFormulaChecks.map((c) => [c.item, c] as const))(
    '%s の段階3〜7が一致する',
    (_name, c) => {
      const got = [3, 4, 5, 6, 7].map((s) => weaponFlameAtt(c.B, c.L, s, true));
      expect(got).toEqual(c.tiers3to7);
    },
  );

  it('アブソ銃 段階4 = 33(ceil。floor+1 ではない)', () => {
    expect(weaponFlameAtt(150, 160, 4, true)).toBe(33);
  });

  it('非ボス武器: 1.1^(min(s,5)-1)', () => {
    // Fafnir L150 B86, s=1: ceil(86*4*1/100) = 4
    expect(weaponFlameAtt(86, 150, 1, false)).toBe(4);
    // s=6 は 1.1^4 で頭打ち: ceil(86*4*6*14641/1000000) = ceil(30.219...) = 31
    expect(weaponFlameAtt(86, 150, 6, false)).toBe(31);
  });

  it('魔力は baseMatt>0 ならそれを、なければ baseAtt を使う', () => {
    const eq: FlameEquip = { lv: 200, weapon: true, boss: true, baseAtt: 326, baseMatt: 0 };
    expect(flameLineValues('MATT', 5, eq)).toEqual({ MATT: 119 });
    expect(flameLineValues('MATT', 5, { ...eq, baseMatt: 249 })).toEqual({ MATT: 91 });
  });
});

describe('flameLineValues', () => {
  const armor: FlameEquip = { lv: 250, weapon: false, boss: true, baseAtt: 0, baseMatt: 0 };
  it('単一/複合/防具攻撃/各%/HP/無効行', () => {
    expect(flameLineValues('STR', 7, armor)).toEqual({ STR: 12 * 7 });
    expect(flameLineValues('DEX_LUK', 7, armor)).toEqual({ DEX: 7 * 7, LUK: 7 * 7 });
    expect(flameLineValues('ATT', 6, armor)).toEqual({ ATT: 6 });
    expect(flameLineValues('ALL_STAT_P', 5, armor)).toEqual({ AS: 5 });
    expect(flameLineValues('BOSS_DMG', 5, armor)).toEqual({ BOSS: 10 });
    expect(flameLineValues('DMG', 5, armor)).toEqual({ DMG: 5 });
    expect(flameLineValues('HP', 2, { ...armor, lv: 160 })).toEqual({ HP: 960 });
    for (const o of ['REQ_LV', 'DEF', 'SPEED', 'JUMP', 'MP'] as const) {
      expect(flameLineValues(o, 5, armor)).toEqual({});
    }
  });
});

describe('抽選ルール', () => {
  it('flamePool のレベル制限', () => {
    const a50 = flamePool(fm, { lv: 50, weapon: false, boss: false, baseAtt: 0, baseMatt: 0 });
    expect(a50).not.toContain('ATT');
    expect(a50).not.toContain('MATT');
    expect(a50).not.toContain('ALL_STAT_P');
    expect(a50).toHaveLength(16);
    const w80 = flamePool(fm, { lv: 80, weapon: true, boss: false, baseAtt: 50, baseMatt: 0 });
    expect(w80).not.toContain('BOSS_DMG');
    expect(w80).toContain('DMG');
    const a200 = flamePool(fm, { lv: 200, weapon: false, boss: true, baseAtt: 0, baseMatt: 0 });
    expect(a200).toHaveLength(19);
  });

  it('tierDistribution / lineCountDistribution', () => {
    expect(tierDistribution(fm, 'eternal', true)).toEqual([
      [4, 0.29],
      [5, 0.45],
      [6, 0.25],
      [7, 0.01],
    ]);
    expect(tierDistribution(fm, 'black', true)).toEqual(tierDistribution(fm, 'eternal', true));
    expect(tierDistribution(fm, 'powerful', false).map(([s]) => s)).toEqual([1, 2, 3, 4]);
    expect(tierDistribution(fm, 'drop', false)).toHaveLength(5);
    expect(lineCountDistribution(fm, true)).toEqual([[4, 1]]);
    expect(lineCountDistribution(fm, false)).toEqual([
      [1, 0.4],
      [2, 0.4],
      [3, 0.16],
      [4, 0.04],
    ]);
  });
});

describe('scoreDistributionDP vs flame_expected.json (Python 全列挙)', () => {
  const W: FlameWeights = { STR: 1, ATT: 4, AS: 10 };
  it.each(expected.map((r) => [r.L, r.flame, r] as const))('L%d %s', (L, flame, row) => {
    const eq: FlameEquip = { lv: L, weapon: false, boss: true, baseAtt: 0, baseMatt: 0 };
    const d = scoreDistributionDP(fm, eq, flame as FlameKindKey, W);
    expect(Math.abs(sumP(d) - 1)).toBeLessThan(1e-9);
    expect(Math.abs(meanOf(d) - row.mean)).toBeLessThanOrEqual(0.005 + 1e-9);
    for (const t of [100, 120, 140]) {
      const ref = row[`P>=${t}`];
      expect(typeof ref).toBe('number');
      expect(Math.abs(pAtLeast(d, t) - (ref as number))).toBeLessThanOrEqual(5e-7 + 1e-9);
    }
  });
});

describe('DP と全列挙の一致', () => {
  const KEYS: FlameValueKey[] = [
    'STR',
    'DEX',
    'INT',
    'LUK',
    'ATT',
    'MATT',
    'AS',
    'BOSS',
    'DMG',
    'HP',
  ];
  // 決定的な小さな LCG
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const weightSets: FlameWeights[] = [];
  for (let i = 0; i < 10; i++) {
    const w: FlameWeights = {};
    for (const k of KEYS) {
      const v = Math.floor(rnd() * 6); // 0..5
      if (rnd() < 0.6) w[k] = k === 'HP' ? v / 100 : v; // HP は桁が大きいので縮める
    }
    weightSets.push(w);
  }
  const configs: [string, FlameEquip, FlameKindKey][] = [
    [
      'armor boss L200 eternal',
      { lv: 200, weapon: false, boss: true, baseAtt: 0, baseMatt: 0 },
      'eternal',
    ],
    [
      'armor non-boss L160 powerful',
      { lv: 160, weapon: false, boss: false, baseAtt: 0, baseMatt: 0 },
      'powerful',
    ],
    [
      'weapon boss L200 B326 eternal',
      { lv: 200, weapon: true, boss: true, baseAtt: 326, baseMatt: 0 },
      'eternal',
    ],
    [
      'weapon non-boss L150 B86 powerful',
      { lv: 150, weapon: true, boss: false, baseAtt: 86, baseMatt: 0 },
      'powerful',
    ],
  ];

  it.each(configs)('%s × 10 重み', (_name, eq, kind) => {
    for (const w of weightSets) {
      const dp = scoreDistributionDP(fm, eq, kind, w);
      const en = scoreDistributionEnum(fm, eq, kind, w);
      expect(Math.abs(sumP(dp) - 1)).toBeLessThan(1e-9);
      expect(Math.abs(sumP(en) - 1)).toBeLessThan(1e-9);
      const keys = new Set([...dp.keys(), ...en.keys()]);
      for (const k of keys) {
        const diff = Math.abs((dp.get(k) ?? 0) - (en.get(k) ?? 0));
        if (diff >= 1e-9) throw new Error(`key ${k}: dp=${dp.get(k)} enum=${en.get(k)}`);
      }
    }
  });
});

describe('flameEfficiency', () => {
  it('toy 分布', () => {
    const d = new Map([
      [0, 0.5],
      [10, 0.3],
      [20, 0.2],
    ]);
    const e = flameEfficiency(d, 5);
    expect(e.mean).toBeCloseTo(7, 12);
    expect(e.pImprove).toBeCloseTo(0.5, 12);
    expect(e.gainIfImprove).toBeCloseTo(9, 12);
    expect(e.expectedGain).toBeCloseTo(4.5, 12);
  });
  it('改善しない場合 gainIfImprove = 0', () => {
    const e = flameEfficiency(new Map([[3, 1]]), 3);
    expect(e).toEqual({ mean: 3, pImprove: 0, gainIfImprove: 0, expectedGain: 0 });
  });
});

describe('flameScore / flameDelta / normalizeWeights', () => {
  const f: FlameState = {
    ...EMPTY_FLAME,
    str: 100,
    dex: 20,
    int: 3,
    luk: 4,
    att: 30,
    matt: 7,
    allStatPct: 6,
    bossPct: 12,
    dmgPct: 5,
    hp: 900,
  };

  it('flameScore', () => {
    expect(flameScore(f, { STR: 1, ATT: 4, AS: 10 })).toBe(100 + 120 + 60);
    expect(flameScore(f, { MATT: 2, BOSS: 1, DMG: 1, HP: 0.01 })).toBeCloseTo(14 + 12 + 5 + 9, 9);
  });

  it('flameDelta (att / matt)', () => {
    const d = flameDelta(f, 'att');
    expect(d.flat).toEqual({ STR: 100, DEX: 20, INT: 3, LUK: 4 });
    expect(d.pct).toEqual({ STR: 6, DEX: 6, INT: 6, LUK: 6 });
    expect(d.nonPct).toEqual({ STR: 0, DEX: 0, INT: 0, LUK: 0 });
    expect(d.attFlat).toBe(30);
    expect(d.bossPct).toBe(12);
    expect(d.dmgPct).toBe(5);
    expect(d.hpFlat).toBe(900);
    expect(d.attPct).toBe(0);
    expect(d.critDmgPct).toBe(0);
    expect(flameDelta(f, 'matt').attFlat).toBe(7);
  });

  it('normalizeWeights は 0/undefined を落とす', () => {
    expect(normalizeWeights({ STR: 1, DEX: 0, ATT: undefined, AS: 10 })).toEqual({
      STR: 1,
      AS: 10,
    });
  });
});
