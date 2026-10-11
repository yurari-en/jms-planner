// 強化順序プランナー(DESIGN.md §6.5)と炎の効率ランキング(§6.4.3)。
// 純粋関数のみ(React / DOM / fetch / ストレージに依存しない)。Worker からも呼ぶ。

import type {
  CubeDef,
  CubeTableKind,
  Grade,
  JobDef,
  MasterData,
  Part,
  PotOption,
  StatKey,
} from '../data/types';
import { buildIndexes, type MasterIndexes } from '../data/indexes';
import {
  SLOT_LABEL_JA,
  type CharacterInput,
  type EquipInput,
  type EquipSlot,
  type PotGrade,
  type PotState,
} from './character';
import {
  applyDelta,
  cpAfter,
  cpStateFrom,
  flameWeights,
  gain,
  jobStatKeys,
  linearWeights,
  potLinesDelta,
  usesCdrConversion,
  type CpState,
  type PotLineContext,
} from './cp';
import { subDelta, type Delta } from './delta';
import { resolveEquip, type EquipMeta } from './equip';
import { flameEfficiency, flameScore, scoreDistributionDP, type FlameWeights } from './flame';
import type {
  CandidateRow,
  FlameRankResult,
  FlameRankRow,
  PlanGroup,
  PlanResult,
  PlanStep,
  PlanWarning,
  PotStep,
  Quartile,
  SfStep,
} from './planTypes';
import { evaluateCandidates, type PotCandidate, type UsefulCategory } from './potential';
import type { CubeSetting, PlannerSettings } from './settings';
import { sfCandidates, sfContribToDelta, sfOptionsFrom } from './starforce';

// ================================================================ コンテキスト

export interface PlanContext {
  data: MasterData;
  idx: MasterIndexes;
}

export function planContextFrom(data: MasterData): PlanContext {
  return { data, idx: buildIndexes(data) };
}

function now(): number {
  const p = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof p?.now === 'function' ? p.now() : Date.now();
}

// ================================================================ 表示ヘルパ

/** 潜在/アディの行(PotState.lines)を PotOption に解決。id が無いとき(または id の指す行の原文が lineKr と食い違うとき)は lineKr で復元を試みる */
export function resolvePotLines(state: PotState, idx: MasterIndexes): (PotOption | null)[] {
  const out: (PotOption | null)[] = [];
  for (let i = 0; i < 3; i++) {
    const id = state.lines[i] ?? null;
    const kr = state.lineKr?.[i] ?? null;
    const byId = id != null ? idx.optionById(id) : undefined;
    if (byId && (!kr || byId.kr === kr)) {
      out.push(byId);
      continue;
    }
    const byKr = kr ? idx.optionByKr(kr) : undefined;
    out.push(byKr ?? byId ?? null);
  }
  return out;
}

/** 目標行の表示用ラベル(例 '攻撃力 : +9%') */
export function targetLineLabel(cat: UsefulCategory, value: number, mainStatLabel: string): string {
  switch (cat.key) {
    case 'statPct':
      return `${mainStatLabel} : +${value}%`;
    case 'allStatPct':
      return `全ステータス : +${value}%`;
    case 'attPct':
      return `攻撃力 : +${value}%`;
    case 'mattPct':
      return `魔力 : +${value}%`;
    case 'bossPct':
      return `ボスモンスター攻撃時のダメージ : +${value}%`;
    case 'cdrSec':
      return `全スキルの再使用待機時間 : -${value}秒`;
    case 'critDmg':
      return `クリティカルダメージ : +${value}%`;
    case 'attFlat':
      return `攻撃力 : +${value}`;
    case 'mattFlat':
      return `魔力 : +${value}`;
    case 'statPerLv':
      return `キャラクターレベル${cat.per ?? 9}ごとに${mainStatLabel} : +${value}`;
    default:
      return `${cat.labelJa} : +${value}`;
  }
}

const KMS_TABLE_JA: Record<CubeTableKind, string> = {
  red: 'レッド',
  black: 'ブラック',
  additional: 'エディショナル',
};

function fallbackPartLabel(part: Part): string {
  if (part === 'overall') return '上着';
  if (part === 'shield' || part === 'forceShield') return '補助武器';
  return part;
}

function equipLabel(meta: EquipMeta): string {
  return meta.name || SLOT_LABEL_JA[meta.slot];
}

// ================================================================ 入力チェック

function resolveDeps(ctx: PlanContext) {
  return {
    itemsById: ctx.idx.itemsById,
    starforce: ctx.data.starforce,
    isNonBossException: ctx.idx.isNonBossException,
    isFlameException: ctx.idx.isFlameException,
  };
}

function characterWarnings(ch: CharacterInput, job: JobDef): PlanWarning[] {
  const out: PlanWarning[] = [];
  if (!(ch.displayedCP > 0)) {
    out.push({ message: '表示戦闘力が未入力のため、上昇量を計算できません' });
  }
  if (!(ch.attack.final > 0)) {
    out.push({
      message: job.attackType === 'matt' ? '魔力が未入力です' : '攻撃力(魔力)が未入力です',
    });
  }
  if (job.statFormula === 'demonAvenger') {
    if (!((ch.hp?.pure ?? 0) > 0)) out.push({ message: 'HP が未入力です' });
  } else {
    const { mainStats } = jobStatKeys(job);
    for (const k of mainStats) {
      if (!(ch.stats[k].final > 0)) out.push({ message: `主ステータス(${k})が未入力です` });
    }
  }
  return out;
}

function equipWarnings(eq: EquipInput, meta: EquipMeta, ctx: PlanContext): PlanWarning[] {
  const out: PlanWarning[] = [];
  const slot = eq.slot;
  if (eq.itemId != null && !ctx.idx.itemsById.has(eq.itemId)) {
    out.push({
      slot,
      message: `${eq.custom?.name || SLOT_LABEL_JA[slot]}: 装備マスタに見つかりません`,
    });
  }
  if (!meta.present) return out;
  const name = equipLabel(meta);
  if (meta.superior) out.push({ slot, message: `${name}: シュペリアル装備は★の計算対象外です` });
  if (eq.star > meta.maxStar) {
    out.push({ slot, message: `${name}: ★が上限(${meta.maxStar})を超えています` });
  }
  const sides: [PotState, string][] = [
    [eq.potential, '潜在'],
    [eq.additional, 'アディ'],
  ];
  for (const [state, label] of sides) {
    if (state.grade === 'none') continue;
    const resolved = resolvePotLines(state, ctx.idx);
    const bad = state.lines.some((id, i) => id != null && resolved[i] == null);
    if (bad) {
      out.push({ slot, message: `${name}: ${label}の行が確率表にありません(再選択してください)` });
    }
  }
  return out;
}

export function validateCharacter(
  ch: CharacterInput,
  _settings: PlannerSettings,
  ctx: PlanContext,
): PlanWarning[] {
  const job = ctx.idx.jobsById.get(ch.jobId);
  if (!job) return [{ message: '職業が見つかりません' }];
  const out = characterWarnings(ch, job);
  const deps = resolveDeps(ctx);
  for (const eq of ch.equips) out.push(...equipWarnings(eq, resolveEquip(eq, deps), ctx));
  return out;
}

// ================================================================ 強化順序

interface PotSide {
  state: PotState;
  lines: (PotOption | null)[];
}

interface Work {
  eq: EquipInput;
  meta: EquipMeta;
  name: string;
  star: number;
  potential: PotSide;
  additional: PotSide;
  lctx: PotLineContext;
  lines2s: number;
  /** null = 再計算が必要 */
  cache: Cand[] | null;
}

interface SfCand {
  kind: 'starforce';
  w: Work;
  from: number;
  to: number;
  cost: number;
  destroys: number;
  delta: Delta;
}

interface PotCand {
  kind: 'potential' | 'additional';
  w: Work;
  c: PotCandidate;
  cost: number;
  delta: Delta;
  fromGrade: PotGrade;
  cdrConverted: boolean;
}

type Cand = SfCand | PotCand;

interface Env {
  ch: CharacterInput;
  settings: PlannerSettings;
  ctx: PlanContext;
  job: JobDef;
  mainStats: StatKey[];
  subStats: StatKey[];
  mainStatLabel: string;
}

function copyPot(p: PotState): PotState {
  const out: PotState = { grade: p.grade, lines: [p.lines[0], p.lines[1], p.lines[2]] };
  if (p.lineKr) out.lineKr = [p.lineKr[0], p.lineKr[1], p.lineKr[2]];
  return out;
}

function makeWork(eq: EquipInput, meta: EquipMeta, env: Env): Work {
  const { settings, ctx, job, mainStats, subStats, ch } = env;
  const lines2s =
    settings.cdrLinesPer2Sec === 'auto' ? job.cdrLinesPer2Sec : settings.cdrLinesPer2Sec;
  const lctx: PotLineContext = {
    level: ch.level,
    mainStats,
    subStats,
    attackType: job.attackType,
  };
  const main = mainStats[0];
  if (meta.part === 'hat' && main) {
    const legPct = ctx.idx.legendaryMainStatPct('hat', meta.lv, main);
    if (legPct != null && lines2s > 0) lctx.cdrPctPerSec = (lines2s / 2) * legPct;
  }
  const potential = copyPot(eq.potential);
  const additional = copyPot(eq.additional);
  return {
    eq,
    meta,
    name: equipLabel(meta),
    star: eq.star,
    potential: { state: potential, lines: resolvePotLines(potential, ctx.idx) },
    additional: { state: additional, lines: resolvePotLines(additional, ctx.idx) },
    lctx,
    lines2s,
    cache: null,
  };
}

function starCandidates(w: Work, env: Env): SfCand[] {
  const { settings, ctx, job } = env;
  const { meta, eq } = w;
  if (!settings.include.starforce || !meta.canStar || !(meta.lv > 0)) return [];
  const limit = Math.min(meta.maxStar, settings.sfMaxTarget, eq.targetStar ?? Infinity);
  if (w.star >= limit) return [];
  const o = sfOptionsFrom(settings, eq.overrides?.sparePriceMel ?? settings.defaultSparePriceMel);
  const ref = {
    lv: meta.lv,
    kind: meta.kind,
    baseAtt: meta.baseAtt,
    baseMatt: meta.baseMatt,
    scrollAtt: meta.scrollAtt,
    scrollMatt: meta.scrollMatt,
    superior: meta.superior,
  };
  return sfCandidates(ctx.data.starforce, ref, w.star, limit, o).map((c) => ({
    kind: 'starforce' as const,
    w,
    from: c.from,
    to: c.to,
    cost: c.cost,
    destroys: c.destroys,
    delta: subDelta(
      sfContribToDelta(c.contribTo, job.attackType),
      sfContribToDelta(c.contribFrom, job.attackType),
    ),
  }));
}

function potCandidates(w: Work, kind: 'potential' | 'additional', env: Env): PotCand[] {
  const { settings, ctx, job, mainStats } = env;
  const { meta } = w;
  const part = meta.part;
  if (!settings.include[kind] || !meta.canPotential || !part) return [];
  const side = w[kind];
  const { data, idx } = ctx;
  const cubes: { def: CubeDef; setting: CubeSetting }[] = [];
  for (const def of data.cubes.cubes) {
    const setting = settings.cubes[def.id];
    if (def.target === kind && setting?.enabled) cubes.push({ def, setting });
  }
  if (cubes.length === 0) return [];
  const lv = meta.lv;
  const cands = evaluateCandidates({
    current: side.state,
    currentLines: side.lines,
    part,
    lv,
    target: kind,
    cubes,
    melPerNP: settings.melPerNP,
    gradeOrder: data.cubes.gradeOrder,
    gradeUp: {
      miracleTime: settings.miracleTime,
      miracleMultiplier: data.cubes.events.miracleTime.tierUpMultiplier,
      useGuarantee: settings.useGuarantee,
    },
    miracleAppliesTo: data.cubes.events.miracleTime.appliesTo,
    resolveTable: (cube, grade) => {
      const r = idx.cubeTable(cube, grade, part, lv);
      return r
        ? {
            lines: r.lines,
            options: data.cubeTables.options,
            fallbackCube: r.fallbackCube,
            fallbackPart: r.fallbackPart,
          }
        : null;
    },
    // gain は state ごとに変わるのでここでは絞り込まない(毎反復で計算し直す)
    gainOf: () => 1,
    ctx: { mainStats, attackType: job.attackType, includePerLv: settings.includePerLvLines },
  });
  const curDelta = potLinesDelta(side.lines, w.lctx);
  const curCdr = usesCdrConversion(side.lines, w.lctx);
  return cands.map((c) => ({
    kind,
    w,
    c,
    cost: c.costMel,
    delta: subDelta(potLinesDelta(c.newLines, w.lctx), curDelta),
    fromGrade: side.state.grade,
    cdrConverted: curCdr || usesCdrConversion(c.newLines, w.lctx),
  }));
}

function candidatesOf(w: Work, env: Env): Cand[] {
  if (!w.cache) {
    w.cache = [
      ...starCandidates(w, env),
      ...potCandidates(w, 'potential', env),
      ...potCandidates(w, 'additional', env),
    ];
  }
  return w.cache;
}

interface Scored {
  cand: Cand;
  gain: number;
  efficiency: number;
}

function scoreAll(works: Work[], st: CpState, env: Env): Scored[] {
  const out: Scored[] = [];
  for (const w of works) {
    for (const cand of candidatesOf(w, env)) {
      if (!(cand.cost > 0) || !Number.isFinite(cand.cost)) continue;
      const g = gain(st, cand.delta);
      if (!(g > 0)) continue;
      out.push({ cand, gain: g, efficiency: g / cand.cost });
    }
  }
  return out;
}

function pickBest(scored: Scored[]): Scored | null {
  let best: Scored | null = null;
  for (const s of scored) {
    if (
      !best ||
      s.efficiency > best.efficiency ||
      (s.efficiency === best.efficiency && s.cand.cost < best.cand.cost)
    ) {
      best = s;
    }
  }
  return best;
}

function sfAssumptions(c: SfCand, env: Env): string[] {
  const { settings } = env;
  const out = ['KMS公式の確率・費用式(JMS非公開)'];
  const mult = settings.star22PlusMultiplier;
  if (mult !== 1 && c.to >= 23) out.push(`★22以上の費用倍率 ${mult}`);
  if (c.destroys > 0) {
    if (settings.destroyMode === 'restorePrev') out.push('破壊時の復旧メル・個数は KMS 比率');
    const spare = c.w.eq.overrides?.sparePriceMel ?? settings.defaultSparePriceMel;
    if (spare === 0) out.push('復旧用装備の価格 0 メルで計算');
  }
  return out;
}

function potAssumptions(c: PotCand, env: Env): string[] {
  const { settings } = env;
  const cube = c.c.cube;
  const out = [
    `${cube.nameJa} は KMS ${KMS_TABLE_JA[cube.kmsEquivalent]}表に対応付け(推定)`,
    '目標行はその等級の最小値で出たと仮定',
  ];
  if (c.c.fallbackCube) out.push('レッド表が無いためブラック表で代用');
  if (c.c.fallbackPart && c.w.meta.part) {
    out.push(`${fallbackPartLabel(c.w.meta.part)}の表で代用`);
  }
  if (c.cdrConverted) out.push(`クール減換算: 2秒 = レジェ主ステ ${c.w.lines2s} 行`);
  if (settings.useGuarantee) out.push('等級上昇保証(天井)を期待値に含む');
  if (settings.miracleTime) out.push('ミラクルタイム(等級上昇率2倍)');
  return out;
}

function newLineLabels(c: PotCandidate, env: Env): string[] {
  const out: string[] = [];
  for (const { cat, count } of c.target.parts) {
    for (let k = 0; k < count; k++) {
      out.push(targetLineLabel(cat, cat.threshold, env.mainStatLabel));
    }
  }
  return out;
}

function makeStep(s: Scored, index: number, st: CpState, env: Env): PlanStep {
  const { cand } = s;
  const w = cand.w;
  const cpBefore = st.displayedCP;
  const after = cpAfter(st, cand.delta);
  const base = {
    id: `${w.meta.slot}:${cand.kind}:${index}`,
    slot: w.meta.slot,
    equipName: w.name,
    itemId: w.eq.itemId,
    lv: w.meta.lv,
    gain: s.gain,
    gainPct: cpBefore > 0 ? (s.gain / cpBefore) * 100 : 0,
    cost: cand.cost,
    efficiency: s.efficiency,
    rank: index + 1,
    quartile: 1 as Quartile,
    cpBefore,
    cpAfter: after,
  };
  if (cand.kind === 'starforce') {
    const step: SfStep = {
      ...base,
      kind: 'starforce',
      from: cand.from,
      to: cand.to,
      destroys: cand.destroys,
      assumptions: sfAssumptions(cand, env),
    };
    return step;
  }
  const c = cand.c;
  const step: PotStep = {
    ...base,
    kind: cand.kind,
    fromGrade: cand.fromGrade,
    toGrade: c.target.grade,
    targetKey: c.target.key,
    targetLabel: c.target.labelJa,
    lineCount: c.newLines.filter(Boolean).length,
    cubeId: c.cube.id,
    cubeName: c.cube.nameJa,
    expectedCubes: c.expectedCubes,
    cubesToGrade: c.cubesToGrade,
    prob: c.prob,
    newLineLabels: newLineLabels(c, env),
    fallbackCube: c.fallbackCube,
    fallbackPart: c.fallbackPart,
    cdrConverted: cand.cdrConverted,
    assumptions: potAssumptions(cand, env),
  };
  return step;
}

function applyToWork(cand: Cand): void {
  const w = cand.w;
  if (cand.kind === 'starforce') {
    w.star = cand.to;
  } else {
    const grade: Grade = cand.c.target.grade;
    const lines = cand.c.newLines;
    w[cand.kind] = {
      state: {
        grade,
        lines: [lines[0]?.id ?? null, lines[1]?.id ?? null, lines[2]?.id ?? null],
      },
      lines: [...lines],
    };
  }
  w.cache = null;
}

function quartileOf(rank: number, n: number): Quartile {
  return Math.min(4, Math.floor((rank - 1) / (n / 4)) + 1) as Quartile;
}

function quartileBoundsOf(steps: PlanStep[]): [number, number, number] {
  if (steps.length === 0) return [0, 0, 0];
  const effs = steps.map((s) => s.efficiency).sort((a, b) => b - a);
  const at = (p: number) => effs[Math.min(effs.length - 1, Math.floor(effs.length * p))] ?? 0;
  return [at(0.25), at(0.5), at(0.75)];
}

function makeGroup(steps: PlanStep[]): PlanGroup {
  const first = steps[0] as PlanStep;
  const last = steps[steps.length - 1] as PlanStep;
  const totalGain = steps.reduce((a, s) => a + s.gain, 0);
  const totalCost = steps.reduce((a, s) => a + s.cost, 0);
  const g: PlanGroup = {
    id: `${first.slot}:${first.kind}:g${first.rank}`,
    kind: first.kind,
    slot: first.slot,
    equipName: first.equipName,
    itemId: first.itemId,
    steps,
    cellLabel: '',
    totalGain,
    totalCost,
    efficiency: totalCost > 0 ? totalGain / totalCost : 0,
    rank: first.rank,
    quartile: first.quartile,
  };
  if (first.kind === 'starforce' && last.kind === 'starforce') {
    g.from = first.from;
    g.to = last.to;
    g.cellLabel = steps.length === 1 ? `${last.to}` : `${first.from}→${last.to}`;
  } else if (first.kind !== 'starforce') {
    g.cellLabel = `×${first.lineCount}`;
  }
  return g;
}

export function groupSteps(steps: PlanStep[]): PlanGroup[] {
  const groups: PlanGroup[] = [];
  let cur: PlanStep[] = [];
  const flush = () => {
    if (cur.length > 0) groups.push(makeGroup(cur));
    cur = [];
  };
  for (const s of steps) {
    const prev = cur[cur.length - 1];
    if (prev && s.kind === 'starforce' && prev.kind === 'starforce' && prev.slot === s.slot) {
      cur.push(s);
      continue;
    }
    flush();
    cur.push(s);
  }
  flush();
  return groups;
}

function candidateRows(w: Work, st: CpState, env: Env): CandidateRow[] {
  const rows: CandidateRow[] = [];
  for (const cand of candidatesOf(w, env)) {
    if (!(cand.cost > 0) || !Number.isFinite(cand.cost)) continue;
    const g = gain(st, cand.delta);
    if (!(g > 0)) continue;
    const efficiency = g / cand.cost;
    if (cand.kind === 'starforce') {
      rows.push({
        kind: 'starforce',
        label: `★${cand.from}→${cand.to}`,
        destroys: cand.destroys,
        cost: cand.cost,
        gain: g,
        efficiency,
      });
    } else {
      rows.push({
        kind: cand.kind,
        label: `${cand.kind === 'potential' ? '潜在' : 'アディ'} ${cand.c.target.labelJa}`,
        prob: cand.c.prob,
        expectedCubes: cand.c.expectedCubes,
        cubeName: cand.c.cube.nameJa,
        cost: cand.cost,
        gain: g,
        efficiency,
      });
    }
  }
  return rows.sort((a, b) => b.efficiency - a.efficiency);
}

function emptyResult(warnings: PlanWarning[], t0: number, finalCP: number): PlanResult {
  return {
    steps: [],
    groups: [],
    quartileBounds: [0, 0, 0],
    candidatesBySlot: {},
    warnings,
    finalCP,
    truncated: false,
    computeMs: now() - t0,
  };
}

export function buildPlan(
  ch: CharacterInput,
  settings: PlannerSettings,
  ctx: PlanContext,
): PlanResult {
  const t0 = now();
  const job = ctx.idx.jobsById.get(ch.jobId);
  if (!job) return emptyResult([{ message: '職業が見つかりません' }], t0, ch.displayedCP);
  const warnings = validateCharacter(ch, settings, ctx);
  let st = cpStateFrom(ch, job);
  if (!(st.displayedCP > 0)) return emptyResult(warnings, t0, ch.displayedCP);

  const { mainStats, subStats } = jobStatKeys(job);
  const env: Env = {
    ch,
    settings,
    ctx,
    job,
    mainStats,
    subStats,
    mainStatLabel: mainStats.length === 1 ? (mainStats[0] as string) : '主ステ',
  };
  const deps = resolveDeps(ctx);
  const works: Work[] = [];
  for (const eq of ch.equips) {
    const meta = resolveEquip(eq, deps);
    if (meta.present) works.push(makeWork(eq, meta, env));
  }

  const candidatesBySlot: Partial<Record<EquipSlot, CandidateRow[]>> = {};
  for (const w of works) candidatesBySlot[w.meta.slot] = candidateRows(w, st, env);

  const steps: PlanStep[] = [];
  const limit = Math.max(0, Math.floor(settings.stepLimit));
  let truncated = false;
  for (;;) {
    const scored = scoreAll(works, st, env);
    const best = pickBest(scored);
    if (!best) break;
    if (steps.length >= limit) {
      truncated = true;
      break;
    }
    steps.push(makeStep(best, steps.length, st, env));
    st = applyDelta(st, best.cand.delta);
    applyToWork(best.cand);
  }

  const n = steps.length;
  for (const s of steps) s.quartile = quartileOf(s.rank, n);

  return {
    steps,
    groups: groupSteps(steps),
    quartileBounds: quartileBoundsOf(steps),
    candidatesBySlot,
    warnings,
    finalCP: st.displayedCP,
    truncated,
    computeMs: now() - t0,
  };
}

// ================================================================ 炎の効率(§6.4.3)

export function rankFlames(
  ch: CharacterInput,
  settings: PlannerSettings,
  ctx: PlanContext,
): FlameRankResult {
  const t0 = now();
  const job = ctx.idx.jobsById.get(ch.jobId);
  if (!job) return { rows: [], warnings: [{ message: '職業が見つかりません' }], computeMs: 0 };
  const warnings = characterWarnings(ch, job);
  const st = cpStateFrom(ch, job);
  const w = flameWeights(st);
  let unit = linearWeights(st).mainFlat;
  if (!(unit > 0)) unit = Math.max(0, ...Object.values(w));
  if (!(unit > 0)) {
    warnings.push({ message: '戦闘力の重みが計算できないため、炎の効率を出せません' });
    return { rows: [], warnings, computeMs: now() - t0 };
  }
  const wq: FlameWeights = {};
  for (const [k, v] of Object.entries(w) as [keyof FlameWeights, number][]) {
    const q = Math.round((v / unit) * 100) / 100;
    if (q !== 0) wq[k] = q;
  }

  const deps = resolveDeps(ctx);
  const rows: FlameRankRow[] = [];
  for (const eq of ch.equips) {
    const meta = resolveEquip(eq, deps);
    if (!meta.present || !meta.canFlame) continue;
    const weapon = meta.kind === 'weapon';
    const eqF = {
      lv: meta.lv,
      weapon,
      boss: meta.boss,
      baseAtt: meta.baseAtt,
      baseMatt: meta.baseMatt,
    };
    const dist = scoreDistributionDP(ctx.data.flame, eqF, settings.flameBase, wq);
    const cur = flameScore(eq.flame, wq);
    const eff = flameEfficiency(dist, cur);
    const assumptions = ['KMS公式の確率(JMS非公開)'];
    if (weapon && !meta.boss) assumptions.push('非ボス武器の攻撃力式は未確定(GMS系)');
    if (settings.flameBase === 'black') assumptions.push('黒い転生の炎の JMS での入手は未確認');
    assumptions.push(meta.boss ? 'ボス報酬装備(4行・段階+2)' : '非ボス(行数 40/40/16/4%)');
    rows.push({
      slot: eq.slot,
      equipName: equipLabel(meta),
      itemId: eq.itemId,
      lv: meta.lv,
      boss: meta.boss,
      pImprove: eff.pImprove,
      gainIfImprove: eff.gainIfImprove * unit,
      expectedGain: eff.expectedGain * unit,
      mean: eff.mean * unit,
      curScore: cur * unit,
      curScoreMainStat: cur,
      expectedFlames: eff.pImprove > 0 ? 1 / eff.pImprove : Infinity,
      assumptions,
    });
  }
  rows.sort((a, b) => b.expectedGain - a.expectedGain);
  return { rows, warnings, computeMs: now() - t0 };
}

// ================================================================ Worker / in-thread 共通の API

export interface PlannerService {
  setMasterData(data: MasterData): void;
  buildPlan(ch: CharacterInput, settings: PlannerSettings): PlanResult;
  rankFlames(ch: CharacterInput, settings: PlannerSettings): FlameRankResult;
  validate(ch: CharacterInput, settings: PlannerSettings): PlanWarning[];
}

/** マスタを1度だけ索引化して保持するサービス(Worker と in-thread フォールバックで共用) */
export function createPlannerService(): PlannerService {
  let ctx: PlanContext | null = null;
  const need = (): PlanContext => {
    if (!ctx) throw new Error('planner: setMasterData() が呼ばれていません');
    return ctx;
  };
  return {
    setMasterData(data) {
      ctx = planContextFrom(data);
    },
    buildPlan: (ch, settings) => buildPlan(ch, settings, need()),
    rankFlames: (ch, settings) => rankFlames(ch, settings, need()),
    validate: (ch, settings) => validateCharacter(ch, settings, need()),
  };
}
