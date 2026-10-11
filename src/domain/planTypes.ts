// プランナー(planner.ts)と Worker、画面が共有する出力型。DESIGN.md §6.5 / §7.3 に準拠。
// このファイルは型のみ(実行時コードなし)。

import type { CubeId, Grade } from '../data/types';
import type { EquipSlot, PotGrade } from './character';

export type StepKind = 'starforce' | 'potential' | 'additional';
/** 効率の四分位: 1 = 上位25%(緑) / 2 = 25-50%(紫) / 3 = 50-75%(黄) / 4 = 下位25%(赤) */
export type Quartile = 1 | 2 | 3 | 4;

export interface PlanStepBase {
  /** 一意なID(`${slot}:${kind}:${index}` など) */
  id: string;
  kind: StepKind;
  slot: EquipSlot;
  equipName: string;
  itemId: number | null;
  lv: number;
  /** 戦闘力上昇(このステップ適用前の状態に対して) */
  gain: number;
  /** 上昇率(%)= gain / cpBefore × 100 */
  gainPct: number;
  /** 期待コスト(メル) */
  cost: number;
  /** gain / cost */
  efficiency: number;
  /** 1始まりの順位(= 配列内の位置+1) */
  rank: number;
  quartile: Quartile;
  cpBefore: number;
  cpAfter: number;
  /** 前提・注記(推定・代用表・クール減換算 など)。画面にそのまま出す日本語 */
  assumptions: string[];
}

export interface SfStep extends PlanStepBase {
  kind: 'starforce';
  from: number;
  to: number;
  /** 期待破壊回数 */
  destroys: number;
}

export interface PotStep extends PlanStepBase {
  kind: 'potential' | 'additional';
  fromGrade: PotGrade;
  toGrade: Grade;
  /** PotTarget.key */
  targetKey: string;
  /** 例: 'レジェ / 攻撃力%×2 + ボス%×1' */
  targetLabel: string;
  /** 目標の行数(×N 表示) */
  lineCount: number;
  cubeId: CubeId;
  cubeName: string;
  /** 平均キューブ個数(等級上昇分 + 目標分) */
  expectedCubes: number;
  cubesToGrade: number;
  /** 目標等級で1回に揃う確率 */
  prob: number;
  /** 目標行の表示(しきい値の値)。例: ['攻撃力 : +9%', '攻撃力 : +9%', 'ボスモンスター攻撃時のダメージ : +30%'] */
  newLineLabels: string[];
  fallbackCube: boolean;
  fallbackPart: boolean;
  /** 帽子クール減の換算を使った */
  cdrConverted: boolean;
}

export type PlanStep = SfStep | PotStep;

/** 同じ装備の連続した★ステップをまとめた表示単位(潜在/アディは1ステップ=1グループ) */
export interface PlanGroup {
  id: string;
  kind: StepKind;
  slot: EquipSlot;
  equipName: string;
  itemId: number | null;
  steps: PlanStep[];
  /** ★: from→to。潜在: undefined */
  from?: number;
  to?: number;
  /** マスの下に出す短い表示: '22' / '20→22' / '×3' */
  cellLabel: string;
  totalGain: number;
  totalCost: number;
  efficiency: number;
  /** 先頭ステップの順位 */
  rank: number;
  quartile: Quartile;
}

/** 「この装備の全候補を見る」用の1行(初期状態に対する評価) */
export interface CandidateRow {
  kind: StepKind;
  label: string;
  /** ★: 期待破壊回数 / 潜在: 1回で揃う確率 */
  prob?: number;
  destroys?: number;
  expectedCubes?: number;
  cubeName?: string;
  cost: number;
  gain: number;
  efficiency: number;
}

export interface PlanWarning {
  slot?: EquipSlot;
  message: string;
}

export interface PlanResult {
  steps: PlanStep[];
  groups: PlanGroup[];
  /** 効率の四分位境界 [q1, q2, q3](steps の efficiency から) */
  quartileBounds: [number, number, number];
  candidatesBySlot: Partial<Record<EquipSlot, CandidateRow[]>>;
  warnings: PlanWarning[];
  /** 全ステップ適用後の推定戦闘力 */
  finalCP: number;
  /** stepLimit に達して打ち切った */
  truncated: boolean;
  computeMs: number;
}

export interface FlameRankRow {
  slot: EquipSlot;
  equipName: string;
  itemId: number | null;
  lv: number;
  boss: boolean;
  /** 炎1個で改善する確率 */
  pImprove: number;
  /** 改善時の平均上昇(戦闘力) */
  gainIfImprove: number;
  /** 炎1個あたりの期待戦闘力上昇 = E[max(0, X−cur)](並び順の基準) */
  expectedGain: number;
  /** 1回の炎の平均スコア(戦闘力) */
  mean: number;
  /** 現在の炎スコア(戦闘力換算) */
  curScore: number;
  /** 現在の炎スコア(主ステ換算: 主ステ固定+1 の gain で割った値) */
  curScoreMainStat: number;
  /** 期待個数 = 1/pImprove(pImprove=0 なら Infinity) */
  expectedFlames: number;
  assumptions: string[];
}

export interface FlameRankResult {
  rows: FlameRankRow[];
  warnings: PlanWarning[];
  computeMs: number;
}
