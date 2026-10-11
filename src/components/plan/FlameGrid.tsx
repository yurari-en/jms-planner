import { useCallback, useRef, useState } from 'react';
import SelectField, { type SelectOption } from '../common/SelectField';
import type { FlameBase, FlameMaster } from '../../data/types';
import type { FlameRankResult } from '../../domain/planTypes';
import FlameCell from './FlameCell';
import FlamePopover from './FlamePopover';
import { quartileOfIndex } from './format';

export interface FlameGridProps {
  flames: FlameRankResult | null;
  /** 計算中(前の結果を薄く表示) */
  dimmed?: boolean;
  flameMaster: FlameMaster | null;
  flameBase: FlameBase | null;
  onChangeBase: (base: FlameBase) => void;
}

const FALLBACK_NAME: Record<FlameBase, string> = {
  powerful: '強力な転生の炎',
  eternal: '永遠の転生の炎',
  black: '黒い転生の炎',
};

function baseOptions(master: FlameMaster | null): SelectOption<FlameBase>[] {
  return (['powerful', 'eternal', 'black'] as const).map((b) => {
    const name = master?.flames[b]?.jms ?? FALLBACK_NAME[b];
    return { value: b, label: b === 'black' ? `${name}(JMS 入手未確認)` : name };
  });
}

/** 追加オプションの順番(炎1個あたりの期待上昇が高い順)。DESIGN.md §6.4.3 / §7.3 */
export default function FlameGrid({
  flames,
  dimmed = false,
  flameMaster,
  flameBase,
  onChangeBase,
}: FlameGridProps) {
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const onOpen = useCallback((slot: string, el: HTMLButtonElement) => {
    anchorRef.current = el;
    setOpenSlot((cur) => (cur === slot ? null : slot));
  }, []);
  const onClose = useCallback(() => setOpenSlot(null), []);

  const rows = flames?.rows ?? [];
  const openIndex = openSlot ? rows.findIndex((r) => r.slot === openSlot) : -1;
  const openRow = openIndex >= 0 ? (rows[openIndex] ?? null) : null;

  return (
    <div className="min-w-0 space-y-2">
      <SelectField<FlameBase>
        label="基準の炎"
        value={flameBase ?? 'eternal'}
        disabled={flameBase === null}
        onChange={onChangeBase}
        options={baseOptions(flameMaster)}
        className="max-w-xs"
      />
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          追加オプションを付けられる装備がありません(装備を入力すると表示されます)。
        </p>
      ) : (
        <div
          aria-busy={dimmed}
          className={`space-y-2 transition-opacity ${dimmed ? 'pointer-events-none opacity-50' : ''}`}
        >
          <p className="text-xs text-muted">
            炎1個あたりの期待戦闘力上昇が高い順。マスの数字は炎1個で今より良くなる確率です。
          </p>
          <ol aria-label="追加オプションの順番" className="flex min-w-0 flex-wrap gap-2.5 pt-1">
            {rows.map((r, i) => (
              <FlameCell
                key={r.slot}
                row={r}
                rank={i + 1}
                quartile={quartileOfIndex(i, rows.length)}
                expanded={openSlot === r.slot}
                onOpen={onOpen}
              />
            ))}
          </ol>
        </div>
      )}
      <FlamePopover
        key={openSlot ?? 'none'}
        row={openRow}
        rank={openIndex + 1}
        onClose={onClose}
        anchorRef={anchorRef}
      />
    </div>
  );
}
