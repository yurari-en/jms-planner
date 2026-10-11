import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- localStorage のメモリ実装(ストアの import より前に入れる)
const mem = vi.hoisted(() => {
  class MemoryStorage {
    map = new Map<string, string>();
    get length() {
      return this.map.size;
    }
    clear() {
      this.map.clear();
    }
    getItem(k: string) {
      return this.map.has(k) ? (this.map.get(k) as string) : null;
    }
    setItem(k: string, v: string) {
      this.map.set(k, String(v));
    }
    removeItem(k: string) {
      this.map.delete(k);
    }
    key(i: number) {
      return Array.from(this.map.keys())[i] ?? null;
    }
  }
  const storage = new MemoryStorage();
  (globalThis as { localStorage?: unknown }).localStorage = storage;
  return storage;
});

import type { CubesMaster } from '../../src/data/types';
import { EQUIP_SLOTS, emptyCharacter, type CharacterInput } from '../../src/domain/character';
import { defaultSettings } from '../../src/domain/settings';
import {
  CHARACTERS_KEY,
  charactersDebouncedStorage,
  parseCharactersFile,
  useCharactersStore,
} from '../../src/store/characters';
import {
  buildExportFile,
  diffCharacters,
  exportFilename,
  parseImportText,
} from '../../src/store/io';
import {
  consumeRecoveredKeys,
  createDebouncedStorage,
  loadValidated,
  readStorage,
} from '../../src/store/persist';
import {
  characterInputSchema,
  migrateCharacter,
  migrateSettings,
  plannerSettingsSchema,
  uiStateSchema,
} from '../../src/store/schemas';
import { SETTINGS_KEY, settingsDebouncedStorage, useSettingsStore } from '../../src/store/settings';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cubes = JSON.parse(
  fs.readFileSync(path.join(root, 'public/data/cubes.json'), 'utf8'),
) as CubesMaster;

function backupKeys(key: string): string[] {
  return Array.from(mem.map.keys()).filter((k) => k.startsWith(`${key}:backup:`));
}

beforeEach(() => {
  mem.clear();
  consumeRecoveredKeys();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('persist', () => {
  it('loadValidated: 壊れた JSON は key:backup:<ts> に移して fallback を返す', () => {
    mem.setItem('k', '{not json');
    const r = loadValidated('k', uiStateSchema, () => ({
      version: 1 as const,
      theme: 'dark' as const,
      tab: 'plan' as const,
      collapsed: {},
      firstRunDismissed: false,
    }));
    expect(r.recovered).toBe(true);
    expect(r.value.theme).toBe('dark');
    expect(r.backupKey).toMatch(/^k:backup:\d+$/);
    expect(mem.getItem('k')).toBeNull();
    expect(mem.getItem(r.backupKey as string)).toBe('{not json');
    expect(consumeRecoveredKeys()).toHaveLength(1);
  });

  it('loadValidated: 形が違う JSON も退避する / 正しい JSON はそのまま', () => {
    mem.setItem('k', JSON.stringify({ version: 2 }));
    const bad = loadValidated('k', uiStateSchema, () => null as never);
    expect(bad.recovered).toBe(true);
    expect(backupKeys('k')).toHaveLength(1);

    const good = {
      version: 1,
      theme: 'light',
      tab: 'input',
      collapsed: { a: true },
      firstRunDismissed: true,
    };
    mem.setItem('k2', JSON.stringify(good));
    const ok = loadValidated('k2', uiStateSchema, () => null as never);
    expect(ok.recovered).toBe(false);
    expect(ok.value).toEqual(good);
  });

  it('loadValidated: 未保存なら fallback(recovered=false)', () => {
    const r = loadValidated('none', uiStateSchema, () => null as never);
    expect(r.recovered).toBe(false);
  });

  it('createDebouncedStorage: 300ms 以内の2回の書き込みを1回にまとめる', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(mem, 'setItem');
    const s = createDebouncedStorage(300);
    s.setItem('d', 'a');
    vi.advanceTimersByTime(100);
    s.setItem('d', 'b');
    expect(spy).not.toHaveBeenCalled();
    expect(s.getItem('d')).toBe('b'); // 保留中の値を読む
    vi.advanceTimersByTime(299);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('d', 'b');
    spy.mockRestore();
  });

  it('createDebouncedStorage: flush ですぐ書く / removeItem も遅延', () => {
    vi.useFakeTimers();
    const s = createDebouncedStorage(300);
    s.setItem('d', 'x');
    s.flush();
    expect(mem.getItem('d')).toBe('x');
    s.removeItem('d');
    expect(mem.getItem('d')).toBe('x');
    vi.advanceTimersByTime(300);
    expect(mem.getItem('d')).toBeNull();
  });
});

describe('migrateCharacter', () => {
  it('欠けた部位を補い、未知の部位・重複を捨てる', () => {
    const base = emptyCharacter('c1', 'テスト');
    const raw = {
      ...base,
      equips: [
        { slot: 'hat', itemId: 1003797, star: 17 },
        { slot: 'hat', itemId: 1, star: 1 }, // 重複
        { slot: 'android', itemId: 5, star: 0 }, // 未知
        { slot: 'weapon', star: 22, potential: { grade: 'legendary', lines: [1, 2, null] } },
      ],
    };
    const ch = migrateCharacter(raw);
    expect(ch).not.toBeNull();
    const c = ch as CharacterInput;
    expect(c.equips.map((e) => e.slot)).toEqual([...EQUIP_SLOTS]);
    const hat = c.equips.find((e) => e.slot === 'hat');
    expect(hat?.itemId).toBe(1003797);
    expect(hat?.star).toBe(17);
    expect(hat?.potential).toEqual({ grade: 'none', lines: [null, null, null] });
    const weapon = c.equips.find((e) => e.slot === 'weapon');
    expect(weapon?.potential.grade).toBe('legendary');
    expect(weapon?.itemId).toBeNull();
    expect(characterInputSchema.safeParse(c).success).toBe(true);
  });

  it('省略されたフィールドを既定値で補う / 未知のキーは捨てる', () => {
    const ch = migrateCharacter({ version: 1, id: 'x', name: 'A', jobId: 'bishop', extra: 1 });
    expect(ch?.level).toBe(200);
    expect(ch?.stats.LUK).toEqual({ final: 0, pct: 0, nonPct: 0 });
    expect(ch && 'extra' in ch).toBe(false);
  });

  it('不正な値・別バージョンは null', () => {
    expect(migrateCharacter({ ...emptyCharacter('a'), level: -1 })).toBeNull();
    expect(migrateCharacter({ ...emptyCharacter('a'), version: 2 })).toBeNull();
    expect(migrateCharacter('abc')).toBeNull();
    const e = { ...emptyCharacter('a') };
    e.equips = [{ ...e.equips[0]!, star: Number.NaN }];
    expect(migrateCharacter(e)).toBeNull();
  });
});

describe('migrateSettings', () => {
  const defaults = defaultSettings(cubes);

  it('部分的な保存値を既定値に重ね、未知のキーを捨てる', () => {
    const s = migrateSettings(
      {
        version: 1,
        starCatch: false,
        events: { discount30: true, unknownEvent: true },
        cubes: { neo: { priceNP: 90 } },
        legacyKey: 123,
      },
      defaults,
    );
    expect(s.starCatch).toBe(false);
    expect(s.events.discount30).toBe(true);
    expect(s.events.destroyDown30).toBe(false);
    expect('unknownEvent' in s.events).toBe(false);
    expect('legacyKey' in s).toBe(false);
    expect(s.cubes.neo).toEqual({ enabled: defaults.cubes.neo.enabled, priceNP: 90 });
    expect(s.cubes.mega).toEqual(defaults.cubes.mega);
    expect(s.stepLimit).toBe(defaults.stepLimit);
    expect(plannerSettingsSchema.safeParse(s).success).toBe(true);
  });

  it('不正な値はその項目だけ既定値に戻す', () => {
    const s = migrateSettings(
      {
        vipRank: 'platinum',
        cdrLinesPer2Sec: 3,
        stepLimit: 'many',
        melPerNP: -5,
        safeguardStars: [15, 'x'],
        include: { starforce: 'yes', potential: false },
        sfMaxTarget: 25,
      },
      defaults,
    );
    expect(s.vipRank).toBe(defaults.vipRank);
    expect(s.cdrLinesPer2Sec).toBe('auto');
    expect(s.stepLimit).toBe(defaults.stepLimit);
    expect(s.melPerNP).toBe(defaults.melPerNP);
    expect(s.safeguardStars).toEqual(defaults.safeguardStars);
    expect(s.include).toEqual({ starforce: true, potential: false, additional: true });
    expect(s.sfMaxTarget).toBe(25);
  });

  it('オブジェクトでなければ既定値', () => {
    expect(migrateSettings('garbage', defaults)).toEqual(defaults);
  });
});

describe('io', () => {
  it('exportFilename: ファイル名に使えない文字を _ に', () => {
    expect(exportFilename('テスト/キャラ', new Date('2026-10-12'))).toBe(
      'jms-planner-テスト_キャラ-20261012.json',
    );
    expect(exportFilename('a:b*c?', new Date(2026, 0, 5))).toBe('jms-planner-a_b_c_-20260105.json');
  });

  it('parseImportText: 書き出しファイルを読める', () => {
    const a = emptyCharacter('a', 'A');
    const b = emptyCharacter('b', 'B');
    const r = parseImportText(JSON.stringify(buildExportFile([a, b])));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.characters.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('parseImportText: キャラ1件の JSON も読める(部位は補う)', () => {
    const a = { ...emptyCharacter('a', 'A'), equips: [] };
    const r = parseImportText(JSON.stringify(a));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.characters).toHaveLength(1);
      expect(r.characters[0]?.equips).toHaveLength(EQUIP_SLOTS.length);
    }
  });

  it('parseImportText: ゴミは日本語のエラー', () => {
    for (const text of ['not json', '[1,2]', '{"foo":1}', '{"app":"other","version":1}']) {
      const r = parseImportText(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/[ぁ-んァ-ン一-龥]/);
    }
    const bad = parseImportText(
      JSON.stringify({ ...buildExportFile([]), characters: [{ version: 1, level: 'x' }] }),
    );
    expect(bad.ok).toBe(false);
  });

  it('diffCharacters: 新規 / 変わった項目のラベル', () => {
    const a = emptyCharacter('a', 'A');
    expect(diffCharacters(undefined, a)).toEqual({ isNew: true, changed: [] });
    expect(diffCharacters(a, { ...a, updatedAt: 'x' })).toEqual({ isNew: false, changed: [] });
    const b: CharacterInput = {
      ...a,
      name: 'B',
      level: 260,
      displayedCP: 1000,
      bossPct: 300,
      equips: a.equips.map((e) => (e.slot === 'hat' ? { ...e, star: 22 } : e)),
    };
    const d = diffCharacters(a, b);
    expect(d.isNew).toBe(false);
    expect(d.changed).toEqual(['名前', 'Lv', '戦闘力', 'ステータス', '装備(帽子)']);
    expect(diffCharacters(a, { ...a, jobId: 'bishop' }).changed).toEqual(['職業']);
  });
});

describe('characters store', () => {
  beforeEach(() => {
    useCharactersStore.setState({ activeId: null, characters: {} });
  });

  it('addCharacter: 空のキャラを作って選択する', () => {
    const id = useCharactersStore.getState().addCharacter('メイン');
    const s = useCharactersStore.getState();
    expect(s.activeId).toBe(id);
    expect(s.characters[id]?.name).toBe('メイン');
    expect(s.characters[id]?.equips).toHaveLength(EQUIP_SLOTS.length);
  });

  it('updateEquip: 不変更新し updatedAt を更新する', () => {
    const id = useCharactersStore.getState().addCharacter();
    const before = useCharactersStore.getState().characters[id] as CharacterInput;
    useCharactersStore.getState().updateEquip(id, 'hat', (e) => ({ ...e, star: 17 }));
    const after = useCharactersStore.getState().characters[id] as CharacterInput;
    expect(after).not.toBe(before);
    expect(after.equips.find((e) => e.slot === 'hat')?.star).toBe(17);
    expect(before.equips.find((e) => e.slot === 'hat')?.star).toBe(0);
    expect(after.equips.find((e) => e.slot === 'weapon')).toBe(
      before.equips.find((e) => e.slot === 'weapon'),
    );
    // undefined を返すと変更なし
    useCharactersStore.getState().updateEquip(id, 'hat', () => undefined);
    expect(useCharactersStore.getState().characters[id]).toBe(after);
  });

  it('importCharacters copy: 新しい id と (コピー) 付きの名前で両方残す', () => {
    const id = useCharactersStore.getState().addCharacter('メイン');
    const orig = useCharactersStore.getState().characters[id] as CharacterInput;
    const ids = useCharactersStore.getState().importCharacters([orig], 'copy');
    const s = useCharactersStore.getState();
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(id);
    expect(Object.keys(s.characters)).toHaveLength(2);
    expect(s.characters[ids[0] as string]?.name).toBe('メイン (コピー)');
    expect(s.characters[id]?.name).toBe('メイン');
    expect(s.activeId).toBe(id);
  });

  it('importCharacters overwrite: 同じ id を置き換える', () => {
    const id = useCharactersStore.getState().addCharacter('メイン');
    const orig = useCharactersStore.getState().characters[id] as CharacterInput;
    useCharactersStore.getState().importCharacters([{ ...orig, level: 270 }], 'overwrite');
    const s = useCharactersStore.getState();
    expect(Object.keys(s.characters)).toHaveLength(1);
    expect(s.characters[id]?.level).toBe(270);
  });

  it('removeCharacter: 選択中を消すと残りを選択', () => {
    const a = useCharactersStore.getState().addCharacter('A');
    const b = useCharactersStore.getState().addCharacter('B');
    useCharactersStore.getState().removeCharacter(b);
    expect(useCharactersStore.getState().activeId).toBe(a);
    useCharactersStore.getState().removeCharacter(a);
    expect(useCharactersStore.getState().activeId).toBeNull();
  });

  it('localStorage に { version: 1, activeId, characters } の形で(デバウンスして)保存する', () => {
    const id = useCharactersStore.getState().addCharacter('保存');
    charactersDebouncedStorage.flush();
    const raw = JSON.parse(readStorage(CHARACTERS_KEY) as string) as Record<string, unknown>;
    expect(raw.version).toBe(1);
    expect(raw.activeId).toBe(id);
    expect(Object.keys(raw.characters as object)).toEqual([id]);
    expect('state' in raw).toBe(false);
  });

  it('壊れた保存データは退避して初期状態で読み込む', async () => {
    charactersDebouncedStorage.flush(); // 保留中の書き込みを先に出す
    mem.setItem(CHARACTERS_KEY, '{"version":1,"characters":');
    await useCharactersStore.persist.rehydrate();
    expect(useCharactersStore.getState().characters).toEqual({});
    expect(backupKeys(CHARACTERS_KEY)).toHaveLength(1);
    expect(mem.getItem(CHARACTERS_KEY)).toBeNull();
    expect(consumeRecoveredKeys().map((r) => r.key)).toEqual([CHARACTERS_KEY]);
  });

  it('一部のキャラだけ壊れていれば、残りを読み込み元データをコピー退避する', () => {
    const good = emptyCharacter('good', 'OK');
    const r = parseCharactersFile({
      version: 1,
      activeId: 'bad',
      characters: { good, bad: { ...emptyCharacter('bad'), level: 'x' } },
    });
    expect(r?.partial).toBe(true);
    expect(Object.keys(r?.state.characters ?? {})).toEqual(['good']);
    expect(r?.state.activeId).toBe('good');
  });
});

describe('settings store', () => {
  it('initDefaults: 未保存なら既定値、保存済みなら重ねる', () => {
    useSettingsStore.getState().initDefaults(cubes);
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings(cubes));

    settingsDebouncedStorage.flush();
    mem.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, stepLimit: 50, bogus: true }));
    useSettingsStore.getState().initDefaults(cubes);
    const s = useSettingsStore.getState();
    expect(s.initialized).toBe(true);
    expect(s.settings?.stepLimit).toBe(50);

    s.update({ hideMaxed: false });
    s.resetKey('stepLimit');
    expect(useSettingsStore.getState().settings?.stepLimit).toBe(120);
    expect(useSettingsStore.getState().settings?.hideMaxed).toBe(false);
    useSettingsStore.getState().resetAll();
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings(cubes));
  });

  it('initDefaults: 壊れた保存値は退避する', () => {
    settingsDebouncedStorage.flush();
    mem.setItem(SETTINGS_KEY, 'oops');
    useSettingsStore.getState().initDefaults(cubes);
    expect(backupKeys(SETTINGS_KEY)).toHaveLength(1);
    expect(useSettingsStore.getState().settings).toEqual(defaultSettings(cubes));
  });
});
