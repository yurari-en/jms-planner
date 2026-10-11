// 装備入力(EquipInput)をマスタと突き合わせて、計算に必要な属性にまとめる。純粋関数。

import type { EquipSlotKind, ItemMaster, Part, StarforceMaster } from '../data/types';
import { partOf, slotKind, slotRules, type EquipInput, type EquipSlot } from './character';

export interface EquipMeta {
  slot: EquipSlot;
  kind: EquipSlotKind;
  /** KMS確率表の部位キー(null = 潜在なし) */
  part: Part | null;
  name: string;
  /** 元の装備Lv(炎の着用Lv減少前) */
  lv: number;
  /** ボス報酬(炎4行・+2段階) */
  boss: boolean;
  superior: boolean;
  baseAtt: number;
  baseMatt: number;
  scrollAtt: number;
  scrollMatt: number;
  /** 装備が設定されているか(アイテム or 手入力) */
  present: boolean;
  canStar: boolean;
  canPotential: boolean;
  canFlame: boolean;
  /** Lv別の最大★(overrides.maxStar で上書き済み) */
  maxStar: number;
  item: ItemMaster | null;
}

export interface EquipResolveDeps {
  itemsById: Map<number, ItemMaster>;
  starforce: StarforceMaster;
  /** flame.json bossItems.nonBossExceptions に該当 */
  isNonBossException: (name: string) => boolean;
  /** flame.json eligibility.exceptionsCanFlame に該当(スカーレットショルダー等) */
  isFlameException: (name: string) => boolean;
}

export function maxStarByLevel(m: StarforceMaster, lv: number): number {
  for (const e of m.maxStarByLevel) {
    if (lv <= e.maxLv) return e.star;
  }
  const last = m.maxStarByLevel[m.maxStarByLevel.length - 1];
  return last ? last.star : 0;
}

export function resolveEquip(eq: EquipInput, deps: EquipResolveDeps): EquipMeta {
  const kind = slotKind(eq.slot);
  const rules = slotRules(kind);
  const item = eq.itemId != null ? (deps.itemsById.get(eq.itemId) ?? null) : null;
  const custom = eq.custom;
  const present = item != null || custom != null;
  const name = item?.name ?? custom?.name ?? '';
  const lv = item?.lv ?? custom?.lv ?? 0;
  const bossFromMaster = item ? item.boss === 1 && !deps.isNonBossException(item.name) : false;
  const boss = eq.overrides?.boss ?? (item ? bossFromMaster : (custom?.boss ?? false));
  const superior = item ? item.superior === 1 : false;
  const baseAtt = item?.base.att ?? custom?.baseAtt ?? 0;
  const baseMatt = item?.base.matt ?? custom?.baseMatt ?? 0;
  const canFlame =
    (rules.flame || (name !== '' && deps.isFlameException(name))) && !eq.overrides?.flameDisabled;
  const canStar = rules.star && !superior && !eq.overrides?.sfDisabled;
  const canPotential = rules.potential && !(item?.noPotential === 1) && !eq.overrides?.potDisabled;
  const maxStar = eq.overrides?.maxStar ?? maxStarByLevel(deps.starforce, lv);
  return {
    slot: eq.slot,
    kind,
    part: partOf(kind),
    name,
    lv,
    boss,
    superior,
    baseAtt,
    baseMatt,
    scrollAtt: eq.scrollAtt ?? 0,
    scrollMatt: eq.scrollMatt ?? 0,
    present,
    canStar,
    canPotential,
    canFlame,
    maxStar,
    item,
  };
}
