import { selectActiveCharacter, useCharactersStore } from '../../store/characters';

/** キャラ・装備入力タブ(仮)。次の担当が置き換える */
export default function InputTab() {
  const active = useCharactersStore(selectActiveCharacter);
  return <p className="text-sm">{active ? active.name : 'キャラが選択されていません。'}</p>;
}
