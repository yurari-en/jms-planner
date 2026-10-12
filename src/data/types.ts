// 静的マスタ(public/data/*.json)の型。DESIGN.md §4.1.1 に準拠。
// 数値はすべて JSON から読む(コードに直書きしない)。

// ---------------------------------------------------------------- starforce.json
export type VipRank = 'none' | 'silver' | 'gold' | 'diamond' | 'royal';
export type DestroyMode = 'restorePrev' | 'restart12';
export type SfBandKey = '130' | '140' | '150' | '160' | '200' | '250';

export interface StarforceMaster {
  meta: { asOf: string; basis: string; sources: string[] };
  /** 昇順。最初に maxLv >= 装備Lv となる要素の star が上限 */
  maxStarByLevel: { maxLv: number; star: number }[];
  /** index = 現在★(0..29)。[成功, 維持, 破壊](スターキャッチなし) */
  probabilityBase: { note?: string; table: [success: number, keep: number, destroy: number][] };
  starCatch: { defaultOn: boolean; successMultiplier: number; redistribute?: string; note?: string };
  cost: {
    formula?: string;
    /** ★10以上の費用式の除数(キーは現在★の文字列) */
    divisor: Record<string, number>;
    jmsStar22PlusMultiplier: { default: number; alt: number; note?: string };
    referencePerAttempt?: Record<string, number[]>;
  };
  /** 破壊防止: 対象★と加算率(基本費用×surchargeRate を加算。割引対象外) */
  safeguard: { stars: number[]; surchargeRate: number; note?: string };
  discounts: {
    vip: { rates: Record<VipRank, number>; maxCurrentStar: number; note?: string };
    pcCafe?: { jms: boolean };
  };
  events: {
    discount30: { label?: string; costMultiplier: number };
    destroyDown30: { label?: string; maxCurrentStar: number; destroyMultiplier: number; note?: string };
    guarantee51015: { label?: string; stars: number[] };
    plusOneUnder10: { label?: string; maxCurrentStar: number };
    history?: { date: string; content: string }[];
  };
  destruction: {
    modes?: Record<DestroyMode, { label: string; note?: string }>;
    defaultMode: DestroyMode;
    traceCapFrom: number;
    traceCapStar: number;
    basicRestoreStar: number;
    /** 昇順。最初に maxStar >= 復旧★ となる要素の count 個の同名装備が必要 */
    restoreSpares: { maxStar: number; count: number }[];
    /** 復旧メル = ratio[t] × 基本1回費用(L, t) */
    restoreMesoRatio: Record<string, number>;
    restoreMesoRatioNote?: string;
  };
  stats: {
    /** 昇順。minLv 以上で最後に一致する要素の key が帯 */
    levelBands: { minLv: number; key: SfBandKey }[];
    /** 15要素。★k までの累積(STR/DEX/INT/LUK 各) */
    statCumulative1to15: number[];
    /** ★16.. の累積(帯別)。★23以上は増えない */
    statCumulative16: Record<string, number[]>;
    /** ★16..30 の累積攻撃力/魔力(防具・アクセ) */
    armorAttCumulative16: Record<string, number[]>;
    /** ★16.. の累積攻撃力(武器)。欠けている段階は未確定 → 計算対象外 */
    weaponAttCumulative16: Record<string, number[]>;
    weaponAtt1to15?: string;
    /** この★で手袋の攻撃力/魔力 +1 */
    gloveAttStars: number[];
    statNote?: string;
    unknown?: string;
  };
  superior?: { supported: boolean; note?: string };
  referenceExpected?: {
    conditions: string;
    rows: { L: number; from: number; to: number; meso: number; meso_jms12?: number; destroy: number }[];
  };
  unresolved?: string[];
}

// ---------------------------------------------------------------- potential/kms-cube-tables.json
export type OptionKey =
  | 'statPct'
  | 'statFlat'
  | 'allStatPct'
  | 'allStatFlat'
  | 'statPerLv'
  | 'attPct'
  | 'mattPct'
  | 'attFlat'
  | 'mattFlat'
  | 'attPerLv'
  | 'mattPerLv'
  | 'dmgPct'
  | 'bossPct'
  | 'iedPct'
  | 'critRate'
  | 'critDmg'
  | 'cdrSec'
  | 'hpPct'
  | 'hpFlat'
  | 'mpPct'
  | 'mpFlat'
  | 'mesoPct'
  | 'dropPct'
  | 'other';

export type StatKey = 'STR' | 'DEX' | 'INT' | 'LUK';
export type Grade = 'rare' | 'epic' | 'unique' | 'legendary';
export type CubeTableKind = 'red' | 'black' | 'additional';
/** KMS確率表の部位キー */
export type Part =
  | 'weapon'
  | 'emblem'
  | 'secondary'
  | 'forceShield'
  | 'shield'
  | 'hat'
  | 'top'
  | 'overall'
  | 'bottom'
  | 'shoes'
  | 'gloves'
  | 'cape'
  | 'belt'
  | 'shoulder'
  | 'face'
  | 'eye'
  | 'earrings'
  | 'ring'
  | 'pendant';

export interface PotOption {
  id: number;
  key: OptionKey;
  stat?: StatKey;
  value: number;
  /** statPerLv / attPerLv / mattPerLv: 「キャラクターレベル per ごとに +value」 */
  per?: number;
  ja: string;
  kr: string;
  /** 制限グループ: maxOne = 3行中1行まで、maxTwo = 2行まで */
  group: 'maxOne' | 'maxTwo' | null;
}

/** 1行分の分布: [optionId, percent][](% 表記、合計 100) */
export type LineDist = [optionId: number, percent: number][];

export interface CubeTableBand {
  minLv: number;
  /** lineDists のインデックス×3。null = その部位・Lv帯に表がない */
  lines: [number, number, number] | null;
}

export type CubeTableKey = `${CubeTableKind}/${Grade}/${Part}`;

export interface CubeTables {
  meta: { asOf: string; seed?: boolean; quick?: boolean; note: string; source?: string };
  options: PotOption[];
  lineDists: LineDist[];
  tables: Record<string, CubeTableBand[]>; // キーは CubeTableKey
}

// ---------------------------------------------------------------- cubes.json
export type CubeId = 'neo' | 'mega' | 'neoAdditional' | 'megaAdditional';
export type TierUpGrade = 'rare' | 'epic' | 'unique';

export interface CubeDef {
  id: CubeId;
  nameJa: string;
  target: 'potential' | 'additional';
  itemIdIcon: number;
  kmsEquivalent: CubeTableKind;
  confidence: string;
  maxGrade: Grade;
  tierUp: Record<TierUpGrade, number>;
  guarantee: Record<TierUpGrade, number>;
  guaranteeNote?: string;
  canKeepOld: boolean;
  defaultPriceNP: number;
  priceNote?: string;
  defaultEnabled?: boolean;
}

export interface CubesMaster {
  meta: { asOf: string; note: string; sources: string[] };
  currency: { note?: string; pointsPer100MMelDefault: number };
  cubes: CubeDef[];
  events: {
    miracleTime: { label: string; tierUpMultiplier: number; appliesTo: CubeId[] };
  };
  gradeOrder: Grade[];
}

// ---------------------------------------------------------------- flame.json
export type FlameOptionId =
  | 'STR'
  | 'DEX'
  | 'INT'
  | 'LUK'
  | 'STR_DEX'
  | 'STR_INT'
  | 'STR_LUK'
  | 'DEX_INT'
  | 'DEX_LUK'
  | 'INT_LUK'
  | 'HP'
  | 'MP'
  | 'REQ_LV'
  | 'DEF'
  | 'ATT'
  | 'MATT'
  | 'SPEED'
  | 'JUMP'
  | 'BOSS_DMG'
  | 'DMG'
  | 'ALL_STAT_P';

/** 段階確率表のキー(flame.json tierProbBase_1to5) */
export type FlameTierTable = 'drop' | 'powerful' | 'eternal' | 'abyss' | string;
/** 設定で選べる基準炎 */
export type FlameBase = 'powerful' | 'eternal' | 'black';

export interface FlameDef {
  jms: string | null;
  kms: string;
  gms?: string | null;
  tierTable?: FlameTierTable;
  canKeepOld?: boolean;
  jmsAvailable?: boolean | string;
  jmsSince?: string;
  costMesoKMS?: number;
  costMesoJMS?: number | null;
  note?: string;
}

export interface FlameMaster {
  meta: { topic: string; checked: string; basis: string; sources: Record<string, string> };
  flames: Record<string, FlameDef>;
  /** 5要素(1〜5段階)。合計 1 */
  tierProbBase_1to5: Record<string, number[]>;
  bossTierBonus: number;
  /** 行数 → 確率 */
  lineCountProb: Record<string, Record<string, number>>;
  optionSelection: {
    uniform: boolean;
    withoutReplacement: boolean;
    tierIndependentPerLine: boolean;
    rerollIfIdenticalToCurrent: boolean;
  };
  optionPools: { weapon: FlameOptionId[]; armor: FlameOptionId[] };
  levelRestrictions: {
    weapon: Partial<Record<FlameOptionId, number>>;
    armor: Partial<Record<FlameOptionId, number>>;
  };
  optionNames: Record<string, { kms: string; jms: string } | string>;
  formulas: Record<string, string>;
  weaponFormulaChecks: { item: string; L: number; B: number; tiers3to7: number[]; source: string; note?: string }[];
  bossItems: { examples: string[]; nonBossExceptions: string[] };
  eligibility: { noFlame: string[]; exceptionsCanFlame: string[]; canFlame: string[] };
  scoreWeightsDefault: { main: number; sub: number; att: number; allStatP: number; notes?: string };
  referenceResults_bossArmor_main1_att4_as10?: Record<string, number | string>[];
  jmsAutoResetTargetMax?: Record<string, { normal: number; boss: number } | null | string>;
  unconfirmed: string[];
}

// ---------------------------------------------------------------- jobs.json
export type JobStatFormula = 'standard' | 'xenon' | 'demonAvenger';
export type AttackType = 'att' | 'matt';
export type JobStatKey = StatKey | 'HP';

export interface JobDef {
  id: string;
  nameJa: string;
  kmsName: string;
  branch: string;
  category: string;
  mainStat: JobStatKey[];
  subStat: JobStatKey[];
  attackType: AttackType;
  statFormula: JobStatFormula;
  weaponMultiplier: number | null;
  avgCdrSecKMS: number | null;
  /** 帽子クール減2秒 = レジェ主ステ%行の何行分か(職業既定) */
  cdrLinesPer2Sec: number;
  cdrNote?: string;
  notes?: string;
}

export interface JobsMaster {
  _meta: {
    description: string;
    asOf: string;
    jobCount: number;
    sources: string[];
    notes: string[];
    avgCdrSource?: string;
    cdrLinesPer2SecFormula?: string;
    [k: string]: unknown;
  };
  jobs: JobDef[];
}

// ---------------------------------------------------------------- items.json
export type EquipSlotKind =
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
  | 'ring'
  | 'pendant'
  | 'emblem'
  | 'pocket'
  | 'shield'
  | 'secondary'
  | 'weapon';

export interface ItemMaster {
  id: number;
  name: string;
  lv: number;
  slot: EquipSlotKind;
  /** maplestory.io の subCategory(武器種など) */
  sub: string;
  jobs: string[];
  boss: 0 | 1;
  superior: 0 | 1;
  setId: number | null;
  setName: string | null;
  tuc: number;
  onlyUpgrade: 0 | 1;
  /** 装備固有の成長システムを持つ装備(アウェイクリング等。★不可) */
  exGrade: 0 | 1;
  exceptUpgrade: 0 | 1;
  noPotential: 0 | 1;
  /** 強化可能回数 0 でも潜在可の例外(エターナルフレイムリング等、items.json 生成時の一覧) */
  potentialOk?: 1;
  base: { str: number; dex: number; int: number; luk: number; att: number; matt: number; hp: number };
}

export interface ItemsMaster {
  meta: { source: string; asOf: string; minLevel: number };
  items: ItemMaster[];
}

// ---------------------------------------------------------------- manifest.json
export interface DataManifest {
  version: string;
  generatedAt: string;
  files: Record<string, { sha: string; bytes: number; asOf: string | null }>;
}

// ---------------------------------------------------------------- まとめ
export interface MasterData {
  starforce: StarforceMaster;
  cubes: CubesMaster;
  cubeTables: CubeTables;
  flame: FlameMaster;
  jobs: JobsMaster;
  items: ItemsMaster;
  manifest: DataManifest;
}
