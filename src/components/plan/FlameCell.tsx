import { memo } from 'react';
import ItemIcon from '../common/ItemIcon';
import { focusRing } from '../common/styles';
import { slotKind } from '../../domain/character';
import type { FlameRankRow, Quartile } from '../../domain/planTypes';
import { QUARTILE_STYLE, formatPct, quartileLabel } from './format';

export interface FlameCellProps {
  row: FlameRankRow;
  /** 1始まりの順位 */
  rank: number;
  quartile: Quartile;
  expanded: boolean;
  onOpen: (slot: string, el: HTMLButtonElement) => void;
}

/** 追加オプションの順番の1マス(56px)。装備アイコン + 改善確率 */
function FlameCell({ row, rank, quartile, expanded, onOpen }: FlameCellProps) {
  const pct = formatPct(row.pImprove * 100, 1);
  const label = `${rank}位 ${row.equipName} 改善確率 ${pct} 効率${quartileLabel(quartile)}`;
  return (
    <li>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        title={label}
        onClick={(e) => onOpen(row.slot, e.currentTarget)}
        className={`flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-md border-2 bg-surface2 hover:brightness-110 ${focusRing} ${
          QUARTILE_STYLE[quartile].border
        } ${expanded ? 'ring-2 ring-accent' : ''}`}
      >
        <ItemIcon itemId={row.itemId} kind={slotKind(row.slot)} size={32} />
        <span className="text-[11px] font-bold leading-none tabular-nums">{pct}</span>
      </button>
    </li>
  );
}

export default memo(FlameCell);
