// ユーザーデータ(localStorage / JSON 書き出し)の zod スキーマと移行。DESIGN.md §4.2 / §5。
import { z } from 'zod';
import type { CubeId } from '../data/types';
import {
  EMPTY_FLAME,
  EQUIP_SLOTS,
  emptyCharacter,
  emptyEquip,
  type CharacterInput,
  type EquipInput,
  type EquipSlot,
  type FlameState,
  type PotState,
} from '../domain/character';
import type { PlannerSettings } from '../domain/settings';

// ---------------------------------------------------------------- 基本

/** 有限で 0 以上 */
const nonNeg = z.number().finite().nonnegative();
const nonNegInt = z.number().int().nonnegative();

const slotEnum = z.enum(EQUIP_SLOTS as unknown as [EquipSlot, ...EquipSlot[]]);
const potGradeEnum = z.enum(['none', 'rare', 'epic', 'unique', 'legendary']);
const lineId = nonNegInt.nullable();
const lineKr = z.string().nullable();

export const potStateSchema: z.ZodType<PotState> = z.object({
  grade: potGradeEnum,
  lines: z.tuple([lineId, lineId, lineId]),
  lineKr: z.tuple([lineKr, lineKr, lineKr]).optional(),
});

export const flameStateSchema: z.ZodType<FlameState> = z.object({
  str: nonNeg,
  dex: nonNeg,
  int: nonNeg,
  luk: nonNeg,
  att: nonNeg,
  matt: nonNeg,
  allStatPct: nonNeg,
  bossPct: nonNeg,
  dmgPct: nonNeg,
  hp: nonNeg,
});

export const equipInputSchema: z.ZodType<EquipInput> = z.object({
  slot: slotEnum,
  itemId: nonNegInt.nullable(),
  custom: z
    .object({
      name: z.string(),
      lv: nonNeg,
      boss: z.boolean(),
      baseAtt: nonNeg.optional(),
      baseMatt: nonNeg.optional(),
    })
    .optional(),
  star: nonNegInt,
  scrollAtt: nonNeg.optional(),
  scrollMatt: nonNeg.optional(),
  potential: potStateSchema,
  additional: potStateSchema,
  flame: flameStateSchema,
  overrides: z
    .object({
      sfDisabled: z.boolean().optional(),
      maxStar: nonNegInt.optional(),
      flameDisabled: z.boolean().optional(),
      potDisabled: z.boolean().optional(),
      boss: z.boolean().optional(),
      sparePriceMel: nonNeg.optional(),
    })
    .optional(),
  targetStar: nonNegInt.optional(),
});

const statInputSchema = z.object({ final: nonNeg, pct: nonNeg, nonPct: nonNeg });

export const characterInputSchema: z.ZodType<CharacterInput> = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  name: z.string(),
  jobId: z.string(),
  level: z.number().int().min(1).max(300),
  displayedCP: nonNeg,
  stats: z.object({
    STR: statInputSchema,
    DEX: statInputSchema,
    INT: statInputSchema,
    LUK: statInputSchema,
  }),
  hp: z.object({ pure: nonNeg, added: nonNeg }).optional(),
  attack: z.object({ final: nonNeg, pct: nonNeg }),
  dmgPct: nonNeg,
  bossPct: nonNeg,
  critDmgPct: nonNeg,
  pctOther: z
    .object({
      STR: nonNeg.optional(),
      DEX: nonNeg.optional(),
      INT: nonNeg.optional(),
      LUK: nonNeg.optional(),
    })
    .optional(),
  equips: z.array(equipInputSchema),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------- 設定

const cubeSettingSchema = z.object({ enabled: z.boolean(), priceNP: nonNeg });

/** 設定で扱うキューブ id(cubes.json の id と同じ) */
export const CUBE_IDS = [
  'neo',
  'mega',
  'neoAdditional',
  'megaAdditional',
] as const satisfies readonly CubeId[];

const plannerSettingsObject = z.object({
  version: z.literal(1),
  include: z.object({ starforce: z.boolean(), potential: z.boolean(), additional: z.boolean() }),
  starCatch: z.boolean(),
  events: z.object({
    discount30: z.boolean(),
    destroyDown30: z.boolean(),
    guarantee51015: z.boolean(),
    plusOneUnder10: z.boolean(),
  }),
  vipRank: z.enum(['none', 'silver', 'gold', 'diamond', 'royal']),
  star22PlusMultiplier: z.number().finite().positive(),
  destroyMode: z.enum(['restorePrev', 'restart12']),
  defaultSparePriceMel: nonNeg,
  safeguardStars: z.array(nonNegInt),
  sfMaxTarget: nonNegInt,
  cubes: z.object({
    neo: cubeSettingSchema,
    mega: cubeSettingSchema,
    neoAdditional: cubeSettingSchema,
    megaAdditional: cubeSettingSchema,
  }),
  melPerNP: nonNeg,
  miracleTime: z.boolean(),
  useGuarantee: z.boolean(),
  cdrLinesPer2Sec: z.union([
    z.literal('auto'),
    z.literal(0),
    z.literal(0.5),
    z.literal(1),
    z.literal(1.5),
    z.literal(2),
    z.literal(2.5),
  ]),
  includePerLvLines: z.boolean(),
  hideMaxed: z.boolean(),
  flameBase: z.enum(['powerful', 'eternal', 'black']),
  stepLimit: z.number().int().positive(),
});

export const plannerSettingsSchema: z.ZodType<PlannerSettings> = plannerSettingsObject;

// ---------------------------------------------------------------- 保存データ

export const charactersStateSchema = z.object({
  version: z.literal(1),
  activeId: z.string().nullable(),
  characters: z.record(z.string(), characterInputSchema),
});
export type CharactersStateFile = z.infer<typeof charactersStateSchema>;

export const TABS = ['plan', 'input', 'settings'] as const;
export type TabId = (typeof TABS)[number];
export type Theme = 'dark' | 'light';

export const uiStateSchema = z.object({
  version: z.literal(1),
  theme: z.enum(['dark', 'light']),
  tab: z.enum(TABS),
  collapsed: z.record(z.string(), z.boolean()),
  selectedSlot: z.string().nullable().optional(),
  firstRunDismissed: z.boolean(),
});
export type UiStateFile = z.infer<typeof uiStateSchema>;

export const exportFileSchema = z.object({
  app: z.literal('jms-planner'),
  version: z.literal(1),
  exportedAt: z.string(),
  characters: z.array(characterInputSchema),
});
export type ExportFile = z.infer<typeof exportFileSchema>;

// ---------------------------------------------------------------- 移行

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** uuid(crypto.randomUUID が無い環境では時刻+乱数) */
export function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // 下のフォールバックへ
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function mergePot(raw: unknown): unknown {
  if (!isRecord(raw)) return { grade: 'none', lines: [null, null, null] };
  return { grade: 'none', lines: [null, null, null], ...raw };
}

function mergeEquip(slot: EquipSlot, raw: Record<string, unknown>): unknown {
  return {
    ...emptyEquip(slot),
    ...raw,
    slot,
    potential: mergePot(raw.potential),
    additional: mergePot(raw.additional),
    flame: { ...EMPTY_FLAME, ...(isRecord(raw.flame) ? raw.flame : {}) },
  };
}

/**
 * v1 のキャラ(一部欠けていてもよい)を受け取り、既定値で補って検証する。
 * - 装備は EQUIP_SLOTS の各部位がちょうど1件(未知の部位・重複は捨て、欠けた部位は空で追加)
 * - id が無ければ新しく振る
 * - 補っても検証に通らなければ null
 */
export function migrateCharacter(raw: unknown): CharacterInput | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== undefined && raw.version !== 1) return null;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : generateId();
  const base = emptyCharacter(id);

  const rawEquips = Array.isArray(raw.equips) ? raw.equips : [];
  const bySlot = new Map<EquipSlot, Record<string, unknown>>();
  for (const e of rawEquips) {
    if (!isRecord(e) || typeof e.slot !== 'string') continue;
    const slot = e.slot as EquipSlot;
    if (!EQUIP_SLOTS.includes(slot) || bySlot.has(slot)) continue;
    bySlot.set(slot, e);
  }
  const equips = EQUIP_SLOTS.map((slot) => {
    const e = bySlot.get(slot);
    return e ? mergeEquip(slot, e) : emptyEquip(slot);
  });

  const rawStats = isRecord(raw.stats) ? raw.stats : {};
  const stats = Object.fromEntries(
    (['STR', 'DEX', 'INT', 'LUK'] as const).map((k) => {
      const s = rawStats[k];
      return [k, { ...base.stats[k], ...(isRecord(s) ? s : {}) }];
    }),
  );

  const merged = {
    ...base,
    ...raw,
    version: 1,
    id,
    stats,
    attack: { ...base.attack, ...(isRecord(raw.attack) ? raw.attack : {}) },
    equips,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
  const r = characterInputSchema.safeParse(merged);
  return r.success ? r.data : null;
}

type Path = (string | number)[];

function getAt(obj: unknown, path: Path): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[p];
  }
  return cur;
}

function setAt(obj: Record<string, unknown>, path: Path, value: unknown): void {
  let cur: Record<string | number, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const next = cur[path[i] as string | number];
    if (next === null || typeof next !== 'object') return;
    cur = next as Record<string | number, unknown>;
  }
  const last = path[path.length - 1];
  if (last !== undefined) cur[last] = value;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** defaults のキーだけを辿って raw を重ねる(未知のキーは捨てる。配列は丸ごと置き換え) */
function overlay(defaults: unknown, raw: unknown): unknown {
  if (isRecord(defaults)) {
    if (!isRecord(raw)) return deepClone(defaults);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(defaults)) {
      out[k] = k in raw ? overlay(defaults[k], raw[k]) : deepClone(defaults[k]);
    }
    return out;
  }
  return raw === undefined ? deepClone(defaults) : raw;
}

/**
 * 保存されていた(一部だけの/古い)設定を defaults に重ねる。
 * 未知のキーは捨て、不正な値はその項目だけ既定値に戻す。
 */
export function migrateSettings(raw: unknown, defaults: PlannerSettings): PlannerSettings {
  const merged = overlay(defaults, raw) as Record<string, unknown>;
  merged.version = 1;
  for (let guard = 0; guard < 64; guard++) {
    const r = plannerSettingsObject.safeParse(merged);
    if (r.success) return r.data;
    for (const issue of r.error.issues) {
      // 既定値が存在する最長の接頭辞(配列の要素なら配列ごと)を既定値に戻す
      let path: Path = issue.path.slice();
      while (path.length > 0) {
        const parent = getAt(defaults, path.slice(0, -1));
        if (getAt(defaults, path) !== undefined && !Array.isArray(parent)) break;
        path = path.slice(0, -1);
      }
      if (path.length === 0) return deepClone(defaults);
      setAt(merged, path, deepClone(getAt(defaults, path)));
    }
  }
  return deepClone(defaults);
}
