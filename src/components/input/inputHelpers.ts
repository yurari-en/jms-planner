// 入力画面の純粋ヘルパ(React に依存しない)。DESIGN.md §5.1 の %入力補助など。
import type { Grade, PotOption, StatKey } from '../../data/types';
import type { MasterIndexes } from '../../data/indexes';
import type {
  CharacterInput,
  EquipInput,
  EquipOverrides,
  PotGrade,
  PotState,
} from '../../domain/character';
import { resolvePotLines } from '../../domain/planner';

export const STAT_KEYS_ALL: readonly StatKey[] = ['STR', 'DEX', 'INT', 'LUK'];

export const GRADE_LABEL_JA: Record<PotGrade, string> = {
  none: 'なし',
  rare: 'レア',
  epic: 'エピック',
  unique: 'ユニーク',
  legendary: 'レジェンダリー',
};

export const GRADE_SHORT_JA: Record<Grade, string> = {
  rare: 'レア',
  epic: 'エピ',
  unique: 'ユニ',
  legendary: 'レジェ',
};

export const POT_GRADES: readonly PotGrade[] = ['none', 'rare', 'epic', 'unique', 'legendary'];

/** 浮動小数の誤差を落とす(小数3桁) */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** 潜在/アディの解決済み行から、stat の % (主ステ% と 全ステ%)を合計する */
function potPctFor(state: PotState, idx: MasterIndexes, stat: StatKey): number {
  if (state.grade === 'none') return 0;
  let sum = 0;
  for (const o of resolvePotLines(state, idx)) {
    if (!o) continue;
    if (o.key === 'allStatPct') sum += o.value;
    else if (o.key === 'statPct' && o.stat === stat) sum += o.value;
  }
  return sum;
}

/** 装備1つ分の stat% (潜在 + アディ + 炎の全ステ%) */
export function equipStatPct(eq: EquipInput, idx: MasterIndexes, stat: StatKey): number {
  return (
    potPctFor(eq.potential, idx, stat) +
    potPctFor(eq.additional, idx, stat) +
    (eq.flame.allStatPct || 0)
  );
}

/** 「装備から自動集計」: 全装備の stat% の合計 */
export function autoStatPct(
  equips: readonly EquipInput[],
  idx: MasterIndexes,
): Record<StatKey, number> {
  const out = { STR: 0, DEX: 0, INT: 0, LUK: 0 } as Record<StatKey, number>;
  for (const eq of equips) {
    for (const k of STAT_KEYS_ALL) out[k] += equipStatPct(eq, idx, k);
  }
  for (const k of STAT_KEYS_ALL) out[k] = round3(out[k]);
  return out;
}

/** 「その他」の値。保存値が無ければ現在の %合計 − 自動集計 から逆算する */
export function otherPctOf(ch: CharacterInput, stat: StatKey, auto: number): number {
  const saved = ch.pctOther?.[stat];
  return saved ?? round3(ch.stats[stat].pct - auto);
}

/** 「その他」を書き換え、%合計 = 自動 + その他 を保存する */
export function withOtherPct(
  ch: CharacterInput,
  stat: StatKey,
  other: number,
  idx: MasterIndexes,
): CharacterInput {
  const auto = autoStatPct(ch.equips, idx)[stat];
  return {
    ...ch,
    pctOther: { ...ch.pctOther, [stat]: other },
    stats: { ...ch.stats, [stat]: { ...ch.stats[stat], pct: round3(auto + other) } },
  };
}

/** %合計を直接書き換えたとき: その他 = 合計 − 自動 として保存 */
export function withTotalPct(
  ch: CharacterInput,
  stat: StatKey,
  total: number,
  idx: MasterIndexes,
): CharacterInput {
  const auto = autoStatPct(ch.equips, idx)[stat];
  return {
    ...ch,
    pctOther: { ...ch.pctOther, [stat]: round3(total - auto) },
    stats: { ...ch.stats, [stat]: { ...ch.stats[stat], pct: total } },
  };
}

/**
 * 装備の変更後に %合計を追従させる。自動集計が変わったステだけ
 * pct = 新しい自動 + その他(その他が未保存なら 旧pct − 旧自動 を確定して保存)にする。
 * 変化が無ければ next をそのまま返す。
 */
export function syncPctAfterEquipChange(
  prev: CharacterInput,
  next: CharacterInput,
  idx: MasterIndexes,
): CharacterInput {
  const before = autoStatPct(prev.equips, idx);
  const after = autoStatPct(next.equips, idx);
  let stats = next.stats;
  let pctOther = next.pctOther;
  for (const k of STAT_KEYS_ALL) {
    if (before[k] === after[k]) continue;
    const other = prev.pctOther?.[k] ?? round3(prev.stats[k].pct - before[k]);
    stats = { ...stats, [k]: { ...stats[k], pct: round3(after[k] + other) } };
    pctOther = { ...pctOther, [k]: other };
  }
  if (stats === next.stats) return next;
  return { ...next, stats, pctOther };
}

/** 1装備を差し替える(無ければ変更なし) */
export function replaceEquip(
  ch: CharacterInput,
  slot: EquipInput['slot'],
  updater: (e: EquipInput) => EquipInput | void,
): CharacterInput {
  const i = ch.equips.findIndex((e) => e.slot === slot);
  const cur = ch.equips[i];
  if (!cur) return ch;
  const nextEq = updater(cur);
  if (!nextEq || nextEq === cur) return ch;
  const equips = ch.equips.slice();
  equips[i] = { ...nextEq, slot };
  return { ...ch, equips };
}

/** overrides の1項目を設定(undefined なら削除)。空になれば overrides 自体を消す */
export function withOverride<K extends keyof EquipOverrides>(
  eq: EquipInput,
  key: K,
  value: EquipOverrides[K] | undefined,
): EquipInput {
  const o: EquipOverrides = { ...eq.overrides };
  if (value === undefined) delete o[key];
  else o[key] = value;
  const next: EquipInput = { ...eq };
  if (Object.keys(o).length === 0) delete next.overrides;
  else next.overrides = o;
  return next;
}

/** 潜在の1行を書き換える(lines と lineKr を同期) */
export function withPotLine(state: PotState, i: number, opt: PotOption | null): PotState {
  const lines = [...state.lines] as PotState['lines'];
  const lineKr = [...(state.lineKr ?? [null, null, null])] as NonNullable<PotState['lineKr']>;
  lines[i] = opt ? opt.id : null;
  lineKr[i] = opt ? opt.kr : null;
  return { ...state, lines, lineKr };
}

/** 選択肢一覧に無い(または解決できない)保存行の index */
export function unknownLineIndexes(
  state: PotState,
  options: readonly PotOption[],
  idx: MasterIndexes,
): number[] {
  if (state.grade === 'none') return [];
  const resolved = resolvePotLines(state, idx);
  const ids = new Set(options.map((o) => o.id));
  const out: number[] = [];
  state.lines.forEach((id, i) => {
    if (id == null) return;
    const r = resolved[i];
    if (!r || !ids.has(r.id)) out.push(i);
  });
  return out;
}

/** 空欄 = undefined の数値読み取り(全角・カンマ可)。読めなければ null */
export function parseOptionalNumber(text: string): number | undefined | null {
  const t = text
    .normalize('NFKC')
    .replace(/[,\s]/g, '')
    .replace(/[ー−–—]/g, '-');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
