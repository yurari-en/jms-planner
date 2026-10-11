// ユーザー入力のドメインモデル。DESIGN.md §5 に準拠。
// このファイルは React / DOM / ストレージに依存しない。

import type { EquipSlotKind, Grade, Part, StatKey } from '../data/types';

export type { Grade, StatKey };

/** 画面上の装備枠。マスタの部位(EquipSlotKind)とは ring1..4 / pendant1..2 が異なる */
export type EquipSlot =
  | 'hat'
  | 'top'
  | 'bottom'
  | 'overall'
  | 'shoes'
  | 'gloves'
  | 'cape'
  | 'belt'
  | 'shoulder'
  | 'face'
  | 'eye'
  | 'earrings'
  | 'ring1'
  | 'ring2'
  | 'ring3'
  | 'ring4'
  | 'pendant1'
  | 'pendant2'
  | 'weapon'
  | 'secondary'
  | 'emblem'
  | 'pocket';

export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'weapon',
  'secondary',
  'emblem',
  'hat',
  'top',
  'bottom',
  'overall',
  'shoes',
  'gloves',
  'cape',
  'belt',
  'shoulder',
  'face',
  'eye',
  'earrings',
  'pendant1',
  'pendant2',
  'ring1',
  'ring2',
  'ring3',
  'ring4',
  'pocket',
] as const;

export const SLOT_LABEL_JA: Record<EquipSlot, string> = {
  weapon: '武器',
  secondary: '補助武器',
  emblem: 'エンブレム',
  hat: '帽子',
  top: '上着',
  bottom: '下着',
  overall: '全身',
  shoes: '靴',
  gloves: '手袋',
  cape: 'マント',
  belt: 'ベルト',
  shoulder: '肩飾り',
  face: '顔飾り',
  eye: '目飾り',
  earrings: 'イヤリング',
  pendant1: 'ペンダント1',
  pendant2: 'ペンダント2',
  ring1: '指輪1',
  ring2: '指輪2',
  ring3: '指輪3',
  ring4: '指輪4',
  pocket: 'ポケット',
};

/** 画面の枠 → マスタの部位 */
export function slotKind(slot: EquipSlot): EquipSlotKind {
  if (slot.startsWith('ring')) return 'ring';
  if (slot.startsWith('pendant')) return 'pendant';
  return slot as EquipSlotKind;
}

/** マスタの部位 → KMS確率表の部位キー(null = 潜在なし) */
export function partOf(kind: EquipSlotKind): Part | null {
  switch (kind) {
    case 'pocket':
      return null;
    case 'shield':
      return 'shield';
    default:
      return kind;
  }
}

/** 部位ごとの可否(DESIGN.md §5.2 の表)。炎の例外(スカーレットショルダー等)は flame.json eligibility で別途判定 */
export interface SlotRules {
  star: boolean;
  potential: boolean;
  flame: boolean;
}

export function slotRules(kind: EquipSlotKind): SlotRules {
  switch (kind) {
    case 'weapon':
    case 'hat':
    case 'top':
    case 'bottom':
    case 'overall':
    case 'shoes':
    case 'gloves':
    case 'cape':
    case 'belt':
    case 'face':
    case 'eye':
    case 'earrings':
    case 'pendant':
      return { star: true, potential: true, flame: true };
    case 'ring':
    case 'shoulder':
      return { star: true, potential: true, flame: false };
    case 'secondary':
    case 'emblem':
      return { star: false, potential: true, flame: false };
    case 'shield':
      return { star: true, potential: true, flame: false };
    case 'pocket':
      return { star: false, potential: false, flame: true };
  }
}

// ---------------------------------------------------------------- 潜在 / アディ / 炎

export type PotGrade = Grade | 'none';

export interface PotState {
  grade: PotGrade;
  /** PotOption.id(kms-cube-tables.json の options のインデックス)。null = なし/その他 */
  lines: [number | null, number | null, number | null];
  /**
   * 各行の韓国語原文(PotOption.kr)。確率表を再取得して id が振り直されても
   * 行を復元できるようにするための補助情報。省略可。
   */
  lineKr?: [string | null, string | null, string | null];
}

export interface FlameState {
  str: number;
  dex: number;
  int: number;
  luk: number;
  att: number;
  matt: number;
  allStatPct: number;
  bossPct: number;
  dmgPct: number;
  hp: number;
}

export const EMPTY_POT: PotState = { grade: 'none', lines: [null, null, null] };
export const EMPTY_FLAME: FlameState = {
  str: 0,
  dex: 0,
  int: 0,
  luk: 0,
  att: 0,
  matt: 0,
  allStatPct: 0,
  bossPct: 0,
  dmgPct: 0,
  hp: 0,
};

// ---------------------------------------------------------------- 装備

export interface EquipOverrides {
  /** ★強化しない(順序計算から除外) */
  sfDisabled?: boolean;
  /** 最大★の上書き */
  maxStar?: number;
  flameDisabled?: boolean;
  potDisabled?: boolean;
  /** ボス報酬扱いの上書き(炎4行・+2段階) */
  boss?: boolean;
  /** 復旧に使う同名装備1個の価格(メル)。未設定なら設定の既定値 */
  sparePriceMel?: number;
}

export interface EquipInput {
  slot: EquipSlot;
  /** items.json の id。未登録装備は null + custom */
  itemId: number | null;
  custom?: { name: string; lv: number; boss: boolean; baseAtt?: number; baseMatt?: number };
  /** 現在★ */
  star: number;
  /** 武器のみ: 書・強化による攻撃力(★1-15 の上昇計算に使う) */
  scrollAtt?: number;
  scrollMatt?: number;
  potential: PotState;
  additional: PotState;
  flame: FlameState;
  overrides?: EquipOverrides;
  /** ユーザーが決めた★の目標(順序計算の上限) */
  targetStar?: number;
}

export function emptyEquip(slot: EquipSlot): EquipInput {
  return {
    slot,
    itemId: null,
    star: 0,
    potential: { ...EMPTY_POT, lines: [null, null, null] },
    additional: { ...EMPTY_POT, lines: [null, null, null] },
    flame: { ...EMPTY_FLAME },
  };
}

// ---------------------------------------------------------------- キャラクター

export interface StatInput {
  /** ステータス画面の最終値 */
  final: number;
  /** % の合計(潜在・アディ・全ステ%・その他) */
  pct: number;
  /** % が適用されない値(シンボル、ハイパーステ、ユニオン、HEXA 等) */
  nonPct: number;
}

export interface CharacterInput {
  version: 1;
  id: string;
  name: string;
  /** jobs.json の id */
  jobId: string;
  level: number;
  /** ステータス画面の戦闘力(差分推定の基準) */
  displayedCP: number;
  stats: Record<StatKey, StatInput>;
  /** デーモンアヴェンジャーのみ */
  hp?: { pure: number; added: number };
  /** 魔法職は魔力。final = ステータス画面の値、pct = 攻撃力%の合計 */
  attack: { final: number; pct: number };
  dmgPct: number;
  bossPct: number;
  critDmgPct: number;
  /**
   * 入力補助: pct = 装備由来(自動集計) + その他(手入力)。
   * ここには「その他」の手入力分を保持し、stats[X].pct は合計値を保持する。省略可。
   */
  pctOther?: Partial<Record<StatKey, number>>;
  equips: EquipInput[];
  updatedAt: string;
}

export const EMPTY_STAT: StatInput = { final: 0, pct: 0, nonPct: 0 };

export function emptyCharacter(id: string, name = '新しいキャラ'): CharacterInput {
  return {
    version: 1,
    id,
    name,
    jobId: 'hero',
    level: 200,
    displayedCP: 0,
    stats: {
      STR: { ...EMPTY_STAT },
      DEX: { ...EMPTY_STAT },
      INT: { ...EMPTY_STAT },
      LUK: { ...EMPTY_STAT },
    },
    attack: { final: 0, pct: 0 },
    dmgPct: 0,
    bossPct: 0,
    critDmgPct: 0,
    equips: EQUIP_SLOTS.map((s) => emptyEquip(s)),
    updatedAt: new Date(0).toISOString(),
  };
}
