import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { EquipSlotKind, ItemMaster } from '../../data/types';
import { useDataStore } from '../../store/data';
import ItemIcon from '../common/ItemIcon';
import { inputClass } from '../common/styles';

export interface ItemSearchComboboxProps {
  kind: EquipSlotKind;
  /** 部位名(ラベル用) */
  slotLabel: string;
  onSelect: (item: ItemMaster) => void;
}

const LIMIT = 30;

/** 部位で絞った装備マスタの検索(コンボボックス)。↑↓で移動、Enter で決定、Esc で閉じる */
export default function ItemSearchCombobox({ kind, slotLabel, onSelect }: ItemSearchComboboxProps) {
  const idx = useDataStore((s) => s.idx);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputId = useId();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(
    () => (idx && open ? idx.searchItems(kind, query, LIMIT) : []),
    [idx, kind, query, open],
  );
  const hasMaster = (idx?.itemsById.size ?? 0) > 0;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const choose = (item: ItemMaster | undefined) => {
    if (!item) return;
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  const move = (d: number) => {
    if (results.length === 0) return;
    const next = (active + d + results.length) % results.length;
    setActive(next);
    const el = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(next))}`);
    el?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActive(0);
        } else move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) move(-1);
        break;
      case 'Enter':
        if (open && results[active]) {
          e.preventDefault();
          choose(results[active]);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
        break;
    }
  };

  const expanded = open && results.length > 0;

  return (
    <div className="relative min-w-0">
      <label htmlFor={inputId} className="mb-1 block text-xs text-muted">
        アイテム検索({slotLabel})
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? optionId(active) : undefined}
        autoComplete="off"
        value={query}
        disabled={!hasMaster}
        placeholder={hasMaster ? '装備名で検索(ひらがな可)' : '装備マスタがありません'}
        className={inputClass}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {!hasMaster && (
        <p className="mt-1 text-xs text-muted">
          装備マスタ(items.json)が読み込まれていないため検索できません。「手入力」で入力してください。
        </p>
      )}
      <ul
        id={listId}
        ref={listRef}
        role="listbox"
        aria-label={`${slotLabel}の候補`}
        hidden={!expanded}
        className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-surface shadow-lg"
      >
        {expanded &&
          results.map((it, i) => (
            <li
              key={it.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // blur より先に選ぶ
              onMouseDown={(e) => {
                e.preventDefault();
                choose(it);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-w-0 cursor-pointer items-center gap-2 px-2 py-1.5 text-sm ${
                i === active ? 'bg-accent/15' : ''
              }`}
            >
              <ItemIcon itemId={it.id} kind={kind} alt="" size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{it.name}</span>
                <span className="block truncate text-[11px] text-muted">
                  Lv{it.lv}
                  {it.setName ? ` ・ ${it.setName}` : ''}
                </span>
              </span>
              {it.boss === 1 && (
                <span className="shrink-0 rounded border border-effRed/60 px-1 text-[10px] text-effRed">
                  ボス
                </span>
              )}
            </li>
          ))}
      </ul>
      {open && hasMaster && results.length === 0 && (
        <p className="mt-1 text-xs text-muted" role="status">
          該当する装備がありません。
        </p>
      )}
    </div>
  );
}
