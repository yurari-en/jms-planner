import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  CubeDef,
  CubeTableKind,
  CubeTables,
  CubesMaster,
  Grade,
  LineDist,
  Part,
  PotOption,
} from '../../src/data/types';
import {
  cubesToGrade,
  enumerateTargets,
  evaluateCandidates,
  gradeIndex,
  probTarget,
  targetLines,
  targetSatisfied,
  usefulCategories,
  type GradeUpOptions,
  type ResolvedTable,
  type TargetCategory,
  type UsefulCategory,
} from '../../src/domain/potential';

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = <T>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.resolve(here, rel), 'utf8')) as T;

const T = readJson<CubeTables>('../fixtures/kms-cube-tables.seed.json');
const CUBES = readJson<CubesMaster>('../../public/data/cubes.json');
const EXPECTED = readJson<
  {
    desc: string;
    cube: string;
    grade: string;
    part: string;
    lv: number;
    need: Record<string, number>;
    prob: number;
  }[]
>('../reference/potential_expected.json');

function table(cube: string, grade: string, part: string, lv: number): LineDist[] | null {
  const bands = T.tables[`${cube}/${grade}/${part}`];
  if (!bands) return null;
  const b = bands.filter((x) => x.minLv <= lv).pop();
  if (!b?.lines) return null;
  return b.lines.map((i) => T.lineDists[i] as LineDist);
}
const mustTable = (cube: string, grade: string, part: string, lv: number): LineDist[] => {
  const t = table(cube, grade, part, lv);
  if (!t) throw new Error(`no table ${cube}/${grade}/${part}`);
  return t;
};

const cube = (id: string): CubeDef => {
  const c = CUBES.cubes.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return c;
};
const ORDER = CUBES.gradeOrder;
const opt = (o: Partial<PotOption> & Pick<PotOption, 'key' | 'value'>): PotOption => ({
  id: -1,
  ja: '',
  kr: '',
  group: null,
  ...o,
});

describe('probTarget(potential_ref.py と一致)', () => {
  // potential_ref.py の各ケースのカテゴリ定義(desc で振り分け)
  const ge =
    (key: string, v: number, stat?: string) =>
    (o: PotOption): boolean =>
      o.key === key && o.value >= v && (stat === undefined || o.stat === stat);
  function catsFor(desc: string): TargetCategory[] {
    if (desc.includes('ボス')) {
      return [
        { id: 'att', match: ge('attPct', 9) },
        { id: 'boss', match: ge('bossPct', 30) },
      ];
    }
    if (desc.includes('STR%')) return [{ id: 'main', match: ge('statPct', 9, 'STR') }];
    if (desc.includes('クール')) return [{ id: 'cdr', match: ge('cdrSec', 2) }];
    if (desc.includes('クリダメ')) return [{ id: 'cd', match: ge('critDmg', 8) }];
    if (desc.includes('攻撃力+')) return [{ id: 'att', match: ge('attFlat', 12) }];
    if (desc.includes('ユニーク')) return [{ id: 'att', match: ge('attPct', 6) }];
    return [{ id: 'att', match: ge('attPct', 9) }];
  }

  it('期待値ファイルに 12 ケースある', () => {
    expect(EXPECTED).toHaveLength(12);
  });

  for (const c of EXPECTED) {
    it(c.desc, () => {
      const lines = mustTable(c.cube, c.grade, c.part, c.lv);
      const p = probTarget(lines, T.options, catsFor(c.desc), c.need);
      expect(Math.abs(p - c.prob)).toBeLessThanOrEqual(1e-9);
    });
  }

  it('制限グループ maxOne は除外して再正規化する', () => {
    const options: PotOption[] = [
      opt({ id: 0, key: 'other', value: 1, group: 'maxOne' }),
      opt({ id: 1, key: 'other', value: 2 }),
    ];
    const line: LineDist = [
      [0, 50],
      [1, 50],
    ];
    const lines = [line, line, line];
    const cats: TargetCategory[] = [{ id: 'A', match: (o) => o.id === 0 }];
    expect(probTarget(lines, options, cats, { A: 1 })).toBeCloseTo(0.875, 12);
    expect(probTarget(lines, options, cats, { A: 2 })).toBe(0);
    expect(probTarget(lines, options, cats, {})).toBeCloseTo(1, 12);
  });
});

describe('cubesToGrade', () => {
  const plain: GradeUpOptions = {
    miracleTime: false,
    miracleMultiplier: CUBES.events.miracleTime.tierUpMultiplier,
    miracleApplies: true,
    useGuarantee: false,
  };
  const mega = cube('mega');

  it('gradeIndex: none は rare 扱い', () => {
    expect(gradeIndex('none', ORDER)).toBe(ORDER.indexOf('rare'));
    expect(gradeIndex('legendary', ORDER)).toBe(ORDER.indexOf('legendary'));
  });

  it('レア→レジェ = Σ 1/tierUp', () => {
    const e = 1 / mega.tierUp.rare + 1 / mega.tierUp.epic + 1 / mega.tierUp.unique;
    expect(cubesToGrade(mega, 'rare', 'legendary', ORDER, plain)).toBeCloseTo(e, 9);
    expect(cubesToGrade(mega, 'none', 'legendary', ORDER, plain)).toBeCloseTo(e, 9);
  });

  it('ミラクルタイム(適用あり)で半分、適用なしなら変わらない', () => {
    const base = cubesToGrade(mega, 'rare', 'legendary', ORDER, plain);
    const m = cubesToGrade(mega, 'rare', 'legendary', ORDER, { ...plain, miracleTime: true });
    expect(m).toBeCloseTo(base / CUBES.events.miracleTime.tierUpMultiplier, 9);
    const na = cubesToGrade(mega, 'rare', 'legendary', ORDER, {
      ...plain,
      miracleTime: true,
      miracleApplies: false,
    });
    expect(na).toBeCloseTo(base, 9);
  });

  it('保証あり ≤ 保証なし', () => {
    for (const id of ['neo', 'mega', 'neoAdditional']) {
      const c = cube(id);
      const g = cubesToGrade(c, 'rare', 'legendary', ORDER, { ...plain, useGuarantee: true });
      const n = cubesToGrade(c, 'rare', 'legendary', ORDER, plain);
      expect(g).toBeGreaterThan(0);
      expect(g).toBeLessThanOrEqual(n);
    }
  });

  it('none→rare = 0、同等級・下位 = 0、ユニーク→レジェ = 1/tierUp.unique', () => {
    expect(cubesToGrade(mega, 'none', 'rare', ORDER, plain)).toBe(0);
    expect(cubesToGrade(mega, 'legendary', 'unique', ORDER, plain)).toBe(0);
    expect(cubesToGrade(mega, 'unique', 'unique', ORDER, plain)).toBe(0);
    expect(cubesToGrade(mega, 'unique', 'legendary', ORDER, plain)).toBeCloseTo(
      1 / mega.tierUp.unique,
      9,
    );
  });
});

describe('usefulCategories', () => {
  const byId = (cats: UsefulCategory[], id: string) => cats.find((c) => c.id === id);
  const base = { mainStats: ['STR' as const], attackType: 'att' as const, includePerLv: false };

  it('武器 Lv200 レジェ(物理 STR)', () => {
    const cats = usefulCategories(mustTable('black', 'legendary', 'weapon', 200), T.options, {
      ...base,
      part: 'weapon',
      target: 'potential',
    });
    expect(cats.map((c) => c.id)).toEqual(['attPct', 'bossPct', 'mainPct']);
    expect(byId(cats, 'attPct')).toMatchObject({ key: 'attPct', threshold: 9 });
    expect(byId(cats, 'bossPct')).toMatchObject({ key: 'bossPct', threshold: 30 });
    expect(byId(cats, 'mainPct')).toMatchObject({ key: 'statPct', threshold: 9, stats: ['STR'] });
    const main = byId(cats, 'mainPct');
    expect(main?.match(opt({ key: 'statPct', stat: 'STR', value: 12 }))).toBe(true);
    expect(main?.match(opt({ key: 'statPct', stat: 'DEX', value: 12 }))).toBe(false);
    expect(main?.match(opt({ key: 'statPct', stat: 'STR', value: 6 }))).toBe(false);
  });

  it('魔法職は魔力%', () => {
    const cats = usefulCategories(mustTable('black', 'legendary', 'weapon', 200), T.options, {
      ...base,
      mainStats: ['INT'],
      attackType: 'matt',
      part: 'weapon',
      target: 'potential',
    });
    expect(byId(cats, 'attPct')).toMatchObject({ key: 'mattPct', threshold: 9, labelJa: '魔力%' });
  });

  it('ゼノンは STR/DEX/LUK を同じ主ステカテゴリに含める', () => {
    const cats = usefulCategories(mustTable('black', 'legendary', 'weapon', 200), T.options, {
      ...base,
      mainStats: ['STR', 'DEX', 'LUK'],
      part: 'weapon',
      target: 'potential',
    });
    const main = byId(cats, 'mainPct');
    expect(main?.match(opt({ key: 'statPct', stat: 'DEX', value: 9 }))).toBe(true);
    expect(main?.match(opt({ key: 'statPct', stat: 'INT', value: 9 }))).toBe(false);
  });

  it('帽子 Lv160 レジェ: 主ステ%・全ステ%・クール減 -1/-2', () => {
    const cats = usefulCategories(mustTable('black', 'legendary', 'hat', 160), T.options, {
      ...base,
      part: 'hat',
      target: 'potential',
    });
    expect(cats.map((c) => c.id)).toEqual(['mainPct', 'allStatPct', 'cdr1', 'cdr2']);
    expect(byId(cats, 'allStatPct')?.threshold).toBe(6);
    expect(byId(cats, 'cdr1')?.threshold).toBe(1);
    expect(byId(cats, 'cdr2')?.threshold).toBe(2);
    expect(byId(cats, 'cdr2')?.labelJa).toBe('クール減-2秒');
  });

  it('上着 Lv160 アディ レジェ: 攻撃力+・主ステ%・全ステ%、設定ONでレベルごと主ステ', () => {
    const lines = mustTable('additional', 'legendary', 'top', 160);
    const ctx = { ...base, part: 'top' as Part, target: 'additional' as const };
    const cats = usefulCategories(lines, T.options, ctx);
    expect(cats.map((c) => c.id)).toEqual(['attFlat', 'mainPct', 'allStatPct']);
    expect(byId(cats, 'attFlat')?.threshold).toBe(14);
    expect(byId(cats, 'mainPct')?.threshold).toBe(6);
    expect(byId(cats, 'allStatPct')?.threshold).toBe(5);
    const withLv = usefulCategories(lines, T.options, { ...ctx, includePerLv: true });
    expect(byId(withLv, 'perLv')).toMatchObject({ key: 'statPerLv', threshold: 1, per: 9 });
  });
});

describe('enumerateTargets / targetLines', () => {
  const lines = mustTable('black', 'legendary', 'weapon', 200);
  const ctx = {
    mainStats: ['STR' as const],
    attackType: 'att' as const,
    includePerLv: false,
    part: 'weapon' as Part,
    target: 'potential' as const,
  };
  const cats = usefulCategories(lines, T.options, ctx);

  it('3カテゴリで 18 目標', () => {
    const ts = enumerateTargets('legendary', cats);
    expect(ts).toHaveLength(18);
    expect(new Set(ts.map((t) => t.key)).size).toBe(18);
    for (const t of ts) {
      const total = t.parts.reduce((s, p) => s + p.count, 0);
      expect(total).toBeGreaterThanOrEqual(1);
      expect(total).toBeLessThanOrEqual(3);
      expect(t.parts.length).toBeLessThanOrEqual(2);
    }
    const t = ts.find((x) => x.key === 'legendary|attPct:2|bossPct:1');
    expect(t?.labelJa).toBe('レジェ / 攻撃力%×2 + ボス%×1');
  });

  it('cdr1 と cdr2 は同居しない', () => {
    const hatCats = usefulCategories(mustTable('black', 'legendary', 'hat', 160), T.options, {
      ...ctx,
      part: 'hat',
    });
    const ts = enumerateTargets('legendary', hatCats);
    expect(ts.some((t) => t.parts.some((p) => p.cat.id === 'cdr2'))).toBe(true);
    for (const t of ts) {
      const ids = t.parts.map((p) => p.cat.id);
      expect(ids.includes('cdr1') && ids.includes('cdr2')).toBe(false);
    }
  });

  it('targetLines はしきい値の合成オプション + null で長さ3', () => {
    const t = enumerateTargets('legendary', cats).find(
      (x) => x.key === 'legendary|attPct:1|mainPct:1',
    );
    if (!t) throw new Error('target');
    const tl = targetLines(t);
    expect(tl).toHaveLength(3);
    expect(tl[0]).toMatchObject({ id: -1, key: 'attPct', value: 9, group: null });
    expect(tl[1]).toMatchObject({ id: -1, key: 'statPct', stat: 'STR', value: 9 });
    expect(tl[2]).toBeNull();
  });
});

describe('targetSatisfied', () => {
  const cats = usefulCategories(mustTable('black', 'legendary', 'weapon', 200), T.options, {
    mainStats: ['STR'],
    attackType: 'att',
    includePerLv: false,
    part: 'weapon',
    target: 'potential',
  });
  const att = cats.find((c) => c.id === 'attPct') as UsefulCategory;
  const tgt = (grade: Grade, count: number) =>
    enumerateTargets(grade, [att]).find((t) => t.parts[0]?.count === count)!;
  const lines = [opt({ key: 'attPct', value: 12 }), opt({ key: 'attPct', value: 9 }), null];

  it('レジェ 攻%12/9 は 攻×2 を満たし 攻×3 を満たさない', () => {
    const cur = { grade: 'legendary' as const, lines: [1, 2, null] as [number, number, null] };
    expect(targetSatisfied(cur, lines, tgt('legendary', 2), ORDER)).toBe(true);
    expect(targetSatisfied(cur, lines, tgt('legendary', 3), ORDER)).toBe(false);
  });

  it('ユニークはレジェ目標を満たさない', () => {
    const cur = { grade: 'unique' as const, lines: [1, 2, null] as [number, number, null] };
    expect(targetSatisfied(cur, lines, tgt('legendary', 1), ORDER)).toBe(false);
  });

  it('上の等級はユニーク目標を満たす', () => {
    const cur = { grade: 'legendary' as const, lines: [1, null, null] as [number, null, null] };
    expect(targetSatisfied(cur, [lines[0] ?? null, null, null], tgt('unique', 1), ORDER)).toBe(
      true,
    );
  });
});

describe('evaluateCandidates', () => {
  const resolveTable = (kind: CubeTableKind, grade: Grade): ResolvedTable | null => {
    const fallbackCube = kind === 'red';
    const lines = table(fallbackCube ? 'black' : kind, grade, 'weapon', 200);
    return lines ? { lines, options: T.options, fallbackCube, fallbackPart: false } : null;
  };
  const gainOf = (newLines: (PotOption | null)[]): number => {
    let g = 0;
    for (const o of newLines) {
      if (!o) continue;
      if (o.key === 'attPct') g += o.value * 100;
      if (o.key === 'bossPct') g += o.value * 10;
      if (o.key === 'statPct') g += o.value * 50;
    }
    return g;
  };
  const cubes = ['neo', 'mega'].map((id) => {
    const def = cube(id);
    return { def, setting: { enabled: true, priceNP: def.defaultPriceNP } };
  });
  const run = () =>
    evaluateCandidates({
      current: { grade: 'unique', lines: [null, null, null] },
      currentLines: [null, null, null],
      part: 'weapon',
      lv: 200,
      target: 'potential',
      cubes,
      melPerNP: 1e6,
      gradeOrder: ORDER,
      gradeUp: {
        miracleTime: false,
        miracleMultiplier: CUBES.events.miracleTime.tierUpMultiplier,
        useGuarantee: false,
      },
      miracleAppliesTo: CUBES.events.miracleTime.appliesTo,
      resolveTable,
      gainOf,
      ctx: { mainStats: ['STR'], attackType: 'att', includePerLv: false },
    });

  it('効率降順・確率・コストの整合', () => {
    const cands = run();
    expect(cands.length).toBeGreaterThan(0);
    for (let i = 1; i < cands.length; i++) {
      expect(cands[i - 1]!.efficiency).toBeGreaterThanOrEqual(cands[i]!.efficiency);
    }
    for (const c of cands) {
      expect(c.prob).toBeGreaterThan(0);
      expect(c.prob).toBeLessThanOrEqual(1);
      expect(c.expectedCubes).toBeGreaterThanOrEqual(1 / c.prob);
      expect(c.costMel).toBeGreaterThan(0);
      expect(c.gain).toBeGreaterThan(0);
      expect(c.efficiency).toBeCloseTo(c.gain / c.costMel, 15);
    }
    expect(new Set(cands.map((c) => c.target.key)).size).toBe(cands.length);
    expect(cands.some((c) => c.target.grade === 'unique')).toBe(true);
  });

  it("'legendary|attPct:1' は安い方のキューブを選ぶ", () => {
    const c = run().find((x) => x.target.key === 'legendary|attPct:1');
    if (!c) throw new Error('candidate');
    const costs = cubes.map(({ def, setting }) => {
      const toGrade = cubesToGrade(def, 'unique', 'legendary', ORDER, {
        miracleTime: false,
        miracleMultiplier: 1,
        miracleApplies: false,
        useGuarantee: false,
      });
      return { id: def.id, cost: (toGrade + 1 / c.prob) * setting.priceNP * 1e6 };
    });
    const cheapest = costs.reduce((a, b) => (b.cost < a.cost ? b : a));
    expect(c.cube.id).toBe(cheapest.id);
    expect(c.costMel).toBeCloseTo(cheapest.cost, 3);
    expect(c.cube.id === 'neo').toBe(c.fallbackCube);
  });

  it('無効なキューブは使わない', () => {
    const disabled = cubes.map((c) => ({
      ...c,
      setting: { ...c.setting, enabled: c.def.id !== 'mega' },
    }));
    const cands = evaluateCandidates({
      current: { grade: 'unique', lines: [null, null, null] },
      currentLines: [null, null, null],
      part: 'weapon',
      lv: 200,
      target: 'potential',
      cubes: disabled,
      melPerNP: 1e6,
      gradeOrder: ORDER,
      gradeUp: { miracleTime: false, miracleMultiplier: 2, useGuarantee: false },
      miracleAppliesTo: [],
      resolveTable,
      gainOf,
      ctx: { mainStats: ['STR'], attackType: 'att', includePerLv: false },
    });
    expect(cands.every((c) => c.cube.id === 'neo')).toBe(true);
  });
});
