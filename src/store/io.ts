// JSON 書き出し/読み込み。DESIGN.md §4.2。
import { SLOT_LABEL_JA, type CharacterInput } from '../domain/character';
import { exportFileSchema, isRecord, migrateCharacter, type ExportFile } from './schemas';

export function buildExportFile(chars: CharacterInput[]): ExportFile {
  return {
    app: 'jms-planner',
    version: 1,
    exportedAt: new Date().toISOString(),
    characters: chars,
  };
}

/** `jms-planner-{name}-{YYYYMMDD}.json`。ファイル名に使えない文字は `_` に置き換える(日付はローカル時刻) */
export function exportFilename(name: string, date = new Date()): string {
  // eslint-disable-next-line no-control-regex
  let safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  safe = safe.replace(/[. ]+$/, '');
  if (safe === '') safe = 'character';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `jms-planner-${safe}-${y}${m}${d}.json`;
}

export type ParseImportResult =
  { ok: true; characters: CharacterInput[] } | { ok: false; error: string };

/** 書き出しファイル、またはキャラ1件の JSON を読む */
export function parseImportText(text: string): ParseImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, error: 'JSON として読めません。ファイルの中身を確認してください。' };
  }
  if (!isRecord(json)) {
    return { ok: false, error: 'このアプリで書き出したファイルではありません。' };
  }

  if (json.app === 'jms-planner' || Array.isArray(json.characters)) {
    if (json.app !== undefined && json.app !== 'jms-planner') {
      return { ok: false, error: 'このアプリで書き出したファイルではありません。' };
    }
    if (json.version !== 1) {
      return { ok: false, error: '対応していないファイルのバージョンです。' };
    }
    const list = Array.isArray(json.characters) ? json.characters : [];
    const characters: CharacterInput[] = [];
    for (let i = 0; i < list.length; i++) {
      const ch = migrateCharacter(list[i]);
      if (!ch) return { ok: false, error: `${i + 1}件目のキャラのデータが不正です。` };
      characters.push(ch);
    }
    if (characters.length === 0) {
      return { ok: false, error: 'キャラが1件も含まれていません。' };
    }
    // 最終確認(移行後の形がファイル形式として正しいか)
    const check = exportFileSchema.safeParse({ ...json, characters });
    if (!check.success) return { ok: false, error: 'ファイルの形式が正しくありません。' };
    return { ok: true, characters };
  }

  if ('equips' in json || 'jobId' in json || 'stats' in json) {
    const ch = migrateCharacter(json);
    if (!ch) return { ok: false, error: 'キャラのデータが不正です。' };
    return { ok: true, characters: [ch] };
  }
  return { ok: false, error: 'このアプリで書き出したファイルではありません。' };
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** 既存のキャラとの違い(日本語の項目名)。existing が無ければ isNew */
export function diffCharacters(
  existing: CharacterInput | undefined,
  incoming: CharacterInput,
): { isNew: boolean; changed: string[] } {
  if (!existing) return { isNew: true, changed: [] };
  const changed: string[] = [];
  if (existing.name !== incoming.name) changed.push('名前');
  if (existing.jobId !== incoming.jobId) changed.push('職業');
  if (existing.level !== incoming.level) changed.push('Lv');
  if (existing.displayedCP !== incoming.displayedCP) changed.push('戦闘力');
  const statKeys = [
    'stats',
    'hp',
    'attack',
    'dmgPct',
    'bossPct',
    'critDmgPct',
    'pctOther',
  ] as const;
  if (statKeys.some((k) => !same(existing[k], incoming[k]))) changed.push('ステータス');

  const slots: string[] = [];
  const oldBySlot = new Map(existing.equips.map((e) => [e.slot, e]));
  const seen = new Set<string>();
  for (const e of incoming.equips) {
    seen.add(e.slot);
    if (!same(oldBySlot.get(e.slot), e)) slots.push(SLOT_LABEL_JA[e.slot] ?? e.slot);
  }
  for (const e of existing.equips) {
    if (!seen.has(e.slot)) slots.push(SLOT_LABEL_JA[e.slot] ?? e.slot);
  }
  if (slots.length > 0) {
    const shown = slots.slice(0, 5).join('、');
    changed.push(
      slots.length > 5 ? `装備(${shown} ほか${slots.length - 5}部位)` : `装備(${shown})`,
    );
  }
  return { isNew: false, changed };
}

/** ブラウザでファイルとして保存する(document が無ければ何もしない) */
export function downloadJson(filename: string, obj: unknown): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
