// スターフォース(DESIGN.md §6.2)。純粋関数のみ。
// 数値はすべて starforce.json(StarforceMaster)から読む。参照実装: tests/reference/starforce_ref.py

import type {
  AttackType,
  DestroyMode,
  EquipSlotKind,
  SfBandKey,
  StarforceMaster,
  VipRank,
} from '../data/types';
import { STAT_KEYS, emptyDelta, type Delta } from './delta';
import type { PlannerSettings } from './settings';

export interface SfOptions {
  starCatch: boolean;
  discount30: boolean;
  destroyDown30: boolean;
  guarantee51015: boolean;
  plusOneUnder10: boolean;
  vipRank: VipRank;
  /** 現在★22以上のとき基本費用に掛ける倍率 */
  star22PlusMultiplier: number;
  destroyMode: DestroyMode;
  /** 破壊防止する段階(m.safeguard.stars の部分集合) */
  safeguardStars: number[];
  /** 復旧に使う同名装備1個の価格 */
  sparePriceMel: number;
}

export function sfOptionsFrom(s: PlannerSettings, sparePriceMel: number): SfOptions {
  return {
    starCatch: s.starCatch,
    discount30: s.events.discount30,
    destroyDown30: s.events.destroyDown30,
    guarantee51015: s.events.guarantee51015,
    plusOneUnder10: s.events.plusOneUnder10,
    vipRank: s.vipRank,
    star22PlusMultiplier: s.star22PlusMultiplier,
    destroyMode: s.destroyMode,
    safeguardStars: [...s.safeguardStars],
    sparePriceMel,
  };
}

// ---------------------------------------------------------------- 基本

/** 銀行家の丸め(Python の round() と同じ。.5 ちょうどは偶数へ) */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/** 最初に maxLv >= lv となる要素の star */
export function maxStarForLevel(m: StarforceMaster, lv: number): number {
  for (const e of m.maxStarByLevel) {
    if (e.maxLv >= lv) return e.star;
  }
  const last = m.maxStarByLevel[m.maxStarByLevel.length - 1];
  return last ? last.star : 0;
}

/** minLv <= lv となる最後の帯。最初の帯より下なら null */
export function sfBandKey(m: StarforceMaster, lv: number): SfBandKey | null {
  let key: SfBandKey | null = null;
  for (const b of m.stats.levelBands) {
    if (b.minLv <= lv) key = b.key;
  }
  return key;
}

function safeguardApplies(m: StarforceMaster, s: number, o: SfOptions): boolean {
  return o.safeguardStars.includes(s) && m.safeguard.stars.includes(s);
}

// ---------------------------------------------------------------- 費用

/**
 * 1回の基本費用(割引前)。Python base_cost と同じ演算順。
 * 100メル単位の丸めは Python の round()(銀行家の丸め)に合わせる。
 * 注: ゲーム内の表(m.cost.referencePerAttempt)とは .5 ちょうどになる4マス
 * (例: L130 ★8 = 550200 / 表は 550300)で100メル異なる(表は四捨五入)。参照実装に合わせて直さない。
 */
export function baseAttemptCost(m: StarforceMaster, L: number, s: number, mult22 = 1): number {
  let c: number;
  if (s < 10) {
    c = 1000 + (L ** 3 * (s + 1)) / 36;
  } else {
    const div = m.cost.divisor[String(s)];
    if (div === undefined) throw new Error(`starforce: divisor for ★${s} not found`);
    c = 1000 + (L ** 3 * (s + 1) ** 2.7) / div;
  }
  c = roundHalfEven(c / 100) * 100;
  if (s >= 22) c = roundHalfEven(c * mult22);
  return c;
}

/** 割引・破壊防止込みの1回費用(Python attempt_cost) */
export function attemptCost(m: StarforceMaster, L: number, s: number, o: SfOptions): number {
  const c = baseAttemptCost(m, L, s, o.star22PlusMultiplier);
  let disc = 1;
  if (o.discount30) disc *= m.events.discount30.costMultiplier;
  const vip = m.discounts.vip.rates[o.vipRank];
  if (vip > 0 && s <= m.discounts.vip.maxCurrentStar) disc *= 1 - vip;
  let total = c * disc;
  // 破壊防止の加算分は割引対象外
  if (safeguardApplies(m, s, o)) total += c * m.safeguard.surchargeRate;
  return total;
}

// ---------------------------------------------------------------- 確率

/** 成功/維持/破壊(Python probs + 破壊防止) */
export function transitionProbs(
  m: StarforceMaster,
  s: number,
  o: SfOptions,
): { success: number; keep: number; destroy: number } {
  const row = m.probabilityBase.table[s];
  if (!row) throw new Error(`starforce: probability for ★${s} not found`);
  let [p, k, d] = row;
  if (o.guarantee51015 && m.events.guarantee51015.stars.includes(s)) {
    return { success: 1, keep: 0, destroy: 0 };
  }
  const dd = m.events.destroyDown30;
  if (o.destroyDown30 && s <= dd.maxCurrentStar && d > 0) {
    // Python: k + d*0.3, d*0.7(0.3 = 1 − destroyMultiplier)
    [k, d] = [k + d * (1 - dd.destroyMultiplier), d * dd.destroyMultiplier];
  }
  if (o.starCatch) {
    const p2 = Math.min(1, p * m.starCatch.successMultiplier);
    const rest = 1 - p2;
    const tot = k + d;
    if (tot > 0) [k, d] = [(rest * k) / tot, (rest * d) / tot];
    p = p2;
  }
  if (safeguardApplies(m, s, o)) {
    k = k + d;
    d = 0;
  }
  return { success: p, keep: k, destroy: d };
}

// ---------------------------------------------------------------- 破壊

/** 破壊時の戻り先と追加費用(Python restore) */
export function restoreOnDestroy(
  m: StarforceMaster,
  L: number,
  s: number,
  o: SfOptions,
): { star: number; cost: number } {
  const ds = m.destruction;
  if (o.destroyMode === 'restart12') return { star: ds.basicRestoreStar, cost: o.sparePriceMel };
  const t = Math.min(s, ds.traceCapStar);
  const spares = ds.restoreSpares.find((x) => t <= x.maxStar);
  const count = spares ? spares.count : 0;
  const ratio = ds.restoreMesoRatio[String(t)] ?? 0;
  // Python と同じく倍率 1(★22以上倍率は掛けない)
  return { star: t, cost: ratio * baseAttemptCost(m, L, t, 1) + count * o.sparePriceMel };
}

// ---------------------------------------------------------------- 期待値

/** 計算に含める最下位の状態 */
function lowestState(m: StarforceMaster, from: number, o: SfOptions): number {
  return o.destroyMode === 'restart12'
    ? Math.min(from, m.destruction.basicRestoreStar)
    : Math.min(from, m.destruction.traceCapStar);
}

/** from→to の期待メルと期待破壊回数(Python expected。前から解く漸化式) */
export function expectedCost(
  m: StarforceMaster,
  L: number,
  from: number,
  to: number,
  o: SfOptions,
): { mel: number; destroys: number } {
  if (to <= from) return { mel: 0, destroys: 0 };
  if (o.plusOneUnder10) return expectedCostMarkov(m, L, from, to, o);
  const lo = lowestState(m, from, o);
  const step = new Map<number, number>();
  const stepD = new Map<number, number>();
  const get = (mp: Map<number, number>, t: number): number => {
    const v = mp.get(t);
    if (v === undefined) throw new Error(`starforce: step[${t}] not computed`);
    return v;
  };
  for (let s = lo; s < to; s++) {
    const { success: p, destroy: d } = transitionProbs(m, s, o);
    const c = attemptCost(m, L, s, o);
    if (d > 0) {
      const { star: r, cost: rc } = restoreOnDestroy(m, L, s, o);
      let back = 0;
      let backD = 0;
      for (let t = r; t < s; t++) {
        back += get(step, t);
        backD += get(stepD, t);
      }
      step.set(s, (c + d * (rc + back)) / p);
      stepD.set(s, (d * (1 + backD)) / p);
    } else {
      step.set(s, c / p);
      stepD.set(s, 0);
    }
  }
  let mel = 0;
  let destroys = 0;
  for (let s = from; s < to; s++) mel += get(step, s);
  for (let s = from; s < to; s++) destroys += get(stepD, s);
  return { mel, destroys };
}

/** 成功時の遷移先(plusOneUnder10: 対象★以下は +2、最大12) */
function successTarget(m: StarforceMaster, s: number, o: SfOptions): number {
  if (o.plusOneUnder10 && s <= m.events.plusOneUnder10.maxCurrentStar) {
    return Math.max(s + 1, Math.min(s + 2, m.destruction.basicRestoreStar));
  }
  return s + 1;
}

/**
 * 一般形: 状態 lo..to の吸収マルコフ連鎖をガウス消去で解く(to 以上は吸収 = 目標到達)。
 * E[s] = c(s) + p·E[succ] + k·E[s] + d·(R(s) + E[r]) ; N[s] = p·N[succ] + k·N[s] + d·(1 + N[r])
 */
export function expectedCostMarkov(
  m: StarforceMaster,
  L: number,
  from: number,
  to: number,
  o: SfOptions,
): { mel: number; destroys: number } {
  if (to <= from) return { mel: 0, destroys: 0 };
  const lo = lowestState(m, from, o);
  const n = to - lo; // 未吸収の状態 lo..to-1
  // 拡大係数行列 [A | bMel | bDestroy]
  const A: number[][] = [];
  for (let i = 0; i < n; i++) A.push(new Array<number>(n + 2).fill(0));
  const row = (i: number): number[] => {
    const r = A[i];
    if (!r) throw new Error('starforce: matrix row out of range');
    return r;
  };
  const add = (i: number, j: number, v: number): void => {
    const r = row(i);
    r[j] = (r[j] ?? 0) + v;
  };
  for (let s = lo; s < to; s++) {
    const i = s - lo;
    const { success: p, keep: k, destroy: d } = transitionProbs(m, s, o);
    add(i, i, 1 - k);
    const succ = successTarget(m, s, o);
    if (succ < to) add(i, succ - lo, -p);
    let rhs = attemptCost(m, L, s, o);
    let rhsD = 0;
    if (d > 0) {
      const { star: r, cost: rc } = restoreOnDestroy(m, L, s, o);
      if (r < lo) throw new Error(`starforce: restore target ★${r} below ★${lo}`);
      if (r < to) add(i, r - lo, -d);
      rhs += d * rc;
      rhsD += d;
    }
    add(i, n, rhs);
    add(i, n + 1, rhsD);
  }
  // 部分ピボット付きガウス・ジョルダン消去
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(row(r)[c] ?? 0) > Math.abs(row(piv)[c] ?? 0)) piv = r;
    }
    if (piv !== c) {
      const tmp = row(c);
      A[c] = row(piv);
      A[piv] = tmp;
    }
    const pr = row(c);
    const pv = pr[c] ?? 0;
    if (pv === 0) throw new Error('starforce: singular system');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const rr = row(r);
      const f = (rr[c] ?? 0) / pv;
      if (f === 0) continue;
      for (let j = c; j < n + 2; j++) rr[j] = (rr[j] ?? 0) - f * (pr[j] ?? 0);
    }
  }
  const i0 = from - lo;
  const r0 = row(i0);
  const diag = r0[i0] ?? 1;
  return { mel: (r0[n] ?? 0) / diag, destroys: (r0[n + 1] ?? 0) / diag };
}

// ---------------------------------------------------------------- 上昇量

/** ★による STR/DEX/INT/LUK それぞれの累積上昇 */
export function sfStatBonus(m: StarforceMaster, L: number, star: number): number {
  if (star <= 0) return 0;
  const c15 = m.stats.statCumulative1to15;
  const v15 = c15[Math.min(star, c15.length) - 1] ?? 0;
  if (star <= 15) return v15;
  const band = sfBandKey(m, L);
  const arr = band ? m.stats.statCumulative16[band] : undefined;
  if (!arr || arr.length === 0) return v15;
  // ★23以上は★22と同じ(配列末尾で頭打ち)
  return arr[Math.min(star - 16, arr.length - 1)] ?? v15;
}

/** 防具・アクセの累積攻撃力(=魔力)。武器には使わない(0 を返す) */
export function sfArmorAttBonus(
  m: StarforceMaster,
  L: number,
  star: number,
  kind: EquipSlotKind,
): number {
  if (kind === 'weapon' || star <= 0) return 0;
  let v = 0;
  if (kind === 'gloves') v += m.stats.gloveAttStars.filter((x) => x <= star).length;
  if (star >= 16) {
    const band = sfBandKey(m, L);
    const arr = band ? m.stats.armorAttCumulative16[band] : undefined;
    if (arr && arr.length > 0) v += arr[Math.min(star - 16, arr.length - 1)] ?? 0;
  }
  return v;
}

/**
 * 武器の★による攻撃力上昇(累積)。attStart = 基本 + 書。L は元の装備Lv。
 * 表に値が無い段階(未確定)は null。attStart<=0 は 0。
 */
export function sfWeaponAttBonus(
  m: StarforceMaster,
  L: number,
  star: number,
  attStart: number,
): number | null {
  if (attStart <= 0 || star <= 0) return 0;
  let att = attStart;
  for (let i = 1; i <= Math.min(star, 15); i++) att += Math.floor(att / 50) + 1;
  const b15 = att - attStart;
  if (star <= 15) return b15;
  const band = sfBandKey(m, L);
  if (!band) return null;
  const v = m.stats.weaponAttCumulative16[band]?.[star - 16];
  return v === undefined ? null : b15 + v;
}

export interface SfEquipRef {
  lv: number;
  kind: EquipSlotKind;
  baseAtt: number;
  baseMatt: number;
  scrollAtt: number;
  scrollMatt: number;
  superior?: boolean;
}

export interface SfContrib {
  stat: number;
  att: number;
  matt: number;
}

/**
 * 装備1部位の★寄与(§6.2.1)。superior → null(v1 対象外)。star<=0 → ゼロ。
 * 星が最大★(maxStar 省略時は maxStarForLevel)を超える → null。武器で段階が未確定 → null。
 */
export function sfContrib(
  m: StarforceMaster,
  eq: SfEquipRef,
  star: number,
  maxStar?: number,
): SfContrib | null {
  if (eq.superior) return null;
  if (star <= 0) return { stat: 0, att: 0, matt: 0 };
  if (star > (maxStar ?? maxStarForLevel(m, eq.lv))) return null;
  const stat = sfStatBonus(m, eq.lv, star);
  if (eq.kind === 'weapon') {
    const att = sfWeaponAttBonus(m, eq.lv, star, eq.baseAtt + eq.scrollAtt);
    const matt = sfWeaponAttBonus(m, eq.lv, star, eq.baseMatt + eq.scrollMatt);
    if (att === null || matt === null) return null;
    return { stat, att, matt };
  }
  const a = sfArmorAttBonus(m, eq.lv, star, eq.kind);
  return { stat, att: a, matt: a };
}

/** SfContrib → Delta(%が掛かる固定値として加算) */
export function sfContribToDelta(c: SfContrib, attackType: AttackType): Delta {
  const d = emptyDelta();
  for (const k of STAT_KEYS) d.flat[k] += c.stat;
  d.attFlat += attackType === 'att' ? c.att : c.matt;
  return d;
}

export interface SfCandidate {
  from: number;
  to: number;
  cost: number;
  destroys: number;
  contribFrom: SfContrib;
  contribTo: SfContrib;
}

/**
 * 現在★ star から t = star+1 .. min(star+6, limit) の候補(§6.2.5)。
 * limit は呼び出し側で min(最大★(上書き込み), sfMaxTarget, targetStar) を渡す。
 * contrib が null になる段階で打ち切る。
 */
export function sfCandidates(
  m: StarforceMaster,
  eq: SfEquipRef,
  star: number,
  limit: number,
  o: SfOptions,
): SfCandidate[] {
  // limit には上書き最大★が入りうるので、ここでは maxStarForLevel で弾かない
  const maxStar = Math.max(limit, star, maxStarForLevel(m, eq.lv));
  const contribFrom = sfContrib(m, eq, star, maxStar);
  if (!contribFrom) return [];
  const out: SfCandidate[] = [];
  const hi = Math.min(star + 6, limit);
  for (let t = star + 1; t <= hi; t++) {
    const contribTo = sfContrib(m, eq, t, maxStar);
    if (!contribTo) break;
    const { mel, destroys } = expectedCost(m, eq.lv, star, t, o);
    out.push({ from: star, to: t, cost: mel, destroys, contribFrom, contribTo });
  }
  return out;
}
