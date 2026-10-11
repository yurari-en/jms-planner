// localStorage の安全な読み書き。DESIGN.md §4.2。
// - 読み書きはすべて try/catch(プライベートウィンドウ等で失敗しても画面は動く)
// - 読めないデータは壊さずに `${key}:backup:${timestamp}` へ退避してから初期化する
import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware';
import type { ZodType } from 'zod';

function storage(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function readStorage(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // 何もしない
  }
}

// ---------------------------------------------------------------- 退避の記録

/** このセッションで退避したキー(トーストで知らせる用)。`consumeRecoveredKeys` で取り出す */
export const recoveredKeys: { key: string; backupKey: string | null }[] = [];

export function consumeRecoveredKeys(): { key: string; backupKey: string | null }[] {
  return recoveredKeys.splice(0, recoveredKeys.length);
}

/**
 * 生の文字列を `${key}:backup:${ts}` にコピーする。`remove` なら元のキーを消す(= 移動)。
 * 退避先へ書けなかったときは元のキーを消さない(データを失わないため)。戻り値は退避キー。
 */
export function backupRaw(key: string, raw: string, remove = true): string | null {
  const backupKey = `${key}:backup:${Date.now()}`;
  const ok = writeStorage(backupKey, raw);
  if (ok && remove) removeStorage(key);
  recoveredKeys.push({ key, backupKey: ok ? backupKey : null });
  return ok ? backupKey : null;
}

/** JSON.parse の例外を握りつぶす版。失敗は `{ ok: false }` */
export function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * key を読み、JSON として schema で検証する。
 * - 未保存: fallback(recovered=false)
 * - 読めない/検証に失敗: 生の文字列を退避キーへ移し、fallback(recovered=true)
 */
export function loadValidated<T>(
  key: string,
  schema: ZodType<T>,
  fallback: () => T,
): { value: T; recovered: boolean; backupKey?: string } {
  const raw = readStorage(key);
  if (raw === null) return { value: fallback(), recovered: false };
  const parsed = safeJsonParse(raw);
  if (parsed.ok) {
    const r = schema.safeParse(parsed.value);
    if (r.success) return { value: r.data, recovered: false };
  }
  const backupKey = backupRaw(key, raw, true);
  return backupKey
    ? { value: fallback(), recovered: true, backupKey }
    : { value: fallback(), recovered: true };
}

// ---------------------------------------------------------------- 遅延書き込み

export interface DebouncedStorage extends StateStorage {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
  /** 保留中の書き込みをすぐに反映する */
  flush: () => void;
}

/**
 * Zustand `persist` 用の StateStorage。書き込みを ms ミリ秒まとめ、
 * pagehide / beforeunload で保留分を書き出す。読み出しは保留中の値を優先する。
 */
export function createDebouncedStorage(ms = 300): DebouncedStorage {
  const pending = new Map<string, string | null>(); // null = 削除
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    for (const [k, v] of pending) {
      if (v === null) removeStorage(k);
      else writeStorage(k, v);
    }
    pending.clear();
  };

  const schedule = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, ms);
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }

  return {
    getItem: (name) => (pending.has(name) ? (pending.get(name) ?? null) : readStorage(name)),
    setItem: (name, value) => {
      pending.set(name, value);
      schedule();
    },
    removeItem: (name) => {
      pending.set(name, null);
      schedule();
    },
    flush,
  };
}

/** 即時書き込みの StateStorage */
export const immediateStorage: StateStorage = {
  getItem: readStorage,
  setItem: (name, value) => {
    writeStorage(name, value);
  },
  removeItem: removeStorage,
};

// ---------------------------------------------------------------- persist 用アダプタ

/**
 * Zustand `persist` の PersistStorage。localStorage には Zustand の `{state, version}` 包みではなく
 * `{ version: 1, ...state }` の平らな形で保存する(DESIGN.md §4.2 / index.html のテーマ初期化と同じ形)。
 * `parse` が null を返したら(検証失敗)生データを退避して null(= 初期状態)を返す。
 * `parse` が `{ partial: true }` を返したら、元データを退避(コピー)した上で値を使う。
 */
export function createFlatPersistStorage<S extends object>(
  base: StateStorage,
  parse: (json: unknown) => { state: S; partial?: boolean } | null,
  version = 1,
): PersistStorage<S> {
  return {
    getItem: (name) => {
      const raw = base.getItem(name);
      if (typeof raw !== 'string') return null; // 非同期ストレージは使わない
      const json = safeJsonParse(raw);
      const result = json.ok ? parse(json.value) : null;
      if (!result) {
        backupRaw(name, raw, true);
        return null;
      }
      if (result.partial) backupRaw(name, raw, false);
      return { state: result.state, version } satisfies StorageValue<S>;
    },
    setItem: (name, value) => {
      base.setItem(name, JSON.stringify({ version, ...value.state }));
    },
    removeItem: (name) => {
      base.removeItem(name);
    },
  };
}
