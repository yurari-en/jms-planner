// 静的マスタの索引。DESIGN.md §4.1.2。純粋関数のみ(I/O なし)。
import type {
  CubeDef,
  CubeId,
  CubeTableBand,
  CubeTableKind,
  EquipSlotKind,
  Grade,
  ItemMaster,
  JobDef,
  LineDist,
  MasterData,
  Part,
  PotOption,
  StatKey,
} from './types';

export interface CubeTableResolution {
  /** 3行分の分布(lineDists から解決済み) */
  lines: LineDist[];
  lineIds: [number, number, number];
  bandMinLv: number;
  usedCube: CubeTableKind;
  usedPart: Part;
  /** 例: red → black */
  fallbackCube: boolean;
  /** overall → top、shield/forceShield → secondary */
  fallbackPart: boolean;
}

export interface ItemSearchHit {
  item: ItemMaster;
  score: number;
}

export interface MasterIndexes {
  itemsById: Map<number, ItemMaster>;
  /** lv 降順、同 lv は名前順 */
  itemsBySlot: Map<EquipSlotKind, ItemMaster[]>;
  jobsById: Map<string, JobDef>;
  cubesById: Map<CubeId, CubeDef>;
  optionById: (id: number) => PotOption | undefined;
  optionByKr: (kr: string) => PotOption | undefined;
  /** 名前の正規化: NFKC → 小文字 → カタカナをひらがなに → 空白・中黒・長音記号以外の記号を除去 */
  normalizeName: (s: string) => string;
  /** 部位で絞った部分一致検索。前方一致を優先、次に部分一致、同点は lv desc。limit 既定 30 */
  searchItems: (kind: EquipSlotKind, query: string, limit?: number) => ItemMaster[];
  /** 確率表の解決(フォールバック込み)。見つからなければ null */
  cubeTable: (
    cube: CubeTableKind,
    grade: Grade,
    part: Part,
    lv: number,
  ) => CubeTableResolution | null;
  /** その表の3行に出うるオプションの和集合(id 昇順)。表が無ければ [] */
  potentialOptionsFor: (cube: CubeTableKind, grade: Grade, part: Part, lv: number) => PotOption[];
  /** レジェ潜在(black 表)の主ステ%の最大値(帽子のクール減換算用)。表が無ければ null */
  legendaryMainStatPct: (part: Part, lv: number, stat: StatKey) => number | null;
  /** flame.json bossItems.nonBossExceptions に名前が(カッコ内の注記を除いて)部分一致するか */
  isNonBossException: (name: string) => boolean;
  /** flame.json eligibility.exceptionsCanFlame に部分一致(スカーレットショルダー等) */
  isFlameException: (name: string) => boolean;
}

const PART_FALLBACK: Partial<Record<Part, Part>> = {
  overall: 'top',
  shield: 'secondary',
  forceShield: 'secondary',
};

const CUBE_FALLBACK: Partial<Record<CubeTableKind, CubeTableKind>> = {
  red: 'black',
};

const DEFAULT_SEARCH_LIMIT = 30;

/** NFKC → 小文字 → カタカナをひらがなに → 空白・中黒・長音記号以外の記号を除去 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[^\p{L}\p{M}\p{N}\s・ー]/gu, '');
}

/** 注記 `(…)` / `（…）` を除いてから正規化 */
function stripAnnotations(s: string): string {
  return s.replace(/[(（][^()（）]*[)）]/g, '');
}

function compareItems(a: ItemMaster, b: ItemMaster): number {
  return b.lv - a.lv || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id - b.id);
}

/** 昇順の帯から minLv <= lv となる最後の要素 */
function selectBand(bands: readonly CubeTableBand[], lv: number): CubeTableBand | undefined {
  let found: CubeTableBand | undefined;
  for (const b of bands) {
    if (b.minLv <= lv) found = b;
    else break;
  }
  return found;
}

export function buildIndexes(data: MasterData): MasterIndexes {
  const { cubeTables, flame } = data;

  // ---- items
  const itemsById = new Map<number, ItemMaster>();
  const itemsBySlot = new Map<EquipSlotKind, ItemMaster[]>();
  const normById = new Map<number, string>();
  for (const it of data.items.items) {
    itemsById.set(it.id, it);
    normById.set(it.id, normalizeName(it.name));
    let list = itemsBySlot.get(it.slot);
    if (!list) itemsBySlot.set(it.slot, (list = []));
    list.push(it);
  }
  for (const list of itemsBySlot.values()) list.sort(compareItems);

  const searchItems = (kind: EquipSlotKind, query: string, limit = DEFAULT_SEARCH_LIMIT) => {
    const list = itemsBySlot.get(kind) ?? [];
    const q = normalizeName(query).trim();
    if (!q) return list.slice(0, limit);
    const hits: ItemSearchHit[] = [];
    for (const item of list) {
      const n = normById.get(item.id) ?? '';
      const pos = n.indexOf(q);
      if (pos < 0) continue;
      hits.push({ item, score: pos === 0 ? 2 : 1 });
    }
    // list は既に lv desc なので安定ソートで同点の順序が保たれる
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit).map((h) => h.item);
  };

  // ---- jobs / cubes / options
  const jobsById = new Map(data.jobs.jobs.map((j) => [j.id, j] as const));
  const cubesById = new Map(data.cubes.cubes.map((c) => [c.id, c] as const));
  const optById = new Map<number, PotOption>();
  const optByKr = new Map<string, PotOption>();
  for (const o of cubeTables.options) {
    optById.set(o.id, o);
    if (!optByKr.has(o.kr)) optByKr.set(o.kr, o);
  }

  // ---- cube tables
  const tryResolve = (
    cube: CubeTableKind,
    grade: Grade,
    part: Part,
    lv: number,
  ): Omit<CubeTableResolution, 'fallbackCube' | 'fallbackPart'> | null => {
    const bands = cubeTables.tables[`${cube}/${grade}/${part}`];
    if (!bands) return null;
    const band = selectBand(bands, lv);
    if (!band?.lines) return null;
    const lines: LineDist[] = [];
    for (const idx of band.lines) {
      const dist = cubeTables.lineDists[idx];
      if (!dist) return null;
      lines.push(dist);
    }
    return { lines, lineIds: band.lines, bandMinLv: band.minLv, usedCube: cube, usedPart: part };
  };

  const cubeTable = (
    cube: CubeTableKind,
    grade: Grade,
    part: Part,
    lv: number,
  ): CubeTableResolution | null => {
    const fbPart = PART_FALLBACK[part];
    const fbCube = CUBE_FALLBACK[cube];
    const candidates: [CubeTableKind, Part][] = [[cube, part]];
    if (fbPart) candidates.push([cube, fbPart]);
    if (fbCube) {
      candidates.push([fbCube, part]);
      if (fbPart) candidates.push([fbCube, fbPart]);
    }
    for (const [c, p] of candidates) {
      const r = tryResolve(c, grade, p, lv);
      if (r) return { ...r, fallbackCube: c !== cube, fallbackPart: p !== part };
    }
    return null;
  };

  const potentialOptionsFor = (
    cube: CubeTableKind,
    grade: Grade,
    part: Part,
    lv: number,
  ): PotOption[] => {
    const r = cubeTable(cube, grade, part, lv);
    if (!r) return [];
    const ids = new Set<number>();
    for (const dist of r.lines) for (const [id] of dist) ids.add(id);
    const out: PotOption[] = [];
    for (const id of [...ids].sort((a, b) => a - b)) {
      const o = optById.get(id);
      if (o) out.push(o);
    }
    return out;
  };

  const legendaryMainStatPct = (part: Part, lv: number, stat: StatKey): number | null => {
    let max: number | null = null;
    for (const o of potentialOptionsFor('black', 'legendary', part, lv)) {
      if (o.key === 'statPct' && o.stat === stat && (max === null || o.value > max)) max = o.value;
    }
    return max;
  };

  // ---- name exception lists
  const keywords = (list: readonly string[]) =>
    list.map((s) => normalizeName(stripAnnotations(s)).trim()).filter((s) => s.length > 0);
  const nonBossKeys = keywords(flame.bossItems.nonBossExceptions);
  const flameKeys = keywords(flame.eligibility.exceptionsCanFlame);
  const matchesAny = (keys: readonly string[], name: string) => {
    const n = normalizeName(name);
    return keys.some((k) => n.includes(k));
  };

  return {
    itemsById,
    itemsBySlot,
    jobsById,
    cubesById,
    optionById: (id) => optById.get(id),
    optionByKr: (kr) => optByKr.get(kr),
    normalizeName,
    searchItems,
    cubeTable,
    potentialOptionsFor,
    legendaryMainStatPct,
    isNonBossException: (name) => matchesAny(nonBossKeys, name),
    isFlameException: (name) => matchesAny(flameKeys, name),
  };
}
