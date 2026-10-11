import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { JobDef, JobsMaster, OptionKey, PotOption, StatKey } from '../../src/data/types';
import type { CharacterInput } from '../../src/domain/character';
import { emptyDelta, type Delta } from '../../src/domain/delta';
import {
  applyDelta,
  cpAfter,
  cpStateFrom,
  flameDelta,
  flameWeights,
  gain,
  jobStatKeys,
  linearWeights,
  potLinesDelta,
  statTerm,
  usesCdrConversion,
  type PotLineContext,
} from '../../src/domain/cp';

const here = path.dirname(fileURLToPath(import.meta.url));

interface CpExpected {
  character: {
    displayedCP: number;
    level: number;
    STR: { final: number; pct: number; nonPct: number };
    DEX: { final: number; pct: number; nonPct: number };
    attack: { final: number; pct: number };
    dmgPct: number;
    bossPct: number;
    critDmgPct: number;
  };
  cases: Record<string, number>;
  deltas: Record<string, Record<string, number>>;
}

const expected = JSON.parse(
  fs.readFileSync(path.resolve(here, '../reference/cp_expected.json'), 'utf8'),
) as CpExpected;
const jobs = JSON.parse(
  fs.readFileSync(path.resolve(here, '../../public/data/jobs.json'), 'utf8'),
) as JobsMaster;

function job(id: string): JobDef {
  const j = jobs.jobs.find((x) => x.id === id);
  if (!j) throw new Error(`job ${id} not found`);
  return j;
}

function refCharacter(): CharacterInput {
  const c = expected.character;
  return {
    version: 1,
    id: 'ref',
    name: 'ref',
    jobId: 'hero',
    level: c.level,
    displayedCP: c.displayedCP,
    stats: {
      STR: { ...c.STR },
      DEX: { ...c.DEX },
      INT: { final: 0, pct: 0, nonPct: 0 },
      LUK: { final: 0, pct: 0, nonPct: 0 },
    },
    attack: { ...c.attack },
    dmgPct: c.dmgPct,
    bossPct: c.bossPct,
    critDmgPct: c.critDmgPct,
    equips: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function toDelta(src: Record<string, number>): Delta {
  const d = emptyDelta();
  for (const [k, v] of Object.entries(src)) {
    switch (k) {
      case 'pct_STR':
        d.pct.STR += v;
        break;
      case 'pct_DEX':
        d.pct.DEX += v;
        break;
      case 'flat_STR':
        d.flat.STR += v;
        break;
      case 'nonPct_STR':
        d.nonPct.STR += v;
        break;
      case 'attFlat':
        d.attFlat += v;
        break;
      case 'attPct':
        d.attPct += v;
        break;
      case 'bossPct':
        d.bossPct += v;
        break;
      case 'critDmgPct':
        d.critDmgPct += v;
        break;
      default:
        throw new Error(`unknown delta key ${k}`);
    }
  }
  return d;
}

function expectRel(actual: number, exp: number, tol = 1e-9): void {
  if (exp === 0) {
    expect(Math.abs(actual)).toBeLessThanOrEqual(1e-6);
    return;
  }
  expect(Math.abs(actual - exp) / Math.abs(exp)).toBeLessThanOrEqual(tol);
}

let nextId = 0;
function opt(
  key: OptionKey,
  value: number,
  extra: { stat?: StatKey; per?: number } = {},
): PotOption {
  return { id: nextId++, key, value, ja: key, kr: key, group: null, ...extra };
}

const heroState = () => cpStateFrom(refCharacter(), job('hero'));
const heroCtx = (over: Partial<PotLineContext> = {}): PotLineContext => ({
  level: 270,
  mainStats: ['STR'],
  subStats: ['DEX'],
  attackType: 'att',
  ...over,
});

describe('cp: 参照実装 cp_expected.json', () => {
  for (const [name, exp] of Object.entries(expected.cases)) {
    it(name, () => {
      const src = expected.deltas[name];
      if (!src) throw new Error(`delta ${name} missing`);
      expectRel(gain(heroState(), toDelta(src)), exp);
    });
  }
});

describe('cp: 基本性質', () => {
  it('Δ=0 → gain は厳密に 0', () => {
    expect(gain(heroState(), emptyDelta())).toBe(0);
  });

  it('applyDelta 後の Δ=0 は 0、cpAfter は一致', () => {
    const st = heroState();
    const d = toDelta({ pct_STR: 12, attFlat: 30, bossPct: 40 });
    const st2 = applyDelta(st, d);
    expect(gain(st2, emptyDelta())).toBe(0);
    expectRel(cpAfter(st2, emptyDelta()), cpAfter(st, d));
    expectRel(st2.displayedCP, cpAfter(st, d));
  });

  it('applyDelta を2回重ねると合計Δと一致', () => {
    const st = heroState();
    const d1 = toDelta({ pct_STR: 12 });
    const d2 = toDelta({ flat_STR: 100, critDmgPct: 8 });
    const both = toDelta({ pct_STR: 12, flat_STR: 100, critDmgPct: 8 });
    expectRel(applyDelta(applyDelta(st, d1), d2).displayedCP, cpAfter(st, both));
  });

  it('全ステ%は主副両方に効く(allStatPct+9 の参照値と一致)', () => {
    const d = potLinesDelta([opt('allStatPct', 9)], heroCtx());
    expect(d.pct).toEqual({ STR: 9, DEX: 9, INT: 9, LUK: 9 });
    expectRel(gain(heroState(), d), expected.cases['allStatPct+9'] ?? NaN);
    expect(gain(heroState(), d)).toBeGreaterThan(gain(heroState(), toDelta({ pct_STR: 9 })));
  });
});

describe('cp: potLinesDelta', () => {
  it('物理職は魔力行を無視、魔法職は攻撃力行を無視', () => {
    const lines = [opt('attPct', 12), opt('mattPct', 9), opt('attFlat', 10), opt('mattFlat', 7)];
    const a = potLinesDelta(lines, heroCtx());
    expect(a.attPct).toBe(12);
    expect(a.attFlat).toBe(10);
    const m = potLinesDelta(
      lines,
      heroCtx({ mainStats: ['INT'], subStats: ['LUK'], attackType: 'matt' }),
    );
    expect(m.attPct).toBe(9);
    expect(m.attFlat).toBe(7);
  });

  it('レベルごと行は floor(level/per)', () => {
    const d = potLinesDelta(
      [opt('statPerLv', 2, { stat: 'STR', per: 9 }), opt('attPerLv', 1, { per: 10 }), null],
      heroCtx({ level: 275 }),
    );
    expect(d.nonPct.STR).toBe(2 * 30);
    expect(d.attFlat).toBe(27);
    expect(d.pct.STR).toBe(0);
  });

  it('その他の行(防御率無視・クリ率・HP 等)は 0、ダメ・ボス・クリダメは反映', () => {
    const d = potLinesDelta(
      [opt('iedPct', 40), opt('critRate', 12), opt('hpPct', 12), opt('dmgPct', 12)],
      heroCtx(),
    );
    expect(d).toEqual({ ...emptyDelta(), dmgPct: 12 });
    const e = potLinesDelta([opt('bossPct', 40), opt('critDmg', 8)], heroCtx());
    expect(e.bossPct).toBe(40);
    expect(e.critDmgPct).toBe(8);
  });

  it('クール減 −2秒(1.0行/2秒 × 12%)で主ステ% +12', () => {
    const lines = [opt('cdrSec', 2)];
    const ctx = heroCtx({ cdrPctPerSec: 6 });
    const d = potLinesDelta(lines, ctx);
    expect(d.pct.STR).toBe(12);
    expect(d.pct.DEX).toBe(0);
    expect(usesCdrConversion(lines, ctx)).toBe(true);
    expect(usesCdrConversion(lines, heroCtx())).toBe(false);
    expect(usesCdrConversion(lines, heroCtx({ cdrPctPerSec: 0 }))).toBe(false);
    expect(usesCdrConversion([opt('statPct', 12, { stat: 'STR' })], ctx)).toBe(false);
    expect(potLinesDelta(lines, heroCtx()).pct.STR).toBe(0);
  });
});

describe('cp: 職業の式', () => {
  it('jobStatKeys', () => {
    expect(jobStatKeys(job('hero'))).toEqual({ mainStats: ['STR'], subStats: ['DEX'] });
    expect(jobStatKeys(job('xenon'))).toEqual({ mainStats: ['STR', 'DEX', 'LUK'], subStats: [] });
    expect(jobStatKeys(job('demonavenger'))).toEqual({ mainStats: ['STR'], subStats: [] });
    const sh = jobStatKeys(job('shadower'));
    expect(sh.mainStats).toEqual(['LUK']);
    expect([...sh.subStats].sort()).toEqual(['DEX', 'STR']);
  });

  it('ゼノン: S = 4×(STR+DEX+LUK)', () => {
    const ch = refCharacter();
    ch.stats.STR = { final: 3000, pct: 0, nonPct: 0 };
    ch.stats.DEX = { final: 2000, pct: 0, nonPct: 0 };
    ch.stats.INT = { final: 999, pct: 0, nonPct: 0 };
    ch.stats.LUK = { final: 4000, pct: 50, nonPct: 1000 };
    const st = cpStateFrom(ch, job('xenon'));
    expectRel(statTerm(st, emptyDelta()), 4 * (3000 + 2000 + 4000));
  });

  it('デーモンアヴェンジャー: HP と STR を使う', () => {
    const ch = refCharacter();
    ch.hp = { pure: 35000, added: 70000 };
    ch.stats.STR = { final: 5000, pct: 0, nonPct: 0 };
    const st = cpStateFrom(ch, job('demonavenger'));
    expectRel(statTerm(st, emptyDelta()), 10000 + 0.8 * 20000 + 5000);
    const d = emptyDelta();
    d.hpFlat = 350;
    expectRel(statTerm(st, d), 10000 + 0.8 * 20100 + 5000);
    expect(flameWeights(st).HP).toBeGreaterThan(0);
    expect(linearWeights(st).subFlat).toBe(0);
  });

  it('ハイブリッド: シャドー(副ステ2つ)は両方を合計', () => {
    const ch = refCharacter();
    ch.stats.LUK = { final: 1000, pct: 0, nonPct: 0 };
    ch.stats.DEX = { final: 300, pct: 0, nonPct: 0 };
    ch.stats.STR = { final: 200, pct: 0, nonPct: 0 };
    const st = cpStateFrom(ch, job('shadower'));
    expectRel(statTerm(st, emptyDelta()), 4 * 1000 + 300 + 200);
  });
});

describe('cp: 重み', () => {
  it('linearWeights は有限かつ非負', () => {
    const w = linearWeights(heroState());
    for (const v of Object.values(w)) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(w.mainFlat).toBeGreaterThan(w.subFlat);
    expect(w.hpFlat).toBe(0);
  });

  it('flameWeights のキーが揃い、魔法職は ATT=0', () => {
    const keys = ['STR', 'DEX', 'INT', 'LUK', 'ATT', 'MATT', 'AS', 'BOSS', 'DMG', 'HP'];
    const w = flameWeights(heroState());
    expect(Object.keys(w).sort()).toEqual([...keys].sort());
    expect(w.ATT).toBeGreaterThan(0);
    expect(w.MATT).toBe(0);
    expect(w.INT).toBe(0);

    const ch = refCharacter();
    ch.stats.INT = { final: 50000, pct: 300, nonPct: 20000 };
    ch.stats.LUK = { final: 5000, pct: 50, nonPct: 1000 };
    const mw = flameWeights(cpStateFrom(ch, job('archmage_fp')));
    expect(mw.ATT).toBe(0);
    expect(mw.MATT).toBeGreaterThan(0);
  });

  it('flameDelta: 全ステ%は4つすべて、攻撃力は攻撃タイプで選ぶ', () => {
    const f = {
      str: 10,
      dex: 5,
      int: 0,
      luk: 0,
      att: 3,
      matt: 7,
      allStatPct: 6,
      bossPct: 2,
      dmgPct: 1,
      hp: 100,
    };
    const d = flameDelta(f, 'att');
    expect(d.flat).toEqual({ STR: 10, DEX: 5, INT: 0, LUK: 0 });
    expect(d.pct).toEqual({ STR: 6, DEX: 6, INT: 6, LUK: 6 });
    expect(d.attFlat).toBe(3);
    expect(flameDelta(f, 'matt').attFlat).toBe(7);
    expect(d.hpFlat).toBe(100);
  });
});

describe('cp: ガード', () => {
  it('pct = −100 でも NaN にならない', () => {
    const ch = refCharacter();
    ch.stats.STR = { final: 1000, pct: -100, nonPct: 0 };
    ch.attack = { final: 100, pct: -100 };
    const st = cpStateFrom(ch, job('hero'));
    const d = toDelta({ pct_STR: 10, attPct: 5 });
    expect(Number.isNaN(gain(st, d))).toBe(false);
    expect(Number.isFinite(cpAfter(st, d))).toBe(true);
  });

  it('displayedCP 0 / 全ステ 0 でも NaN にならない', () => {
    const ch = refCharacter();
    ch.displayedCP = 0;
    ch.stats.STR = { final: 0, pct: 0, nonPct: 0 };
    ch.stats.DEX = { final: 0, pct: 0, nonPct: 0 };
    ch.attack = { final: 0, pct: 0 };
    const st = cpStateFrom(ch, job('hero'));
    const d = toDelta({ flat_STR: 100, attFlat: 10 });
    expect(gain(st, d)).toBe(0);
    for (const v of Object.values(linearWeights(st))) expect(Number.isNaN(v)).toBe(false);
  });
});
