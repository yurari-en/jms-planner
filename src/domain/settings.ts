// 強化オプション(設定)。DESIGN.md §5.3 に準拠。キャラ共通。
// 既定値のうちデータ由来のもの(キューブ価格・メル換算)は cubes.json から作る。

import type { CubeId, CubesMaster, DestroyMode, FlameBase, VipRank } from '../data/types';

export type CdrLinesSetting = 'auto' | 0 | 0.5 | 1 | 1.5 | 2 | 2.5;

export interface CubeSetting {
  enabled: boolean;
  priceNP: number;
}

export interface PlannerSettings {
  version: 1;
  include: { starforce: boolean; potential: boolean; additional: boolean };
  /** 成功×1.05(JMS ver4.43 以降は常時適用) */
  starCatch: boolean;
  events: {
    discount30: boolean;
    destroyDown30: boolean;
    guarantee51015: boolean;
    plusOneUnder10: boolean;
  };
  vipRank: VipRank;
  /** ★22以上の費用倍率(JMS攻略の推定は 1.2) */
  star22PlusMultiplier: number;
  destroyMode: DestroyMode;
  /** 復旧に使う同名装備1個の価格(メル)。装備ごとに上書き可 */
  defaultSparePriceMel: number;
  /** 破壊防止する段階(15/16/17) */
  safeguardStars: number[];
  /** 順序計算で考える★の上限 */
  sfMaxTarget: number;
  cubes: Record<CubeId, CubeSetting>;
  /** メルマーケットの相場: 1億メルあたりのメイプルポイント数(1ポイント = 1NP とみなす)。1NPあたりのメル = 1億 ÷ この値 */
  pointsPer100MMel: number;
  /** 等級上昇率2倍 */
  miracleTime: boolean;
  /** 等級上昇保証(天井)を期待値に入れる(JMS で有無未確認のため既定 OFF) */
  useGuarantee: boolean;
  /** 帽子クール減2秒 = レジェ主ステ何行分。'auto' = 職業既定 */
  cdrLinesPer2Sec: CdrLinesSetting;
  /** 「レベルごとに主ステ」行を潜在の目標候補に含める */
  includePerLvLines: boolean;
  /** 上限★の装備を一覧から隠す */
  hideMaxed: boolean;
  /** 追加オプションの順番の基準炎 */
  flameBase: FlameBase;
  /** スペックアップの順番に出すステップ数の上限 */
  stepLimit: number;
}

/** メルマーケットの取引単位(1億メル) */
export const MEL_PER_MARKET_UNIT = 100_000_000;

/** 1NPあたりのメル(= 1億 ÷ メルマーケットの 1億メルあたりのポイント数) */
export function melPerNP(s: Pick<PlannerSettings, 'pointsPer100MMel'>): number {
  const p = s.pointsPer100MMel;
  // 不正値のときキューブを無料にしないための保険。スキーマと入力欄で正の数に限っているので通常は到達しない
  if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0) return Number.POSITIVE_INFINITY;
  return MEL_PER_MARKET_UNIT / p;
}

export function defaultSettings(cubes: CubesMaster): PlannerSettings {
  const cubeSettings = {} as Record<CubeId, CubeSetting>;
  for (const c of cubes.cubes) {
    cubeSettings[c.id] = { enabled: c.defaultEnabled ?? true, priceNP: c.defaultPriceNP };
  }
  return {
    version: 1,
    include: { starforce: true, potential: true, additional: true },
    starCatch: true,
    events: {
      discount30: false,
      destroyDown30: false,
      guarantee51015: false,
      plusOneUnder10: false,
    },
    vipRank: 'none',
    star22PlusMultiplier: 1.0,
    destroyMode: 'restorePrev',
    defaultSparePriceMel: 0,
    safeguardStars: [],
    sfMaxTarget: 22,
    cubes: cubeSettings,
    pointsPer100MMel: cubes.currency.pointsPer100MMelDefault,
    miracleTime: false,
    useGuarantee: false,
    cdrLinesPer2Sec: 'auto',
    includePerLvLines: false,
    hideMaxed: true,
    flameBase: 'eternal',
    stepLimit: 120,
  };
}
