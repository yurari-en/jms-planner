// 潜在能力・アディショナルの計算。DESIGN.md §6.3 に準拠。
// 純粋関数のみ。確率表・キューブ定義はすべて引数で受け取る(数値の直書きなし)。

import type {
  AttackType,
  CubeDef,
  CubeTableKind,
  Grade,
  LineDist,
  OptionKey,
  Part,
  PotOption,
  StatKey,
  TierUpGrade,
} from '../data/types';
import type { PotGrade, PotState } from './character';
import type { CubeSetting } from './settings';

// ================================================================ Part 1: 目標達成確率(§6.3.2)

export interface TargetCategory {
  id: string;
  match: (o: PotOption) => boolean;
}

type Group = PotOption['group'];

interface LineState {
  cat: string | null;
  group: Group;
  p: number;
}

/** 1行の分布を (カテゴリ, 制限グループ) の状態に縮約(potential_ref.py の dist と同じ) */
function reduceLine(line: LineDist, options: PotOption[], cats: TargetCategory[]): LineState[] {
  const map = new Map<string, LineState>();
  for (const [oid, pct] of line) {
    const o = options[oid];
    if (!o) continue;
    const cat = cats.find((c) => c.match(o))?.id ?? null;
    const group = o.group;
    const k = `${cat ?? ''}\u0000${group ?? ''}`;
    const s = map.get(k);
    if (s) s.p += pct / 100;
    else map.set(k, { cat, group, p: pct / 100 });
  }
  return [...map.values()];
}

function groupFull(group: Group, used: Record<string, number>): boolean {
  if (group === 'maxOne') return (used.maxOne ?? 0) >= 1;
  if (group === 'maxTwo') return (used.maxTwo ?? 0) >= 2;
  return false;
}

/** 3行が独立に lines[i](LineDist, %表記) から抽選されるとき、各カテゴリが need[id] 行以上揃う確率。
 *  各行は「最初に一致したカテゴリ」1つにだけ数える。制限グループ: maxOne は3行中1行まで、maxTwo は2行まで。
 *  上限に達したグループのオプションは次の行の候補から除き、残りを p/(1−除外分) で再正規化(Python rec と同じ) */
export function probTarget(
  lines: LineDist[],
  options: PotOption[],
  cats: TargetCategory[],
  need: Record<string, number>,
): number {
  const D = lines.map((l) => reduceLine(l, options, cats));
  const needEntries = Object.entries(need);
  let total = 0;
  const rec = (
    i: number,
    used: Record<string, number>,
    counts: Record<string, number>,
    pr: number,
  ): void => {
    const d = D[i];
    if (!d) {
      if (needEntries.every(([k, v]) => (counts[k] ?? 0) >= v)) total += pr;
      return;
    }
    let excluded = 0;
    for (const s of d) if (groupFull(s.group, used)) excluded += s.p;
    const norm = 1 - excluded;
    for (const s of d) {
      if (groupFull(s.group, used)) continue;
      const ug = s.group ? { ...used, [s.group]: (used[s.group] ?? 0) + 1 } : used;
      const cc = s.cat ? { ...counts, [s.cat]: (counts[s.cat] ?? 0) + 1 } : counts;
      rec(i + 1, ug, cc, (pr * s.p) / norm);
    }
  };
  rec(0, {}, {}, 1);
  return total;
}

// ================================================================ Part 2: 等級上昇(§6.3.4)

export interface GradeUpOptions {
  miracleTime: boolean;
  miracleMultiplier: number;
  miracleApplies: boolean;
  useGuarantee: boolean;
}

/** 'none' → index of 'rare' */
export function gradeIndex(g: PotGrade, gradeOrder: Grade[]): number {
  return gradeOrder.indexOf(g === 'none' ? 'rare' : g);
}

/** from(現在等級。'none' は 'rare' 扱い)→ to までの期待キューブ数 Σ E_h。to <= from → 0。
 *  キューブの最高等級を超える / 等級上昇率が無い場合は Infinity */
export function cubesToGrade(
  cube: CubeDef,
  from: PotGrade,
  to: Grade,
  gradeOrder: Grade[],
  o: GradeUpOptions,
): number {
  const a = gradeIndex(from, gradeOrder);
  const b = gradeIndex(to, gradeOrder);
  if (b <= a) return 0;
  if (b > gradeIndex(cube.maxGrade, gradeOrder)) return Infinity;
  const mult = o.miracleTime && o.miracleApplies ? o.miracleMultiplier : 1;
  let sum = 0;
  for (let i = a; i < b; i++) {
    const h = gradeOrder[i] as TierUpGrade;
    const base = cube.tierUp[h];
    if (base === undefined || !(base > 0)) return Infinity;
    const q = Math.min(1, base * mult);
    const n = cube.guarantee[h];
    sum += o.useGuarantee && n !== undefined && n > 0 ? (1 - (1 - q) ** n) / q : 1 / q;
  }
  return sum;
}

// ================================================================ Part 3: 有用カテゴリと目標(§6.3.3)

export type CatKind =
  'mainPct' | 'allStatPct' | 'attPct' | 'bossPct' | 'cdr' | 'critDmg' | 'attFlat' | 'perLv';

export interface UsefulCategory {
  /** 表の中で一意(例 'mainPct', 'cdr2') */
  id: string;
  kind: CatKind;
  key: OptionKey;
  /** mainPct / perLv: 数えるステータス(ゼノンは STR/DEX/LUK) */
  stats?: StatKey[];
  /** その表の3行に出るこのカテゴリの最小値 */
  threshold: number;
  /** perLv: しきい値のオプションの「Lv何ごと」 */
  per?: number;
  labelJa: string;
  match: (o: PotOption) => boolean;
}

export interface CategoryContext {
  part: Part;
  target: 'potential' | 'additional';
  mainStats: StatKey[];
  attackType: AttackType;
  includePerLv: boolean;
}

interface CatSpec {
  kind: CatKind;
  key: OptionKey;
  stats?: StatKey[];
  labelJa: string;
}

function catSpecs(ctx: CategoryContext): CatSpec[] {
  const magic = ctx.attackType === 'matt';
  const attPct: CatSpec = {
    kind: 'attPct',
    key: magic ? 'mattPct' : 'attPct',
    labelJa: magic ? '魔力%' : '攻撃力%',
  };
  const attFlat: CatSpec = {
    kind: 'attFlat',
    key: magic ? 'mattFlat' : 'attFlat',
    labelJa: magic ? '魔力+' : '攻撃力+',
  };
  const boss: CatSpec = { kind: 'bossPct', key: 'bossPct', labelJa: 'ボス%' };
  const main: CatSpec = {
    kind: 'mainPct',
    key: 'statPct',
    stats: ctx.mainStats,
    labelJa: '主ステ%',
  };
  const all: CatSpec = { kind: 'allStatPct', key: 'allStatPct', labelJa: '全ステ%' };
  const cdr: CatSpec = { kind: 'cdr', key: 'cdrSec', labelJa: 'クール減' };
  const cd: CatSpec = { kind: 'critDmg', key: 'critDmg', labelJa: 'クリダメ%' };
  const add = ctx.target === 'additional';
  let specs: CatSpec[];
  switch (ctx.part) {
    case 'weapon':
    case 'secondary':
    case 'shield':
    case 'forceShield':
      specs = [attPct, boss, main];
      break;
    case 'emblem':
      specs = [attPct, main];
      break;
    case 'hat':
      specs = add ? [attFlat, main, all, cdr] : [main, all, cdr];
      break;
    case 'gloves':
      specs = add ? [attFlat, main, all, cd] : [main, all, cd];
      break;
    default:
      specs = add ? [attFlat, main, all] : [main, all];
  }
  if (ctx.includePerLv) {
    specs.push({
      kind: 'perLv',
      key: 'statPerLv',
      stats: ctx.mainStats,
      labelJa: 'レベルごと主ステ',
    });
  }
  return specs;
}

function specMatches(spec: { key: OptionKey; stats?: StatKey[] }, o: PotOption): boolean {
  if (o.key !== spec.key) return false;
  if (spec.stats) return o.stat !== undefined && spec.stats.includes(o.stat);
  return true;
}

function makeCategory(
  spec: CatSpec,
  id: string,
  threshold: number,
  labelJa: string,
  per?: number,
): UsefulCategory {
  const { kind, key, stats } = spec;
  const cat: UsefulCategory = {
    id,
    kind,
    key,
    threshold,
    labelJa,
    match: (o) => specMatches(spec, o) && o.value >= threshold,
  };
  if (stats) cat.stats = stats;
  if (per !== undefined) cat.per = per;
  return cat;
}

/** その表(3行)に実在するカテゴリだけ返す(DESIGN §6.3.3 の表) */
export function usefulCategories(
  lines: LineDist[],
  options: PotOption[],
  ctx: CategoryContext,
): UsefulCategory[] {
  const present: PotOption[] = [];
  const seen = new Set<number>();
  for (const line of lines) {
    for (const [oid, pct] of line) {
      if (!(pct > 0) || seen.has(oid)) continue;
      const o = options[oid];
      if (!o) continue;
      seen.add(oid);
      present.push(o);
    }
  }
  const out: UsefulCategory[] = [];
  for (const spec of catSpecs(ctx)) {
    const hits = present.filter((o) => specMatches(spec, o));
    if (hits.length === 0) continue;
    if (spec.kind === 'cdr') {
      const values = [...new Set(hits.map((o) => o.value))].sort((a, b) => a - b);
      for (const v of values) {
        out.push(makeCategory(spec, `cdr${v}`, v, `${spec.labelJa}-${v}秒`));
      }
      continue;
    }
    let min = hits[0] as PotOption;
    for (const o of hits) if (o.value < min.value) min = o;
    out.push(makeCategory(spec, spec.kind, min.value, spec.labelJa, min.per));
  }
  return out;
}

export interface PotTarget {
  grade: Grade;
  /** 1〜2種類のカテゴリ、合計 1〜3 行 */
  parts: { cat: UsefulCategory; count: number }[];
  /** 例 'legendary|attPct:2|bossPct:1' */
  key: string;
  /** 例 'レジェ / 攻撃力%×2 + ボス%×1' */
  labelJa: string;
}

const GRADE_LABEL_JA: Record<Grade, string> = {
  rare: 'レア',
  epic: 'エピック',
  unique: 'ユニーク',
  legendary: 'レジェ',
};

const MAX_LINES = 3;

function makeTarget(grade: Grade, parts: { cat: UsefulCategory; count: number }[]): PotTarget {
  return {
    grade,
    parts,
    key: [grade, ...parts.map((p) => `${p.cat.id}:${p.count}`)].join('|'),
    labelJa: `${GRADE_LABEL_JA[grade]} / ${parts.map((p) => `${p.cat.labelJa}×${p.count}`).join(' + ')}`,
  };
}

/** 等級ごとのカテゴリから目標を列挙: カテゴリの多重集合(合計1〜3行、カテゴリは最大2種類)。
 *  同じ key を持つカテゴリ同士(cdr1/cdr2)は同一目標に同居させない */
export function enumerateTargets(grade: Grade, cats: UsefulCategory[]): PotTarget[] {
  const out: PotTarget[] = [];
  for (const cat of cats) {
    for (let n = 1; n <= MAX_LINES; n++) out.push(makeTarget(grade, [{ cat, count: n }]));
  }
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      const a = cats[i] as UsefulCategory;
      const b = cats[j] as UsefulCategory;
      if (a.key === b.key) continue;
      for (let na = 1; na < MAX_LINES; na++) {
        for (let nb = 1; na + nb <= MAX_LINES; nb++) {
          out.push(
            makeTarget(grade, [
              { cat: a, count: na },
              { cat: b, count: nb },
            ]),
          );
        }
      }
    }
  }
  return out;
}

/** 目標の行を「しきい値の値で出た」合成オプションに(id = -1)。残りは null。長さ 3 */
export function targetLines(t: PotTarget): (PotOption | null)[] {
  const out: (PotOption | null)[] = [];
  for (const { cat, count } of t.parts) {
    for (let k = 0; k < count; k++) {
      const o: PotOption = {
        id: -1,
        key: cat.key,
        value: cat.threshold,
        ja: `${cat.labelJa} ${cat.threshold}`,
        kr: '',
        group: null,
      };
      const stat = cat.stats?.[0];
      if (stat) o.stat = stat;
      if (cat.per !== undefined) o.per = cat.per;
      out.push(o);
    }
  }
  while (out.length < MAX_LINES) out.push(null);
  return out.slice(0, MAX_LINES);
}

/** 現在の行が既に目標を満たすか。等級が目標より上なら「満たす」とみなす */
export function targetSatisfied(
  current: PotState,
  currentLines: (PotOption | null)[],
  t: PotTarget,
  gradeOrder: Grade[],
): boolean {
  if (current.grade === 'none') return false;
  const ci = gradeIndex(current.grade, gradeOrder);
  const ti = gradeIndex(t.grade, gradeOrder);
  if (ci < ti) return false;
  if (ci > ti) return true;
  const counts: Record<string, number> = {};
  for (const o of currentLines) {
    if (!o) continue;
    const hit = t.parts.find((p) => p.cat.match(o));
    if (hit) counts[hit.cat.id] = (counts[hit.cat.id] ?? 0) + 1;
  }
  return t.parts.every((p) => (counts[p.cat.id] ?? 0) >= p.count);
}

// ================================================================ Part 4: 候補の評価(§6.3.4)

export interface ResolvedTable {
  lines: LineDist[];
  options: PotOption[];
  fallbackCube: boolean;
  fallbackPart: boolean;
}

export interface PotEvalParams {
  current: PotState;
  /** current.lines を解決したもの */
  currentLines: (PotOption | null)[];
  part: Part;
  lv: number;
  target: 'potential' | 'additional';
  /** def.target === target のものだけ */
  cubes: { def: CubeDef; setting: CubeSetting }[];
  melPerNP: number;
  gradeOrder: Grade[];
  gradeUp: Omit<GradeUpOptions, 'miracleApplies'>;
  /** ミラクルタイムが効くキューブ id */
  miracleAppliesTo: string[];
  /** 確率表の解決(フォールバック込み)。null = 表なし */
  resolveTable: (cube: CubeTableKind, grade: Grade) => ResolvedTable | null;
  /** 目標行(targetLines)を現在の3行の代わりに置いたときの戦闘力上昇 */
  gainOf: (newLines: (PotOption | null)[], grade: Grade) => number;
  ctx: Omit<CategoryContext, 'part' | 'target'>;
  /** 検討する等級の下限(既定 'unique')。現在等級より下は検討しない */
  minGrade?: Grade;
}

export interface PotCandidate {
  target: PotTarget;
  cube: CubeDef;
  /** P(T | grade)(そのキューブの表) */
  prob: number;
  cubesToGrade: number;
  /** 1/prob */
  cubesForTarget: number;
  expectedCubes: number;
  costMel: number;
  gain: number;
  /** gain / costMel */
  efficiency: number;
  fallbackCube: boolean;
  fallbackPart: boolean;
  newLines: (PotOption | null)[];
}

/** 全目標 × 有効キューブを評価し、目標ごとに costMel 最小のキューブを採用した候補を返す。
 *  gain<=0、既に満たしている目標、prob<=0 は除く。efficiency 降順 */
export function evaluateCandidates(p: PotEvalParams): PotCandidate[] {
  const { gradeOrder } = p;
  const startIdx = Math.max(
    gradeIndex(p.current.grade, gradeOrder),
    gradeIndex(p.minGrade ?? 'unique', gradeOrder),
  );
  const grades = gradeOrder.slice(Math.max(0, startIdx));
  const best = new Map<string, PotCandidate>();
  for (const { def, setting } of p.cubes) {
    if (!setting.enabled) continue;
    const gradeUp: GradeUpOptions = {
      ...p.gradeUp,
      miracleApplies: p.miracleAppliesTo.includes(def.id),
    };
    for (const grade of grades) {
      const toGrade = cubesToGrade(def, p.current.grade, grade, gradeOrder, gradeUp);
      if (!Number.isFinite(toGrade)) continue;
      const t = p.resolveTable(def.kmsEquivalent, grade);
      if (!t) continue;
      const cats = usefulCategories(t.lines, t.options, {
        ...p.ctx,
        part: p.part,
        target: p.target,
      });
      for (const target of enumerateTargets(grade, cats)) {
        if (targetSatisfied(p.current, p.currentLines, target, gradeOrder)) continue;
        const need: Record<string, number> = {};
        for (const part of target.parts) need[part.cat.id] = part.count;
        const prob = probTarget(
          t.lines,
          t.options,
          target.parts.map((x) => x.cat),
          need,
        );
        if (!(prob > 0)) continue;
        const newLines = targetLines(target);
        const gain = p.gainOf(newLines, grade);
        if (!(gain > 0)) continue;
        const cubesForTarget = 1 / prob;
        const expectedCubes = toGrade + cubesForTarget;
        const costMel = expectedCubes * setting.priceNP * p.melPerNP;
        if (!(costMel > 0) || !Number.isFinite(costMel)) continue;
        const cand: PotCandidate = {
          target,
          cube: def,
          prob,
          cubesToGrade: toGrade,
          cubesForTarget,
          expectedCubes,
          costMel,
          gain,
          efficiency: gain / costMel,
          fallbackCube: t.fallbackCube,
          fallbackPart: t.fallbackPart,
          newLines,
        };
        const prev = best.get(target.key);
        if (!prev || cand.costMel < prev.costMel) best.set(target.key, cand);
      }
    }
  }
  return [...best.values()].sort((a, b) => b.efficiency - a.efficiency);
}
