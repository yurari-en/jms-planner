import { useState } from 'react';
import type { CharacterInput } from '../../domain/character';
import { useCharactersStore } from '../../store/characters';
import { useDataStore } from '../../store/data';
import { diffCharacters } from '../../store/io';
import { useToastStore } from '../../store/toast';
import Button from '../common/Button';
import Dialog from '../common/Dialog';
import { focusRing } from '../common/styles';

export interface ImportDialogProps {
  /** 読み込むキャラ(null で閉じる) */
  characters: CharacterInput[] | null;
  onClose: () => void;
}

type Mode = 'overwrite' | 'copy';

/** JSON 読み込みの確認: 差分(新規/変更項目)を見せて、上書き/別名で追加を選ぶ */
export default function ImportDialog({ characters, onClose }: ImportDialogProps) {
  return (
    <Dialog
      open={characters !== null}
      onClose={onClose}
      title="JSON の読み込み"
      widthClass="max-w-xl"
      footer={null}
    >
      {characters && (
        <ImportBody key={characters.map((c) => c.id).join()} list={characters} onClose={onClose} />
      )}
    </Dialog>
  );
}

function ImportBody({ list, onClose }: { list: CharacterInput[]; onClose: () => void }) {
  const existing = useCharactersStore((s) => s.characters);
  const importCharacters = useCharactersStore((s) => s.importCharacters);
  const setActive = useCharactersStore((s) => s.setActive);
  const jobsById = useDataStore((s) => s.idx?.jobsById);
  // 既定は上書き(新規のキャラは上書き=そのまま追加)
  const [modes, setModes] = useState<Mode[]>(() => list.map((): Mode => 'overwrite'));

  const doImport = () => {
    const over = list.filter((_, i) => modes[i] === 'overwrite');
    const copy = list.filter((_, i) => modes[i] === 'copy');
    const ids = [...importCharacters(over, 'overwrite'), ...importCharacters(copy, 'copy')];
    const first = ids[0];
    if (first) setActive(first);
    useToastStore.getState().push(`${ids.length}件のキャラを読み込みました。`, 'info');
    onClose();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        読み込むキャラを確認してください。同じキャラ(同じ
        ID)が既にある場合は「上書き」か「別名で追加」を選べます。
      </p>
      <ul className="space-y-2">
        {list.map((c, i) => {
          const d = diffCharacters(existing[c.id], c);
          const job = jobsById?.get(c.jobId)?.nameJa ?? c.jobId;
          const groupName = `import-mode-${i}`;
          return (
            <li key={`${c.id}-${i}`} className="min-w-0 rounded-md border border-border bg-bg p-3">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="min-w-0 truncate font-bold">{c.name || '(名前なし)'}</span>
                <span className="text-xs text-muted">
                  {job} / Lv{c.level} / 戦闘力 {c.displayedCP.toLocaleString('ja-JP')}
                </span>
                <span
                  className={`ml-auto rounded px-1.5 py-0.5 text-xs ${
                    d.isNew ? 'bg-effGreen/20 text-effGreen' : 'bg-effYellow/20 text-effYellow'
                  }`}
                >
                  {d.isNew ? '新規' : d.changed.length > 0 ? '変更あり' : '変更なし'}
                </span>
              </div>
              {!d.isNew && d.changed.length > 0 && (
                <p className="mt-1 break-words text-xs text-muted">
                  変わる項目: {d.changed.join(' / ')}
                </p>
              )}
              {!d.isNew && (
                <fieldset className="mt-2 flex flex-wrap gap-3 text-sm">
                  <legend className="sr-only">{c.name} の読み込み方法</legend>
                  {(
                    [
                      ['overwrite', '上書き'],
                      ['copy', '別名で追加'],
                    ] as const
                  ).map(([m, label]) => (
                    <label key={m} className="inline-flex cursor-pointer items-center gap-1">
                      <input
                        type="radio"
                        name={groupName}
                        value={m}
                        checked={modes[i] === m}
                        onChange={() => setModes((prev) => prev.map((x, j) => (j === i ? m : x)))}
                        className={`accent-accent ${focusRing}`}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" onClick={onClose}>
          キャンセル
        </Button>
        <Button variant="primary" onClick={doImport}>
          読み込む
        </Button>
      </div>
    </div>
  );
}
