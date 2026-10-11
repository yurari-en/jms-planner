// キャラクターの保存(localStorage `jmsplanner:v1:characters`)。DESIGN.md §4.2 / §5.1。
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  emptyCharacter,
  type CharacterInput,
  type EquipInput,
  type EquipSlot,
} from '../domain/character';
import { createDebouncedStorage, createFlatPersistStorage } from './persist';
import { charactersStateSchema, generateId, isRecord, migrateCharacter } from './schemas';

export const CHARACTERS_KEY = 'jmsplanner:v1:characters';

export interface CharactersData {
  activeId: string | null;
  characters: Record<string, CharacterInput>;
}

export interface CharactersActions {
  /** 空のキャラを作って選択する。戻り値は新しい id */
  addCharacter: (name?: string) => string;
  removeCharacter: (id: string) => void;
  setActive: (id: string | null) => void;
  /** updater は新しい値を返すか、undefined を返す(その場合は変更なし)。updatedAt を更新する */
  updateCharacter: (id: string, updater: (c: CharacterInput) => CharacterInput | void) => void;
  updateEquip: (id: string, slot: EquipSlot, updater: (e: EquipInput) => EquipInput | void) => void;
  /** 同じ id のキャラを丸ごと置き換える(無ければ追加) */
  replaceCharacter: (ch: CharacterInput) => void;
  /**
   * overwrite: 同じ id は上書き、無ければ追加。copy: 新しい id + 名前に ' (コピー)'。
   * 選択中のキャラが無ければ最後に読み込んだキャラを選択する。戻り値は保存した id。
   */
  importCharacters: (list: CharacterInput[], mode: 'overwrite' | 'copy') => string[];
}

export type CharactersState = CharactersData & CharactersActions;

export const charactersDebouncedStorage = createDebouncedStorage(300);

const nowIso = () => new Date().toISOString();

/** 保存データの検証。トップレベルが壊れていれば null(退避)。一部のキャラだけ壊れていれば partial(コピー退避) */
export function parseCharactersFile(
  json: unknown,
): { state: CharactersData; partial?: boolean } | null {
  if (!isRecord(json) || json.version !== 1 || !isRecord(json.characters)) return null;
  const characters: Record<string, CharacterInput> = {};
  let partial = false;
  for (const [key, raw] of Object.entries(json.characters)) {
    const ch = migrateCharacter(raw);
    if (!ch) {
      partial = true;
      continue;
    }
    if (ch.id !== key) partial = true;
    characters[ch.id] = ch;
  }
  let activeId = typeof json.activeId === 'string' ? json.activeId : null;
  if (activeId !== null && !characters[activeId]) activeId = Object.keys(characters)[0] ?? null;
  const state = { activeId, characters };
  const check = charactersStateSchema.safeParse({ version: 1, ...state });
  if (!check.success) return null;
  return partial ? { state, partial } : { state };
}

export const useCharactersStore = create<CharactersState>()(
  persist(
    (set, get) => ({
      activeId: null,
      characters: {},

      addCharacter: (name) => {
        const id = generateId();
        const ch = { ...emptyCharacter(id, name), updatedAt: nowIso() };
        set((s) => ({ characters: { ...s.characters, [id]: ch }, activeId: id }));
        return id;
      },

      removeCharacter: (id) => {
        set((s) => {
          if (!s.characters[id]) return s;
          const characters = { ...s.characters };
          delete characters[id];
          const activeId = s.activeId === id ? (Object.keys(characters)[0] ?? null) : s.activeId;
          return { characters, activeId };
        });
      },

      setActive: (id) => {
        if (id !== null && !get().characters[id]) return;
        set({ activeId: id });
      },

      updateCharacter: (id, updater) => {
        set((s) => {
          const cur = s.characters[id];
          if (!cur) return s;
          const next = updater(cur);
          if (!next || next === cur) return s;
          return {
            characters: { ...s.characters, [id]: { ...next, id, updatedAt: nowIso() } },
          };
        });
      },

      updateEquip: (id, slot, updater) => {
        get().updateCharacter(id, (c) => {
          const idx = c.equips.findIndex((e) => e.slot === slot);
          const cur = c.equips[idx];
          if (!cur) return undefined;
          const next = updater(cur);
          if (!next || next === cur) return undefined;
          const equips = c.equips.slice();
          equips[idx] = { ...next, slot };
          return { ...c, equips };
        });
      },

      replaceCharacter: (ch) => {
        set((s) => ({ characters: { ...s.characters, [ch.id]: ch } }));
      },

      importCharacters: (list, mode) => {
        const ids: string[] = [];
        set((s) => {
          const characters = { ...s.characters };
          for (const src of list) {
            const ch =
              mode === 'copy'
                ? { ...src, id: generateId(), name: `${src.name} (コピー)`, updatedAt: nowIso() }
                : src;
            characters[ch.id] = ch;
            ids.push(ch.id);
          }
          const last = ids[ids.length - 1];
          const activeId =
            s.activeId !== null && characters[s.activeId] ? s.activeId : (last ?? null);
          return { characters, activeId };
        });
        return ids;
      },
    }),
    {
      name: CHARACTERS_KEY,
      version: 1,
      storage: createFlatPersistStorage<CharactersData>(
        charactersDebouncedStorage,
        parseCharactersFile,
      ),
      partialize: (s) => ({ activeId: s.activeId, characters: s.characters }),
      merge: (persisted, current) => {
        // storage.getItem で検証済み。念のためもう一度確認してから重ねる
        const r = parseCharactersFile({ version: 1, ...(persisted as object) });
        return r ? { ...current, ...r.state } : current;
      },
    },
  ),
);

/** 選択中のキャラ(無ければ null) */
export function selectActiveCharacter(s: CharactersData): CharacterInput | null {
  return s.activeId !== null ? (s.characters[s.activeId] ?? null) : null;
}

/** キャラ一覧(名前順ではなく保存順) */
export function selectCharacterList(s: CharactersData): CharacterInput[] {
  return Object.values(s.characters);
}
