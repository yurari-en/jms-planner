// 戦闘力モデル(DESIGN.md §6.1)。表示戦闘力に因子の比を掛けて強化後の戦闘力を推定する。
// 純粋関数のみ。マスタ(JobDef 等)は引数で受け取る。

import type { AttackType, JobDef, JobStatFormula, PotOption, StatKey } from '../data/types';
import type { CharacterInput, FlameState } from './character';
import { emptyDelta, STAT_KEYS, zeroStats, type Delta, type StatRecord } from './delta';

/** クリダメ項の基礎値(モデル定数。データではない) */
export const CRIT_BASE = 1.35;

export interface CpState {
  displayedCP: number;
  level: number;
  formula: JobStatFormula;
  attackType: AttackType;
  /** 計算上の主ステ(STR/DEX/INT/LUK のみ)。ゼノン: [STR,DEX,LUK]。デーモンアヴェンジャー(主ステ HP): 空になるので代わりに副ステ STR を主ステ扱いにする */
  mainStats: StatKey[];
  /** 副ステ(主ステと重複しないもの) */
  subStats: StatKey[];
  /** %適用前の固定値 */
  base: StatRecord;
  /** %合計 */
  pct: StatRecord;
  /** %未適用 */
  nonPct: StatRecord;
  attFlat: number;
  attPct: number;
  dmgPct: number;
  bossPct: number;
  critDmgPct: number;
  hpPure: number;
  hpAdded: number;
}

function isStatKey(k: string): k is StatKey {
  return (STAT_KEYS as readonly string[]).includes(k);
}

/** job → mainStats/subStats(StatKey のみ) */
export function jobStatKeys(job: JobDef): { mainStats: StatKey[]; subStats: StatKey[] } {
  const main = job.mainStat.filter(isStatKey);
  const sub = job.subStat.filter(isStatKey);
  if (main.length === 0) return { mainStats: sub, subStats: [] };
  return { mainStats: main, subStats: sub.filter((s) => !main.includes(s)) };
}

/** 1 + pct/100。0 以下(または非有限)なら 1 として扱う(ゼロ除算防止) */
function pctDivisor(pct: number): number {
  const m = 1 + pct / 100;
  return Number.isFinite(m) && m > 0 ? m : 1;
}

export function cpStateFrom(ch: CharacterInput, job: JobDef): CpState {
  const { mainStats, subStats } = jobStatKeys(job);
  const base = zeroStats();
  const pct = zeroStats();
  const nonPct = zeroStats();
  for (const k of STAT_KEYS) {
    const s = ch.stats[k];
    base[k] = (s.final - s.nonPct) / pctDivisor(s.pct);
    pct[k] = s.pct;
    nonPct[k] = s.nonPct;
  }
  return {
    displayedCP: ch.displayedCP,
    level: ch.level,
    formula: job.statFormula,
    attackType: job.attackType,
    mainStats,
    subStats,
    base,
    pct,
    nonPct,
    attFlat: ch.attack.final / pctDivisor(ch.attack.pct),
    attPct: ch.attack.pct,
    dmgPct: ch.dmgPct,
    bossPct: ch.bossPct,
    critDmgPct: ch.critDmgPct,
    hpPure: ch.hp?.pure ?? 0,
    hpAdded: ch.hp?.added ?? 0,
  };
}

function statAfter(st: CpState, d: Delta, k: StatKey): number {
  return (st.base[k] + d.flat[k]) * (1 + (st.pct[k] + d.pct[k]) / 100) + st.nonPct[k] + d.nonPct[k];
}

/** S(ステ項) */
export function statTerm(st: CpState, d: Delta): number {
  switch (st.formula) {
    case 'xenon':
      return 4 * (statAfter(st, d, 'STR') + statAfter(st, d, 'DEX') + statAfter(st, d, 'LUK'));
    case 'demonAvenger':
      // HP 項のみ floor(ゲーム内の換算式どおり)
      return (
        Math.floor(st.hpPure / 3.5) +
        0.8 * Math.floor((st.hpAdded + d.hpFlat) / 3.5) +
        statAfter(st, d, 'STR')
      );
    case 'standard': {
      let s = 0;
      for (const k of st.mainStats) s += 4 * statAfter(st, d, k);
      for (const k of st.subStats) s += statAfter(st, d, k);
      return s;
    }
  }
}

export function factors(st: CpState, d: Delta): { S: number; A: number; D: number; C: number } {
  return {
    S: statTerm(st, d),
    A: (st.attFlat + d.attFlat) * (1 + (st.attPct + d.attPct) / 100),
    D: 1 + (st.dmgPct + st.bossPct + d.dmgPct + d.bossPct) / 100,
    C: CRIT_BASE + (st.critDmgPct + d.critDmgPct) / 100,
  };
}

function ratio(after: number, before: number): number {
  if (before === 0 || !Number.isFinite(before) || !Number.isFinite(after)) return 1;
  return after / before;
}

export function cpAfter(st: CpState, d: Delta): number {
  const f0 = factors(st, emptyDelta());
  const f1 = factors(st, d);
  const r = ratio(f1.S, f0.S) * ratio(f1.A, f0.A) * ratio(f1.D, f0.D) * ratio(f1.C, f0.C);
  const out = st.displayedCP * r;
  return Number.isFinite(out) ? out : st.displayedCP;
}

export function gain(st: CpState, d: Delta): number {
  return cpAfter(st, d) - st.displayedCP;
}

/** Δ を取り込んだ新しい状態(displayedCP = cpAfter)。プランナーがステップ適用後に使う */
export function applyDelta(st: CpState, d: Delta): CpState {
  const base = zeroStats();
  const pct = zeroStats();
  const nonPct = zeroStats();
  for (const k of STAT_KEYS) {
    base[k] = st.base[k] + d.flat[k];
    pct[k] = st.pct[k] + d.pct[k];
    nonPct[k] = st.nonPct[k] + d.nonPct[k];
  }
  return {
    ...st,
    displayedCP: cpAfter(st, d),
    mainStats: [...st.mainStats],
    subStats: [...st.subStats],
    base,
    pct,
    nonPct,
    attFlat: st.attFlat + d.attFlat,
    attPct: st.attPct + d.attPct,
    dmgPct: st.dmgPct + d.dmgPct,
    bossPct: st.bossPct + d.bossPct,
    critDmgPct: st.critDmgPct + d.critDmgPct,
    hpAdded: st.hpAdded + d.hpFlat,
  };
}

export interface Weights {
  mainFlat: number;
  subFlat: number;
  attFlat: number;
  attPct: number;
  mainPct: number;
  allStatPct: number;
  bossPct: number;
  dmgPct: number;
  critDmgPct: number;
  hpFlat: number;
}

function unitGain(st: CpState, fill: (d: Delta) => void): number {
  const d = emptyDelta();
  fill(d);
  return gain(st, d);
}

function addAllPct(d: Delta, v: number): void {
  for (const k of STAT_KEYS) d.pct[k] += v;
}

/** HP の floor(x/3.5) で +1 の差分は 0 か 0.8 の階段になるため、HP_WEIGHT_STEP(=floor 2段分)の平均傾きを使う */
const HP_WEIGHT_STEP = 7;

function hpWeight(st: CpState): number {
  if (st.formula !== 'demonAvenger') return 0;
  return unitGain(st, (d) => (d.hpFlat += HP_WEIGHT_STEP)) / HP_WEIGHT_STEP;
}

/** 単位Δの gain(数値微分: 各項目 +1 の gain)。mainFlat = 主ステ(先頭)固定+1、subFlat = 副ステ(先頭)固定+1 (副ステ無しなら 0) など */
export function linearWeights(st: CpState): Weights {
  const main = st.mainStats[0];
  const sub = st.subStats[0];
  return {
    mainFlat: main ? unitGain(st, (d) => (d.flat[main] += 1)) : 0,
    subFlat: sub ? unitGain(st, (d) => (d.flat[sub] += 1)) : 0,
    attFlat: unitGain(st, (d) => (d.attFlat += 1)),
    attPct: unitGain(st, (d) => (d.attPct += 1)),
    mainPct: main ? unitGain(st, (d) => (d.pct[main] += 1)) : 0,
    allStatPct: unitGain(st, (d) => addAllPct(d, 1)),
    bossPct: unitGain(st, (d) => (d.bossPct += 1)),
    dmgPct: unitGain(st, (d) => (d.dmgPct += 1)),
    critDmgPct: unitGain(st, (d) => (d.critDmgPct += 1)),
    hpFlat: hpWeight(st),
  };
}

export type FlameWeightKey =
  'STR' | 'DEX' | 'INT' | 'LUK' | 'ATT' | 'MATT' | 'AS' | 'BOSS' | 'DMG' | 'HP';

/** 炎の分布計算用の重み(各項目 +1 の gain) */
export function flameWeights(st: CpState): Record<FlameWeightKey, number> {
  const att = unitGain(st, (d) => (d.attFlat += 1));
  return {
    STR: unitGain(st, (d) => (d.flat.STR += 1)),
    DEX: unitGain(st, (d) => (d.flat.DEX += 1)),
    INT: unitGain(st, (d) => (d.flat.INT += 1)),
    LUK: unitGain(st, (d) => (d.flat.LUK += 1)),
    ATT: st.attackType === 'att' ? att : 0,
    MATT: st.attackType === 'matt' ? att : 0,
    AS: unitGain(st, (d) => addAllPct(d, 1)),
    BOSS: unitGain(st, (d) => (d.bossPct += 1)),
    DMG: unitGain(st, (d) => (d.dmgPct += 1)),
    HP: hpWeight(st),
  };
}

export interface PotLineContext {
  level: number;
  mainStats: StatKey[];
  subStats: StatKey[];
  attackType: AttackType;
  /** 帽子クール減の換算: 1秒あたり主ステ%(= cdrLinesPer2Sec/2 × レジェ主ステ行%)。undefined/0 → 換算しない */
  cdrPctPerSec?: number;
}

function perLvCount(level: number, per: number | undefined): number {
  if (per === undefined || !(per > 0)) return 0;
  return Math.floor(level / per);
}

/** 潜在/アディ 3行 → Δ(§6.1.2)。null 行は無視 */
export function potLinesDelta(lines: (PotOption | null)[], ctx: PotLineContext): Delta {
  const d = emptyDelta();
  const isAtt = ctx.attackType === 'att';
  const isMatt = ctx.attackType === 'matt';
  for (const o of lines) {
    if (!o) continue;
    const v = o.value;
    switch (o.key) {
      case 'statPct':
        if (o.stat) d.pct[o.stat] += v;
        break;
      case 'statFlat':
        if (o.stat) d.flat[o.stat] += v;
        break;
      case 'allStatPct':
        addAllPct(d, v);
        break;
      case 'allStatFlat':
        for (const k of STAT_KEYS) d.flat[k] += v;
        break;
      case 'statPerLv':
        if (o.stat) d.nonPct[o.stat] += v * perLvCount(ctx.level, o.per);
        break;
      case 'attPct':
        if (isAtt) d.attPct += v;
        break;
      case 'mattPct':
        if (isMatt) d.attPct += v;
        break;
      case 'attFlat':
        if (isAtt) d.attFlat += v;
        break;
      case 'mattFlat':
        if (isMatt) d.attFlat += v;
        break;
      case 'attPerLv':
        if (isAtt) d.attFlat += v * perLvCount(ctx.level, o.per);
        break;
      case 'mattPerLv':
        if (isMatt) d.attFlat += v * perLvCount(ctx.level, o.per);
        break;
      case 'dmgPct':
        d.dmgPct += v;
        break;
      case 'bossPct':
        d.bossPct += v;
        break;
      case 'critDmg':
        d.critDmgPct += v;
        break;
      case 'cdrSec': {
        const main = ctx.mainStats[0];
        if (main && ctx.cdrPctPerSec) d.pct[main] += v * ctx.cdrPctPerSec;
        break;
      }
      default:
        // iedPct / critRate / hp / mp / meso / drop / other は戦闘力に入らない
        break;
    }
  }
  return d;
}

/** 「このΔにクール減換算が含まれるか」: lines に cdrSec があり ctx.cdrPctPerSec > 0 */
export function usesCdrConversion(lines: (PotOption | null)[], ctx: PotLineContext): boolean {
  if (ctx.cdrPctPerSec === undefined || !(ctx.cdrPctPerSec > 0)) return false;
  return lines.some((o) => o?.key === 'cdrSec');
}

/** 炎 → Δ */
export function flameDelta(f: FlameState, attackType: AttackType): Delta {
  const d = emptyDelta();
  d.flat.STR = f.str;
  d.flat.DEX = f.dex;
  d.flat.INT = f.int;
  d.flat.LUK = f.luk;
  d.attFlat = attackType === 'att' ? f.att : f.matt;
  addAllPct(d, f.allStatPct);
  d.bossPct = f.bossPct;
  d.dmgPct = f.dmgPct;
  d.hpFlat = f.hp;
  return d;
}

/** 装備の基本ステ(items.json base) → Δ。参照用 */
export function baseStatsDelta(
  b: { str: number; dex: number; int: number; luk: number; att: number; matt: number; hp: number },
  attackType: AttackType,
): Delta {
  const d = emptyDelta();
  d.flat.STR = b.str;
  d.flat.DEX = b.dex;
  d.flat.INT = b.int;
  d.flat.LUK = b.luk;
  d.attFlat = attackType === 'att' ? b.att : b.matt;
  d.hpFlat = b.hp;
  return d;
}
