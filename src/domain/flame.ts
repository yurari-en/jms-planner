// 追加オプション(転生の炎)の数値・分布・効率(DESIGN.md §6.4 / docs/research/30_flame.md §7)。
// 純粋関数のみ。数値・候補・確率はすべて flame.json(FlameMaster)から読む。

import type { AttackType, FlameBase, FlameMaster, FlameOptionId } from '../data/types';
import type { FlameState } from './character';
import { emptyDelta, STAT_KEYS, type Delta } from './delta';

export type FlameValueKey =
  'STR' | 'DEX' | 'INT' | 'LUK' | 'ATT' | 'MATT' | 'AS' | 'BOSS' | 'DMG' | 'HP';
export type FlameWeights = Partial<Record<FlameValueKey, number>>;
export type FlameValues = Partial<Record<FlameValueKey, number>>;

export interface FlameEquip {
  lv: number;
  weapon: boolean;
  boss: boolean;
  baseAtt: number;
  baseMatt: number;
}

/** フレームの種類キー(設定の基準炎 + 深淵等)。'black' は flames.black.tierTable ('eternal') の段階表を使う */
export type FlameKindKey = FlameBase | 'abyss' | 'drop';

const FLAME_VALUE_KEYS: readonly FlameValueKey[] = [
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

const SINGLE_STATS: Partial<Record<FlameOptionId, FlameValueKey>> = {
  STR: 'STR',
  DEX: 'DEX',
  INT: 'INT',
  LUK: 'LUK',
};

const DOUBLE_STATS: Partial<Record<FlameOptionId, [FlameValueKey, FlameValueKey]>> = {
  STR_DEX: ['STR', 'DEX'],
  STR_INT: ['STR', 'INT'],
  STR_LUK: ['STR', 'LUK'],
  DEX_INT: ['DEX', 'INT'],
  DEX_LUK: ['DEX', 'LUK'],
  INT_LUK: ['INT', 'LUK'],
};

/** 分布キーの丸め(小数6桁)。-0 は 0 に寄せる */
export function roundKey(x: number): number {
  const r = Math.round(x * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}

/** DP 中間の丸め(小数9桁)。浮動小数の誤差でキーが割れるのを防ぐ */
function roundInner(x: number): number {
  const r = Math.round(x * 1e9) / 1e9;
  return r === 0 ? 0 : r;
}

function addTo(m: Map<number, number>, k: number, p: number): void {
  m.set(k, (m.get(k) ?? 0) + p);
}

// ---------------------------------------------------------------- 数値

/** BigInt の切り上げ除算 */
export function ceilDiv(num: bigint, den: bigint): bigint {
  if (den === 0n) throw new Error('ceilDiv: division by zero');
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const q = num / den; // 0 方向へ切り捨て
  return num % den > 0n ? q + 1n : q;
}

/** 武器の攻撃力/魔力の炎値(有理数で ceil)。boss=true: 1.1^(s-3)、false: 1.1^(min(s,5)-1) */
export function weaponFlameAtt(B: number, L: number, tier: number, boss: boolean): number {
  const e = boss ? tier - 3 : Math.min(tier, 5) - 1;
  let num = BigInt(Math.round(B)) * BigInt(Math.floor(L / 40) + 1) * BigInt(tier);
  let den = 100n;
  if (e >= 0) {
    num *= 11n ** BigInt(e);
    den *= 10n ** BigInt(e);
  } else {
    // 有効な段階では来ないが、念のため有理数のまま扱う
    num *= 10n ** BigInt(-e);
    den *= 11n ** BigInt(-e);
  }
  return Number(ceilDiv(num, den));
}

/** 1行の数値(§6.4.2)。REQ_LV/DEF/SPEED/JUMP/MP → {} (戦闘力に入らない) */
export function flameLineValues(opt: FlameOptionId, tier: number, eq: FlameEquip): FlameValues {
  const L = eq.lv;
  const s = tier;
  const single = SINGLE_STATS[opt];
  if (single) {
    const Lp = L >= 250 ? 220 : L;
    return { [single]: (Math.floor(Lp / 20) + 1) * s };
  }
  const dbl = DOUBLE_STATS[opt];
  if (dbl) {
    const v = (Math.floor(L / 40) + 1) * s;
    return { [dbl[0]]: v, [dbl[1]]: v };
  }
  switch (opt) {
    case 'ATT':
      return { ATT: eq.weapon ? weaponFlameAtt(eq.baseAtt, L, s, eq.boss) : s };
    case 'MATT': {
      if (!eq.weapon) return { MATT: s };
      const B = eq.baseMatt > 0 ? eq.baseMatt : eq.baseAtt;
      return { MATT: weaponFlameAtt(B, L, s, eq.boss) };
    }
    case 'ALL_STAT_P':
      return { AS: s };
    case 'BOSS_DMG':
      return { BOSS: 2 * s };
    case 'DMG':
      return { DMG: s };
    case 'HP':
      return { HP: Math.floor(L / 10) * 10 * 3 * s };
    default:
      return {};
  }
}

/** Σ weights[k] * values[k] */
function valuesScore(v: FlameValues, w: FlameWeights): number {
  let sc = 0;
  for (const k of FLAME_VALUE_KEYS) {
    const x = v[k];
    const wk = w[k];
    if (x !== undefined && wk !== undefined && wk !== 0) sc += wk * x;
  }
  return sc;
}

/** 1行のスコア = Σ weights[k] * value[k] */
export function lineScore(
  opt: FlameOptionId,
  tier: number,
  eq: FlameEquip,
  w: FlameWeights,
): number {
  return valuesScore(flameLineValues(opt, tier, eq), w);
}

/** 現在の炎のスコア */
export function flameScore(state: FlameState, w: FlameWeights): number {
  return valuesScore(
    {
      STR: state.str,
      DEX: state.dex,
      INT: state.int,
      LUK: state.luk,
      ATT: state.att,
      MATT: state.matt,
      AS: state.allStatPct,
      BOSS: state.bossPct,
      DMG: state.dmgPct,
      HP: state.hp,
    },
    w,
  );
}

// ---------------------------------------------------------------- 抽選ルール

/** 部位のプール(optionPools.weapon / armor)から levelRestrictions で除外したもの */
export function flamePool(fm: FlameMaster, eq: FlameEquip): FlameOptionId[] {
  const part = eq.weapon ? 'weapon' : 'armor';
  const restr = fm.levelRestrictions[part];
  return fm.optionPools[part].filter((opt) => {
    const minLv = restr[opt];
    return minLv === undefined || eq.lv >= minLv;
  });
}

/** 炎の種類 → 段階確率表のキー(fm.flames[kind].tierTable ?? kind) */
export function tierTableKey(fm: FlameMaster, kind: FlameKindKey): string {
  return fm.flames[kind]?.tierTable ?? kind;
}

/** 段階分布 [tier, p][] (p>0 のみ)。tier = index+1 (+ bossTierBonus if boss) */
export function tierDistribution(
  fm: FlameMaster,
  kind: FlameKindKey,
  boss: boolean,
): [number, number][] {
  const key = tierTableKey(fm, kind);
  const table = fm.tierProbBase_1to5[key];
  if (!table) throw new Error(`flame: unknown tier table '${key}'`);
  const shift = boss ? fm.bossTierBonus : 0;
  const out: [number, number][] = [];
  table.forEach((p, i) => {
    if (p > 0) out.push([i + 1 + shift, p]);
  });
  return out;
}

/** 行数分布 [n, p][]: boss → lineCountProb.boss, else lineCountProb.flameNonBoss */
export function lineCountDistribution(fm: FlameMaster, boss: boolean): [number, number][] {
  const key = boss ? 'boss' : 'flameNonBoss';
  const table = fm.lineCountProb[key];
  if (!table) throw new Error(`flame: unknown line count table '${key}'`);
  return Object.entries(table)
    .map(([n, p]): [number, number] => [Number(n), p])
    .filter(([, p]) => p > 0)
    .sort((a, b) => a[0] - b[0]);
}

/** オプション1行の [段階, 数値, 確率][] */
export function flameValueTable(
  fm: FlameMaster,
  eq: FlameEquip,
  kind: FlameKindKey,
  opt: FlameOptionId,
): [number, FlameValues, number][] {
  return tierDistribution(fm, kind, eq.boss).map(([s, p]) => [s, flameLineValues(opt, s, eq), p]);
}

/** オプション1行のスコア分布 {score: prob} */
function lineScoreDist(
  tiers: [number, number][],
  eq: FlameEquip,
  opt: FlameOptionId,
  w: FlameWeights,
): Map<number, number> {
  const d = new Map<number, number>();
  for (const [s, p] of tiers) addTo(d, roundInner(lineScore(opt, s, eq, w)), p);
  return d;
}

/** 二項係数 C(n, k)(小さい値のみ想定) */
export function binom(n: number, k: number): number {
  if (n < 0 || k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= kk; i++) r = (r * (n - kk + i)) / i;
  return Math.round(r);
}

// ---------------------------------------------------------------- 分布

/** 1回の炎で出るスコア X の厳密分布(DP: 30_flame.md §7.4)。キーは round(score, 6)。確率の合計は 1 */
export function scoreDistributionDP(
  fm: FlameMaster,
  eq: FlameEquip,
  kind: FlameKindKey,
  w: FlameWeights,
): Map<number, number> {
  const pool = flamePool(fm, eq);
  const P = pool.length;
  const tiers = tierDistribution(fm, kind, eq.boss);
  const lines = lineCountDistribution(fm, eq.boss);
  const maxN = lines.reduce((m, [n]) => Math.max(m, n), 0);

  // スコアに寄与するオプション R と、寄与ゼロの個数 z
  const R: Map<number, number>[] = [];
  for (const opt of pool) {
    const d = lineScoreDist(tiers, eq, opt, w);
    if ([...d.keys()].some((k) => k !== 0)) R.push(d);
  }
  const r = R.length;
  const z = P - r;
  const kMax = Math.min(maxN, r);

  // dp[k]: R から k 個選んだ全組合せについての和(確率重みは段階のみ)
  const dp: Map<number, number>[] = [new Map([[0, 1]])];
  for (let k = 1; k <= kMax; k++) dp.push(new Map());
  for (const d of R) {
    for (let k = kMax - 1; k >= 0; k--) {
      const src = dp[k];
      const dst = dp[k + 1];
      if (!src || !dst) continue;
      for (const [a, pa] of src) {
        for (const [b, pb] of d) addTo(dst, roundInner(a + b), pa * pb);
      }
    }
  }

  const out = new Map<number, number>();
  for (const [n, q] of lines) {
    const total = binom(P, n);
    if (total === 0) continue;
    for (let k = 0; k <= Math.min(n, r); k++) {
      const ways = binom(z, n - k);
      const dk = dp[k];
      if (ways === 0 || !dk) continue;
      const c = (q * ways) / total;
      for (const [s, pw] of dk) addTo(out, roundKey(s), c * pw);
    }
  }
  return out;
}

/** 同じものを全列挙で(テスト・検証用)。Python flame_ref.dist と同じ手順 */
export function scoreDistributionEnum(
  fm: FlameMaster,
  eq: FlameEquip,
  kind: FlameKindKey,
  w: FlameWeights,
): Map<number, number> {
  const pool = flamePool(fm, eq);
  const P = pool.length;
  const tiers = tierDistribution(fm, kind, eq.boss);
  const per = pool.map((opt) => [...lineScoreDist(tiers, eq, opt, w)]);
  const out = new Map<number, number>();
  for (const [n, q] of lineCountDistribution(fm, eq.boss)) {
    const total = binom(P, n);
    if (total === 0) continue;
    const pc = q / total;
    // n 個の組合せを辞書順に全部辿る(接頭辞の畳み込みは共有)
    const rec = (start: number, depth: number, acc: [number, number][]): void => {
      if (depth === n) {
        for (const [k, v] of acc) addTo(out, roundKey(k), v * pc);
        return;
      }
      for (let i = start; i <= P - (n - depth); i++) {
        const d = per[i];
        if (!d) continue;
        const nxt = new Map<number, number>();
        for (const [a, pa] of acc) for (const [b, pb] of d) addTo(nxt, a + b, pa * pb);
        rec(i + 1, depth + 1, [...nxt]);
      }
    };
    rec(0, 0, [[0, 1]]);
  }
  return out;
}

// ---------------------------------------------------------------- 効率

export interface FlameEfficiency {
  mean: number;
  pImprove: number;
  gainIfImprove: number;
  expectedGain: number;
}

/** cur = 現在スコア。pImprove = P(X>cur), gainIfImprove = E[X−cur | X>cur] (0 if pImprove=0), expectedGain = E[max(0, X−cur)] */
export function flameEfficiency(dist: Map<number, number>, cur: number): FlameEfficiency {
  let mean = 0;
  let pImprove = 0;
  let expectedGain = 0;
  for (const [x, p] of dist) {
    mean += x * p;
    if (x > cur + 1e-9) {
      pImprove += p;
      expectedGain += (x - cur) * p;
    }
  }
  const gainIfImprove = pImprove > 0 ? expectedGain / pImprove : 0;
  return { mean, pImprove, gainIfImprove, expectedGain };
}

/** FlameState → Delta */
export function flameDelta(f: FlameState, attackType: AttackType): Delta {
  const d = emptyDelta();
  d.flat.STR = f.str;
  d.flat.DEX = f.dex;
  d.flat.INT = f.int;
  d.flat.LUK = f.luk;
  for (const k of STAT_KEYS) d.pct[k] += f.allStatPct;
  d.attFlat = attackType === 'att' ? f.att : f.matt;
  d.bossPct = f.bossPct;
  d.dmgPct = f.dmgPct;
  d.hpFlat = f.hp;
  return d;
}

/** 0/undefined/非有限の重みを落として返す */
export function normalizeWeights(w: FlameWeights): FlameWeights {
  const out: FlameWeights = {};
  for (const k of FLAME_VALUE_KEYS) {
    const v = w[k];
    if (v !== undefined && Number.isFinite(v) && v !== 0) out[k] = v;
  }
  return out;
}
