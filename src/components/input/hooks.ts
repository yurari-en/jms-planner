// 入力画面用の小さなフック。ストアから必要な部分だけを選んで再描画を抑える。
import { useCallback } from 'react';
import type { CharacterInput, EquipInput, EquipSlot } from '../../domain/character';
import { useCharactersStore } from '../../store/characters';
import { useDataStore } from '../../store/data';
import { replaceEquip, syncPctAfterEquipChange } from './inputHelpers';

/** 選択中キャラの一部を選ぶ(選択中キャラが無ければ undefined)。selector は参照が安定な値を返すこと */
export function useActiveField<T>(selector: (c: CharacterInput) => T): T | undefined {
  return useCharactersStore((s) => {
    const ch = s.activeId !== null ? s.characters[s.activeId] : undefined;
    return ch ? selector(ch) : undefined;
  });
}

/** 選択中キャラの更新 */
export function useUpdateActive(): (updater: (c: CharacterInput) => CharacterInput | void) => void {
  return useCallback((updater) => {
    const st = useCharactersStore.getState();
    if (st.activeId === null) return;
    st.updateCharacter(st.activeId, updater);
  }, []);
}

/** 選択中キャラの1装備の更新。潜在・炎の変更で「装備から自動集計」が変わったら %合計 も追従させる */
export function useEquipWriter(
  slot: EquipSlot | null,
): (updater: (e: EquipInput) => EquipInput | void) => void {
  return useCallback(
    (updater) => {
      if (!slot) return;
      const st = useCharactersStore.getState();
      if (st.activeId === null) return;
      const idx = useDataStore.getState().idx;
      st.updateCharacter(st.activeId, (c) => {
        const next = replaceEquip(c, slot, updater);
        if (next === c) return undefined;
        return idx ? syncPctAfterEquipChange(c, next, idx) : next;
      });
    },
    [slot],
  );
}
