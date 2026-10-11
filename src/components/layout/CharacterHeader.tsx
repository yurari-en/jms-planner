import { useId, useRef, useState, type ChangeEvent } from 'react';
import type { CharacterInput } from '../../domain/character';
import { selectActiveCharacter, useCharactersStore } from '../../store/characters';
import { useDataStore } from '../../store/data';
import { buildExportFile, downloadJson, exportFilename, parseImportText } from '../../store/io';
import { useToastStore } from '../../store/toast';
import { useUiStore } from '../../store/ui';
import Button from '../common/Button';
import Popover from '../common/Popover';
import { focusRing, inputClass } from '../common/styles';
import ImportDialog from './ImportDialog';

/** 選択中のキャラの概要と、キャラの切替・追加・削除・JSON 書き出し/読み込み */
export default function CharacterHeader() {
  const active = useCharactersStore(selectActiveCharacter);
  const characters = useCharactersStore((s) => s.characters);
  const setActive = useCharactersStore((s) => s.setActive);
  const addCharacter = useCharactersStore((s) => s.addCharacter);
  const removeCharacter = useCharactersStore((s) => s.removeCharacter);
  const jobsById = useDataStore((s) => s.idx?.jobsById);
  const setTab = useUiStore((s) => s.setTab);
  const push = useToastStore((s) => s.push);

  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importList, setImportList] = useState<CharacterInput[] | null>(null);
  const selectId = useId();

  const list = Object.values(characters);
  const jobName = active ? (jobsById?.get(active.jobId)?.nameJa ?? active.jobId) : '';

  const exportOne = () => {
    setExportOpen(false);
    if (!active) return;
    downloadJson(exportFilename(active.name), buildExportFile([active]));
  };
  const exportAll = () => {
    setExportOpen(false);
    if (list.length === 0) return;
    downloadJson(exportFilename('全キャラ'), buildExportFile(list));
  };

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const all: CharacterInput[] = [];
    for (const f of files) {
      let text: string;
      try {
        text = await f.text();
      } catch {
        push(`${f.name}: ファイルを読めませんでした。`, 'error');
        continue;
      }
      const r = parseImportText(text);
      if (r.ok) all.push(...r.characters);
      else push(`${f.name}: ${r.error}`, 'error');
    }
    if (all.length > 0) setImportList(all);
  };

  const onDelete = () => {
    if (!active) return;
    const ok = window.confirm(
      `「${active.name}」を削除します。元に戻せません(必要なら先に JSON 書き出しをしてください)。よろしいですか?`,
    );
    if (ok) {
      removeCharacter(active.id);
      push(`「${active.name}」を削除しました。`, 'info');
    }
  };

  return (
    <section
      aria-label="キャラクター"
      className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          {active ? (
            <>
              <p className="truncate text-base font-bold">{active.name || '(名前なし)'}</p>
              <p className="flex flex-wrap gap-x-3 text-xs text-muted">
                <span>{jobName}</span>
                <span>Lv{active.level}</span>
                <span>
                  戦闘力{' '}
                  <span className="tabular-nums text-text">
                    {active.displayedCP.toLocaleString('ja-JP')}
                  </span>
                </span>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">キャラが選択されていません。</p>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {active && (
            <Button size="sm" variant="primary" onClick={() => setTab('input')}>
              編集
            </Button>
          )}
          {list.length > 0 && (
            <>
              <label htmlFor={selectId} className="sr-only">
                キャラ切替
              </label>
              <select
                id={selectId}
                value={active?.id ?? ''}
                onChange={(e) => setActive(e.target.value || null)}
                className={`${inputClass} w-auto max-w-[10rem] py-1 text-xs ${focusRing}`}
              >
                {!active && <option value="">選択してください</option>}
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || '(名前なし)'}
                  </option>
                ))}
              </select>
            </>
          )}
          <Button size="sm" onClick={() => addCharacter()}>
            追加
          </Button>
          {active && (
            <Button size="sm" variant="danger" onClick={onDelete}>
              削除
            </Button>
          )}
          <Button
            ref={exportRef}
            size="sm"
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            disabled={list.length === 0}
            onClick={() => setExportOpen((o) => !o)}
          >
            JSON書き出し
          </Button>
          <Popover
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            anchorRef={exportRef}
            align="end"
            role="menu"
            label="JSON書き出し"
          >
            <div className="flex min-w-[10rem] flex-col">
              <button
                type="button"
                role="menuitem"
                disabled={!active}
                onClick={exportOne}
                className={`rounded px-2 py-1.5 text-left hover:bg-surface2 disabled:opacity-50 ${focusRing}`}
              >
                このキャラ
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={exportAll}
                className={`rounded px-2 py-1.5 text-left hover:bg-surface2 ${focusRing}`}
              >
                全キャラ({list.length}件)
              </button>
            </div>
          </Popover>
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            JSON読み込み
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            multiple
            hidden
            onChange={(e) => void onFiles(e)}
          />
        </div>
      </div>
      <ImportDialog characters={importList} onClose={() => setImportList(null)} />
    </section>
  );
}
