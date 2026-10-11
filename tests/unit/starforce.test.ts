import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DestroyMode, StarforceMaster, VipRank } from '../../src/data/types';
import {
  attemptCost,
  baseAttemptCost,
  expectedCost,
  expectedCostMarkov,
  maxStarForLevel,
  restoreOnDestroy,
  roundHalfEven,
  sfArmorAttBonus,
  sfBandKey,
  sfCandidates,
  sfContrib,
  sfContribToDelta,
  sfStatBonus,
  sfWeaponAttBonus,
  transitionProbs,
  type SfEquipRef,
  type SfOptions,
} from '../../src/domain/starforce';

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (rel: string): unknown =>
  JSON.parse(fs.readFileSync(path.resolve(here, rel), 'utf8'));

const m = readJson('../../public/data/starforce.json') as StarforceMaster;

interface ExpectedCase {
  L: number;
  a: number;
  b: number;
  destroyMode: DestroyMode;
  sparePrice?: number;
  discount30?: boolean;
  destroyDown30?: boolean;
  safeguard?: number[];
  vipRate?: number;
  mult22?: number;
  expectedMel: number;
  expectedDestroy: number;
}
interface Expected {
  perAttempt: Record<string, number[]>;
  cases: ExpectedCase[];
}
const expected = readJson('../reference/starforce_expected.json') as Expected;

function opts(over: Partial<SfOptions> = {}): SfOptions {
  return {
    starCatch: true,
    discount30: false,
    destroyDown30: false,
    guarantee51015: false,
    plusOneUnder10: false,
    vipRank: 'none',
    star22PlusMultiplier: 1,
    destroyMode: 'restorePrev',
    safeguardStars: [],
    sparePriceMel: 0,
    ...over,
  };
}

function vipRankFor(rate: number): VipRank {
  const entry = Object.entries(m.discounts.vip.rates).find(([, r]) => r === rate);
  if (!entry) throw new Error(`no VIP rank with rate ${rate}`);
  return entry[0] as VipRank;
}

describe('roundHalfEven', () => {
  it('Python round() と同じ', () => {
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(2.4999)).toBe(2);
    expect(roundHalfEven(2.5001)).toBe(3);
    expect(roundHalfEven(-1.5)).toBe(-2);
  });
});

describe('baseAttemptCost (perAttempt)', () => {
  it('全 L × ★0..29 が参照実装と完全一致', () => {
    let n = 0;
    for (const [L, row] of Object.entries(expected.perAttempt)) {
      for (let s = 0; s < 30; s++) {
        expect(baseAttemptCost(m, Number(L), s), `L${L} ★${s}`).toBe(row[s]);
        n++;
      }
    }
    expect(n).toBe(6 * 30);
  });

  it('★22以上だけ倍率が掛かる', () => {
    expect(baseAttemptCost(m, 200, 21, 1.2)).toBe(baseAttemptCost(m, 200, 21));
    expect(baseAttemptCost(m, 200, 22, 1.2)).toBe(Math.round(baseAttemptCost(m, 200, 22) * 1.2));
  });
});

describe('expectedCost (cases)', () => {
  for (const c of expected.cases) {
    const label = JSON.stringify({ ...c, expectedMel: undefined, expectedDestroy: undefined });
    it(label, () => {
      const o = opts({
        destroyMode: c.destroyMode,
        sparePriceMel: c.sparePrice ?? 0,
        discount30: c.discount30 ?? false,
        destroyDown30: c.destroyDown30 ?? false,
        safeguardStars: c.safeguard ?? [],
        vipRank: c.vipRate ? vipRankFor(c.vipRate) : 'none',
        star22PlusMultiplier: c.mult22 ?? 1,
      });
      const r = expectedCost(m, c.L, c.a, c.b, o);
      expect(Math.abs(Math.round(r.mel) - c.expectedMel)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.destroys - c.expectedDestroy)).toBeLessThanOrEqual(5e-5 + 1e-9);
    });
  }

  it('from >= to は 0', () => {
    expect(expectedCost(m, 200, 17, 17, opts())).toEqual({ mel: 0, destroys: 0 });
  });

  it('restorePrev で from > 22 でも計算できる', () => {
    const r = expectedCost(m, 200, 23, 25, opts());
    expect(r.mel).toBeGreaterThan(0);
    const all = expectedCost(m, 200, 22, 25, opts());
    const s22 = expectedCost(m, 200, 22, 23, opts());
    expect(r.mel).toBeCloseTo(all.mel - s22.mel, -2);
  });
});

describe('maxStarForLevel / sfBandKey', () => {
  it('上限★', () => {
    expect(maxStarForLevel(m, 150)).toBe(30);
    expect(maxStarForLevel(m, 137)).toBe(20);
    expect(maxStarForLevel(m, 120)).toBe(15);
    expect(maxStarForLevel(m, 100)).toBe(8);
    expect(maxStarForLevel(m, 94)).toBe(5);
  });
  it('Lv帯', () => {
    expect(sfBandKey(m, 127)).toBeNull();
    expect(sfBandKey(m, 128)).toBe('130');
    expect(sfBandKey(m, 149)).toBe('140');
    expect(sfBandKey(m, 200)).toBe('200');
    expect(sfBandKey(m, 300)).toBe('250');
  });
});

describe('sfStatBonus', () => {
  it('累積値', () => {
    expect(sfStatBonus(m, 200, 0)).toBe(0);
    expect(sfStatBonus(m, 200, 15)).toBe(m.stats.statCumulative1to15[14]);
    expect(sfStatBonus(m, 200, 22)).toBe(m.stats.statCumulative16['200']?.[6]);
    expect(sfStatBonus(m, 200, 25)).toBe(sfStatBonus(m, 200, 22));
    expect(sfStatBonus(m, 130, 20)).toBe(m.stats.statCumulative16['130']?.[4]);
    expect(sfStatBonus(m, 130, 22)).toBe(m.stats.statCumulative16['130']?.[4]);
    expect(sfStatBonus(m, 120, 16)).toBe(m.stats.statCumulative1to15[14]);
  });
});

describe('sfArmorAttBonus', () => {
  it('手袋', () => {
    expect(sfArmorAttBonus(m, 160, 15, 'gloves')).toBe(7);
    expect(sfArmorAttBonus(m, 160, 4, 'gloves')).toBe(0);
    expect(sfArmorAttBonus(m, 160, 5, 'gloves')).toBe(1);
    expect(sfArmorAttBonus(m, 120, 15, 'gloves')).toBe(7);
    expect(sfArmorAttBonus(m, 160, 17, 'gloves')).toBe(
      7 + (m.stats.armorAttCumulative16['160']?.[1] ?? NaN),
    );
  });
  it('帽子・武器', () => {
    expect(sfArmorAttBonus(m, 200, 15, 'hat')).toBe(0);
    expect(sfArmorAttBonus(m, 200, 20, 'hat')).toBe(m.stats.armorAttCumulative16['200']?.[4]);
    expect(sfArmorAttBonus(m, 200, 22, 'weapon')).toBe(0);
  });
});

describe('sfWeaponAttBonus', () => {
  it('★1-15 は1つずつ floor(att/50)+1', () => {
    expect(sfWeaponAttBonus(m, 200, 1, 326)).toBe(7);
    expect(sfWeaponAttBonus(m, 200, 2, 326)).toBe(14);
    let att = 326;
    for (let i = 0; i < 15; i++) att += Math.floor(att / 50) + 1;
    expect(sfWeaponAttBonus(m, 200, 15, 326)).toBe(att - 326);
    expect(sfWeaponAttBonus(m, 200, 16, 326)).toBe(
      att - 326 + (m.stats.weaponAttCumulative16['200']?.[0] ?? NaN),
    );
  });
  it('未確定段階は null、攻撃力0は 0', () => {
    expect(sfWeaponAttBonus(m, 250, 22, 400)).not.toBeNull();
    expect(sfWeaponAttBonus(m, 250, 23, 400)).toBeNull();
    expect(sfWeaponAttBonus(m, 200, 22, 0)).toBe(0);
  });
});

describe('sfContrib / sfCandidates', () => {
  const weapon250: SfEquipRef = {
    lv: 250,
    kind: 'weapon',
    baseAtt: 400,
    baseMatt: 0,
    scrollAtt: 100,
    scrollMatt: 0,
  };
  const hat200: SfEquipRef = {
    lv: 200,
    kind: 'hat',
    baseAtt: 0,
    baseMatt: 0,
    scrollAtt: 0,
    scrollMatt: 0,
  };

  it('superior は null、★0 はゼロ、上限超えは null', () => {
    expect(sfContrib(m, { ...hat200, superior: true }, 10)).toBeNull();
    expect(sfContrib(m, hat200, 0)).toEqual({ stat: 0, att: 0, matt: 0 });
    expect(sfContrib(m, { ...hat200, lv: 120 }, 16)).toBeNull();
    expect(sfContrib(m, hat200, 20)).toEqual({
      stat: sfStatBonus(m, 200, 20),
      att: sfArmorAttBonus(m, 200, 20, 'hat'),
      matt: sfArmorAttBonus(m, 200, 20, 'hat'),
    });
  });

  it('未確定の武器段階で打ち切る', () => {
    const c = sfCandidates(m, weapon250, 18, 30, opts());
    expect(c.map((x) => x.to)).toEqual([19, 20, 21, 22]);
    expect(sfContrib(m, weapon250, 23)).toBeNull();
  });

  it('limit を守り、最大 +6', () => {
    expect(sfCandidates(m, hat200, 10, 13, opts()).map((x) => x.to)).toEqual([11, 12, 13]);
    expect(sfCandidates(m, hat200, 10, 30, opts()).map((x) => x.to)).toEqual([
      11, 12, 13, 14, 15, 16,
    ]);
    expect(sfCandidates(m, hat200, 22, 22, opts())).toEqual([]);
    expect(sfCandidates(m, { ...hat200, superior: true }, 10, 22, opts())).toEqual([]);
  });

  it('候補の費用は expectedCost と一致', () => {
    const o = opts();
    const c = sfCandidates(m, hat200, 15, 18, o);
    const last = c[c.length - 1];
    expect(last?.cost).toBe(expectedCost(m, 200, 15, 18, o).mel);
    expect(last?.contribFrom).toEqual(sfContrib(m, hat200, 15));
    expect(last?.contribTo).toEqual(sfContrib(m, hat200, 18));
  });

  it('sfContribToDelta', () => {
    const d = sfContribToDelta({ stat: 10, att: 3, matt: 5 }, 'matt');
    expect(d.flat).toEqual({ STR: 10, DEX: 10, INT: 10, LUK: 10 });
    expect(d.attFlat).toBe(5);
    expect(sfContribToDelta({ stat: 0, att: 3, matt: 5 }, 'att').attFlat).toBe(3);
  });
});

describe('transitionProbs / attemptCost / restoreOnDestroy', () => {
  const combos: Partial<SfOptions>[] = [
    {},
    { starCatch: false },
    { destroyDown30: true },
    { guarantee51015: true },
    { safeguardStars: [15, 16, 17] },
    { destroyDown30: true, safeguardStars: [15, 16, 17], guarantee51015: true },
  ];

  it('合計は 1', () => {
    for (const c of combos) {
      for (let s = 0; s < 30; s++) {
        const p = transitionProbs(m, s, opts(c));
        expect(p.success + p.keep + p.destroy).toBeCloseTo(1, 12);
        expect(p.success).toBeGreaterThan(0);
      }
    }
  });

  it('破壊防止は 15..17 のみ破壊0', () => {
    const o = opts({ safeguardStars: [14, 15, 16, 17, 18] });
    for (const s of [15, 16, 17]) expect(transitionProbs(m, s, o).destroy).toBe(0);
    expect(transitionProbs(m, 18, o).destroy).toBeGreaterThan(0);
    // 対象外の★では費用加算もしない
    expect(attemptCost(m, 200, 18, o)).toBe(baseAttemptCost(m, 200, 18));
    expect(attemptCost(m, 200, 16, o)).toBe(baseAttemptCost(m, 200, 16) * 3);
  });

  it('5/10/15 100%', () => {
    const o = opts({ guarantee51015: true });
    for (const s of [5, 10, 15]) {
      expect(transitionProbs(m, s, o)).toEqual({ success: 1, keep: 0, destroy: 0 });
    }
    expect(transitionProbs(m, 16, o).success).toBeLessThan(1);
  });

  it('復旧', () => {
    expect(
      restoreOnDestroy(m, 200, 20, opts({ destroyMode: 'restart12', sparePriceMel: 5 })),
    ).toEqual({ star: 12, cost: 5 });
    const r = restoreOnDestroy(m, 200, 25, opts({ sparePriceMel: 10, star22PlusMultiplier: 1.2 }));
    expect(r.star).toBe(22);
    expect(r.cost).toBe(127.4 * baseAttemptCost(m, 200, 22) + 4 * 10);
  });
});

describe('expectedCostMarkov', () => {
  const combos: [number, number, number, DestroyMode][] = [
    [150, 0, 17, 'restart12'],
    [150, 0, 17, 'restorePrev'],
    [200, 12, 22, 'restart12'],
    [200, 17, 22, 'restorePrev'],
    [200, 22, 25, 'restart12'],
    [200, 22, 25, 'restorePrev'],
    [250, 15, 23, 'restorePrev'],
    [160, 5, 20, 'restart12'],
  ];

  it('plusOneUnder10 OFF なら前向き漸化式と一致', () => {
    for (const [L, a, b, mode] of combos) {
      for (const extra of [{}, { safeguardStars: [15, 16, 17], sparePriceMel: 1e8 }]) {
        const o = opts({ destroyMode: mode, ...extra });
        const f = expectedCost(m, L, a, b, o);
        const g = expectedCostMarkov(m, L, a, b, o);
        expect(Math.abs(g.mel - f.mel) / f.mel).toBeLessThan(1e-9);
        if (f.destroys > 0) {
          expect(Math.abs(g.destroys - f.destroys) / f.destroys).toBeLessThan(1e-9);
        } else {
          expect(Math.abs(g.destroys)).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('plusOneUnder10 ON で 0→12 が安くなる', () => {
    const off = expectedCost(m, 200, 0, 12, opts());
    const on = expectedCost(m, 200, 0, 12, opts({ plusOneUnder10: true }));
    expect(on.mel).toBeLessThan(off.mel);
    expect(on.mel).toBeGreaterThan(0);
    // ★11以上は影響なし
    const off2 = expectedCost(m, 200, 11, 17, opts());
    const on2 = expectedCost(m, 200, 11, 17, opts({ plusOneUnder10: true }));
    expect(Math.abs(on2.mel - off2.mel) / off2.mel).toBeLessThan(1e-9);
  });
});
