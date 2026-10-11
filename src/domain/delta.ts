// 戦闘力モデルに与える変化量 Δ(DESIGN.md §6.1.2)。
// 純粋なデータ型とその演算のみ。各モジュール(cp / starforce / potential / flame)が共有する。

import type { StatKey } from '../data/types';

export const STAT_KEYS: readonly StatKey[] = ['STR', 'DEX', 'INT', 'LUK'] as const;

export type StatRecord = Record<StatKey, number>;

export interface Delta {
  /** %が掛かる固定値(装備基本ステ・★・潜在固定・炎 など) */
  flat: StatRecord;
  /** 主ステ% など。全ステ%は4つすべてに足す */
  pct: StatRecord;
  /** %が掛からない固定値(レベルごと主ステ など) */
  nonPct: StatRecord;
  /** 攻撃力(魔法職は魔力)の固定値。%の対象になる */
  attFlat: number;
  attPct: number;
  dmgPct: number;
  bossPct: number;
  critDmgPct: number;
  /** デーモンアヴェンジャー用(追加HP に足す) */
  hpFlat: number;
}

export function zeroStats(): StatRecord {
  return { STR: 0, DEX: 0, INT: 0, LUK: 0 };
}

export function emptyDelta(): Delta {
  return {
    flat: zeroStats(),
    pct: zeroStats(),
    nonPct: zeroStats(),
    attFlat: 0,
    attPct: 0,
    dmgPct: 0,
    bossPct: 0,
    critDmgPct: 0,
    hpFlat: 0,
  };
}

function combine(a: Delta, b: Delta, sign: 1 | -1): Delta {
  const out = emptyDelta();
  for (const k of STAT_KEYS) {
    out.flat[k] = a.flat[k] + sign * b.flat[k];
    out.pct[k] = a.pct[k] + sign * b.pct[k];
    out.nonPct[k] = a.nonPct[k] + sign * b.nonPct[k];
  }
  out.attFlat = a.attFlat + sign * b.attFlat;
  out.attPct = a.attPct + sign * b.attPct;
  out.dmgPct = a.dmgPct + sign * b.dmgPct;
  out.bossPct = a.bossPct + sign * b.bossPct;
  out.critDmgPct = a.critDmgPct + sign * b.critDmgPct;
  out.hpFlat = a.hpFlat + sign * b.hpFlat;
  return out;
}

/** a + b */
export function addDelta(a: Delta, b: Delta): Delta {
  return combine(a, b, 1);
}

/** a − b */
export function subDelta(a: Delta, b: Delta): Delta {
  return combine(a, b, -1);
}

export function scaleDelta(a: Delta, k: number): Delta {
  const out = emptyDelta();
  for (const s of STAT_KEYS) {
    out.flat[s] = a.flat[s] * k;
    out.pct[s] = a.pct[s] * k;
    out.nonPct[s] = a.nonPct[s] * k;
  }
  out.attFlat = a.attFlat * k;
  out.attPct = a.attPct * k;
  out.dmgPct = a.dmgPct * k;
  out.bossPct = a.bossPct * k;
  out.critDmgPct = a.critDmgPct * k;
  out.hpFlat = a.hpFlat * k;
  return out;
}

export function isZeroDelta(d: Delta, eps = 0): boolean {
  for (const s of STAT_KEYS) {
    if (Math.abs(d.flat[s]) > eps || Math.abs(d.pct[s]) > eps || Math.abs(d.nonPct[s]) > eps)
      return false;
  }
  return (
    Math.abs(d.attFlat) <= eps &&
    Math.abs(d.attPct) <= eps &&
    Math.abs(d.dmgPct) <= eps &&
    Math.abs(d.bossPct) <= eps &&
    Math.abs(d.critDmgPct) <= eps &&
    Math.abs(d.hpFlat) <= eps
  );
}
