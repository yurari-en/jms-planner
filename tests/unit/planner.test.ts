import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  CubeTables,
  CubesMaster,
  FlameMaster,
  JobsMaster,
  MasterData,
  StarforceMaster,
} from '../../src/data/types';
import {
  EMPTY_FLAME,
  EQUIP_SLOTS,
  emptyEquip,
  type CharacterInput,
  type EquipInput,
  type EquipSlot,
  type PotState,
} from '../../src/domain/character';
import { maxStarForLevel } from '../../src/domain/starforce';
import { cpStateFrom, linearWeights } from '../../src/domain/cp';
import { defaultSettings, type PlannerSettings } from '../../src/domain/settings';
import type { PotStep, SfStep } from '../../src/domain/planTypes';
import {
  buildPlan,
  planContextFrom,
  rankFlames,
  resolvePotLines,
  targetLineLabel,
  validateCharacter,
} from '../../src/domain/planner';
import { createPlannerClient } from '../../src/worker/client';

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = <T>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.resolve(here, rel), 'utf8')) as T;

const DATA: MasterData = {
  starforce: readJson<StarforceMaster>('../../public/data/starforce.json'),
  cubes: readJson<CubesMaster>('../../public/data/cubes.json'),
  cubeTables: readJson<CubeTables>('../fixtures/kms-cube-tables.seed.json'),
  flame: readJson<FlameMaster>('../../public/data/flame.json'),
  jobs: readJson<JobsMaster>('../../public/data/jobs.json'),
  items: { meta: { source: 'test', asOf: '2026-01-01', minLevel: 0 }, items: [] },
  manifest: { version: 'test', generatedAt: '2026-01-01T00:00:00Z', files: {} },
};
const CTX = planContextFrom(DATA);
const settings = (patch: Partial<PlannerSettings> = {}): PlannerSettings => ({
  ...defaultSettings(DATA.cubes),
  ...patch,
});

const NONE: PotState = { grade: 'none', lines: [null, null, null] };

function optId(key: string, value: number, stat?: string): number {
  const opts = CTX.idx.potentialOptionsFor('black', 'legendary', 'hat', 160);
  const o = opts.find((x) => x.key === key && x.value === value && (!stat || x.stat === stat));
  if (!o) throw new Error(`option not found ${key} ${value}`);
  return o.id;
}
const HAT_LINES: [number, number, number] = [
  optId('statPct', 12, 'STR'),
  optId('statPct', 9, 'STR'),
  optId('cdrSec', 2),
];

function equip(
  slot: EquipSlot,
  lv: number,
  star: number,
  opts: { boss?: boolean; baseAtt?: number; potential?: PotState } = {},
): EquipInput {
  return {
    ...emptyEquip(slot),
    custom: { name: `test-${slot}`, lv, boss: opts.boss ?? false, baseAtt: opts.baseAtt },
    star,
    potential: opts.potential ?? { ...NONE, lines: [null, null, null] },
  };
}

function hero(equips: EquipInput[]): CharacterInput {
  const bySlot = new Map(equips.map((e) => [e.slot, e]));
  return {
    version: 1,
    id: 't',
    name: 'test hero',
    jobId: 'hero',
    level: 260,
    displayedCP: 50_000_000,
    stats: {
      STR: { final: 30000, pct: 300, nonPct: 12000 },
      DEX: { final: 4000, pct: 60, nonPct: 1000 },
      INT: { final: 0, pct: 0, nonPct: 0 },
      LUK: { final: 0, pct: 0, nonPct: 0 },
    },
    attack: { final: 5000, pct: 90 },
    dmgPct: 60,
    bossPct: 300,
    critDmgPct: 90,
    equips: EQUIP_SLOTS.map((s) => bySlot.get(s) ?? emptyEquip(s)),
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function baseEquips(): EquipInput[] {
  return [
    equip('weapon', 200, 17, {
      boss: true,
      baseAtt: 300,
      potential: { grade: 'unique', lines: [null, null, null] },
    }),
    equip('hat', 160, 17, { boss: true, potential: { grade: 'legendary', lines: HAT_LINES } }),
    equip('gloves', 160, 17, { boss: true }),
    equip('top', 160, 17),
    equip('pendant1', 140, 10),
    equip('ring1', 120, 0),
    equip('secondary', 100, 0),
    equip('emblem', 100, 0),
    equip('pocket', 140, 0, { boss: true }),
  ];
}

const sfSteps = (steps: { kind: string }[]) =>
  steps.filter((s): s is SfStep => s.kind === 'starforce');

describe('planner: buildPlan', () => {
  const ch = hero(baseEquips());
  const res = buildPlan(ch, settings(), CTX);

  it('orders steps greedily with consistent ranks and gains', () => {
    expect(res.steps.length).toBeGreaterThan(0);
    res.steps.forEach((s, i) => {
      expect(s.rank).toBe(i + 1);
      expect(s.gain).toBeGreaterThan(0);
      expect(s.cost).toBeGreaterThan(0);
      expect(Number.isFinite(s.efficiency)).toBe(true);
      expect(s.quartile).toBeGreaterThanOrEqual(1);
      expect(s.quartile).toBeLessThanOrEqual(4);
    });
    const allRows = Object.values(res.candidatesBySlot).flat();
    const maxEff = Math.max(...allRows.map((r) => r!.efficiency));
    expect(res.steps[0]!.efficiency).toBeCloseTo(maxEff, 12);
    expect(res.finalCP).toBeGreaterThan(ch.displayedCP);
    const present = new Set(baseEquips().map((e) => e.slot));
    for (const s of res.steps) expect(present.has(s.slot)).toBe(true);
    for (const s of sfSteps(res.steps)) {
      const lv = ch.equips.find((e) => e.slot === s.slot)!.custom!.lv;
      expect(s.to).toBeLessThanOrEqual(22);
      expect(s.to).toBeLessThanOrEqual(maxStarForLevel(DATA.starforce, lv));
    }
    // ポケット・補助武器・エンブレムに★のステップは出ない
    for (const s of sfSteps(res.steps)) {
      expect(['pocket', 'secondary', 'emblem']).not.toContain(s.slot);
    }
    expect(res.quartileBounds[0]).toBeGreaterThanOrEqual(res.quartileBounds[1]);
    expect(res.quartileBounds[1]).toBeGreaterThanOrEqual(res.quartileBounds[2]);
  });

  it('never exceeds the per-level max star even when sfMaxTarget is raised', () => {
    // lv140 は ★30 体系で最大★30(maxStarByLevel: maxLv 137 まで ★20)。Lv135 の装備で ★20 の上限を確認する
    expect(maxStarForLevel(DATA.starforce, 140)).toBe(30);
    expect(maxStarForLevel(DATA.starforce, 135)).toBe(20);
    const eqs = baseEquips();
    eqs.push(equip('pendant2', 135, 15));
    const r = buildPlan(
      hero(eqs),
      settings({
        sfMaxTarget: 30,
        include: { starforce: true, potential: false, additional: false },
      }),
      CTX,
    );
    const p2 = sfSteps(r.steps).filter((s) => s.slot === 'pendant2');
    expect(p2.length).toBeGreaterThan(0);
    for (const s of p2) expect(s.to).toBeLessThanOrEqual(20);
    for (const s of sfSteps(r.steps).filter((x) => x.slot === 'ring1')) {
      expect(s.to).toBeLessThanOrEqual(maxStarForLevel(DATA.starforce, 120));
    }
    for (const s of sfSteps(r.steps).filter((x) => x.slot === 'pendant1')) {
      expect(s.to).toBeLessThanOrEqual(30);
    }
  });

  it('groups consecutive star steps of one equip', () => {
    const only = hero([equip('weapon', 200, 17, { boss: true, baseAtt: 300 })]);
    const sOnly = settings({ include: { starforce: true, potential: false, additional: false } });
    const r = buildPlan(only, sOnly, CTX);
    const ss = sfSteps(r.steps);
    expect(ss.length).toBe(r.steps.length);
    expect(ss.length).toBeGreaterThan(0);
    expect(ss[0]!.from).toBe(17);
    for (let i = 1; i < ss.length; i++) expect(ss[i]!.from).toBe(ss[i - 1]!.to);
    expect(r.groups.length).toBe(1);
    const g = r.groups[0]!;
    const last = ss[ss.length - 1]!;
    expect(g.from).toBe(17);
    expect(g.to).toBe(last.to);
    expect(g.cellLabel).toBe(`17→${last.to}`);

    const one = buildPlan(only, { ...sOnly, stepLimit: 1 }, CTX);
    expect(one.steps.length).toBe(1);
    expect(one.groups[0]!.cellLabel).toBe(`${(one.steps[0] as SfStep).to}`);
    expect(one.groups[0]!.cellLabel).toBe('18');
    expect(one.truncated).toBe(true);
  });

  it('returns no steps when displayedCP is missing', () => {
    const r = buildPlan({ ...ch, displayedCP: 0 }, settings(), CTX);
    expect(r.steps.length).toBe(0);
    expect(r.warnings.some((w) => w.message.includes('戦闘力'))).toBe(true);
  });

  it('truncates at stepLimit', () => {
    const r = buildPlan(ch, settings({ stepLimit: 5 }), CTX);
    expect(r.steps.length).toBe(5);
    expect(r.truncated).toBe(true);
  });

  it('potential steps advance the working state', () => {
    const pot = res.steps.filter(
      (s): s is PotStep => s.kind === 'potential' && s.slot === 'weapon',
    );
    expect(pot.length).toBeGreaterThan(0);
    const order = DATA.cubes.gradeOrder;
    const gi = (g: string) => order.indexOf(g === 'none' ? 'rare' : (g as never));
    for (let i = 0; i < pot.length; i++) {
      for (let j = i + 1; j < pot.length; j++) {
        expect(pot[j]!.targetKey).not.toBe(pot[i]!.targetKey);
        expect(gi(pot[j]!.fromGrade)).toBeGreaterThanOrEqual(gi(pot[i]!.toGrade));
      }
    }
    for (const s of pot) {
      expect(s.newLineLabels.length).toBe(s.lineCount);
      expect(s.assumptions.some((a) => a.includes('KMS'))).toBe(true);
      expect(s.cubeName.length).toBeGreaterThan(0);
    }
    const g = res.groups.find((x) => x.steps[0] === pot[0])!;
    expect(g.cellLabel).toBe(`×${pot[0]!.lineCount}`);
  });

  it('handles the hat cooldown line conversion', () => {
    expect(validateCharacter(ch, settings(), CTX).filter((w) => w.slot === 'hat')).toEqual([]);
    const hat = ch.equips.find((e) => e.slot === 'hat')!;
    const lines = resolvePotLines(hat.potential, CTX.idx);
    expect(lines.map((o) => o?.key)).toEqual(['statPct', 'statPct', 'cdrSec']);

    const eqs = baseEquips().map((e) =>
      e.slot === 'hat'
        ? {
            ...e,
            potential: {
              grade: 'unique' as const,
              lines: [null, null, null] as [null, null, null],
            },
          }
        : e,
    );
    const r = buildPlan(hero(eqs), settings({ cdrLinesPer2Sec: 'auto' }), CTX);
    const labels = (r.candidatesBySlot.hat ?? []).map((x) => x.label);
    expect(labels.some((l) => l.includes('クール減'))).toBe(true);
    const cdrSteps = r.steps.filter(
      (s): s is PotStep => s.kind === 'potential' && s.slot === 'hat' && s.cdrConverted,
    );
    for (const s of cdrSteps) {
      expect(s.assumptions.some((a) => a.includes('クール減換算'))).toBe(true);
    }
  });

  it('warns about unknown items and unresolvable lines', () => {
    const eqs = baseEquips();
    eqs.push({ ...emptyEquip('belt'), itemId: 99999999 });
    const bad = eqs.map((e) =>
      e.slot === 'gloves'
        ? {
            ...e,
            potential: {
              grade: 'legendary' as const,
              lines: [987654, null, null] as [number, null, null],
            },
          }
        : e,
    );
    const w = validateCharacter(hero(bad), settings(), CTX);
    expect(
      w.some((x) => x.slot === 'belt' && x.message.includes('装備マスタに見つかりません')),
    ).toBe(true);
    expect(w.some((x) => x.slot === 'gloves' && x.message.includes('確率表にありません'))).toBe(
      true,
    );
  });

  it('formats target line labels', () => {
    const cat = { key: 'attPct' } as Parameters<typeof targetLineLabel>[0];
    expect(targetLineLabel(cat, 9, 'STR')).toBe('攻撃力 : +9%');
    expect(targetLineLabel({ ...cat, key: 'statPct' }, 12, 'STR')).toBe('STR : +12%');
    expect(targetLineLabel({ ...cat, key: 'cdrSec' }, 2, 'STR')).toBe(
      '全スキルの再使用待機時間 : -2秒',
    );
    expect(targetLineLabel({ ...cat, key: 'statPerLv' }, 2, 'STR')).toBe(
      'キャラクターレベル9ごとにSTR : +2',
    );
  });
});

describe('planner: rankFlames', () => {
  const eqs = baseEquips().map((e) =>
    e.slot === 'top' ? { ...e, flame: { ...EMPTY_FLAME, str: 50 } } : e,
  );
  const ch = hero(eqs);
  const r = rankFlames(ch, settings(), CTX);

  it('ranks flame-eligible equips by expected gain', () => {
    const slots = r.rows.map((x) => x.slot).sort();
    expect(slots).toEqual(['gloves', 'hat', 'pendant1', 'pocket', 'top', 'weapon'].sort());
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i - 1]!.expectedGain).toBeGreaterThanOrEqual(r.rows[i]!.expectedGain);
    }
    const hat = r.rows.find((x) => x.slot === 'hat')!;
    expect(hat.boss).toBe(true);
    // ボス防具は19種から4行を重複なしで抽選。ヒーローで寄与ゼロの種類は10(INT, LUK, INT+LUK, HP, MP,
    // 着用Lv減少, 防御力, 魔力, 移動速度, ジャンプ力)→ 改善しない確率 = C(10,4)/C(19,4) = 210/3876
    expect(hat.pImprove).toBeCloseTo(1 - 210 / 3876, 12);
    expect(hat.pImprove).toBeGreaterThan(0.94);
    expect(hat.expectedFlames).toBeCloseTo(1 / hat.pImprove, 12);
    expect(hat.curScore).toBe(0);
    for (const row of r.rows) {
      expect(row.assumptions[0]).toBe('KMS公式の確率(JMS非公開)');
      expect(row.expectedGain).toBeGreaterThan(0);
    }
  });

  it('reports the current flame score in main-stat units', () => {
    const top = r.rows.find((x) => x.slot === 'top')!;
    expect(Math.abs(top.curScoreMainStat - 50)).toBeLessThanOrEqual(0.02 * 50);
    const unit = linearWeights(cpStateFrom(ch, CTX.idx.jobsById.get('hero')!)).mainFlat;
    expect(top.curScore).toBeCloseTo(top.curScoreMainStat * unit, 6);
  });
});

describe('planner: performance', () => {
  it('handles 20 equips × 120 steps quickly', () => {
    const slots = EQUIP_SLOTS.filter((s) => s !== 'overall' && s !== 'pocket');
    expect(slots.length).toBe(20);
    const eqs = slots.map((s) =>
      equip(s, 160, s === 'secondary' || s === 'emblem' ? 0 : 12, {
        boss: true,
        baseAtt: s === 'weapon' ? 200 : undefined,
        potential: { grade: 'unique', lines: [null, null, null] },
      }),
    );
    const ch = hero(eqs);
    const t0 = performance.now();
    const r = buildPlan(ch, settings({ stepLimit: 120 }), CTX);
    const ms = performance.now() - t0;
    console.info(`planner: 20 equips, ${r.steps.length} steps in ${ms.toFixed(1)} ms`);
    expect(r.steps.length).toBe(120);
    expect(ms).toBeLessThan(2500);
  });
});

describe('planner: client fallback', () => {
  it('runs in-thread when Worker is unavailable', async () => {
    expect(typeof Worker).toBe('undefined');
    const client = createPlannerClient();
    await client.setMasterData(DATA);
    const ch = hero(baseEquips());
    const s = settings();
    const r = await client.buildPlan(ch, s);
    expect(r.steps.length).toBe(buildPlan(ch, s, CTX).steps.length);
    const w = await client.validate(ch, s);
    expect(Array.isArray(w)).toBe(true);
    const f = await client.rankFlames(ch, s);
    expect(f.rows.length).toBe(6);
    client.terminate();
  });

  it('rejects before master data is set', async () => {
    const client = createPlannerClient();
    await expect(client.buildPlan(hero(baseEquips()), settings())).rejects.toThrow();
  });
});
