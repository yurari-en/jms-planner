import { memo } from 'react';
import ItemIcon from '../common/ItemIcon';
import { focusRing } from '../common/styles';
import { slotKind } from '../../domain/character';
import type { PlanGroup, Quartile } from '../../domain/planTypes';
import { GRADE_TEXT_CLASS, QUARTILE_STYLE, groupAriaLabel } from './format';
import KindBadge from './KindBadge';

export interface PlanCellProps {
  group: PlanGroup;
  /** 次のマスの四分位(連結線の色)。最後のマスは null */
  nextQuartile: Quartile | null;
  expanded: boolean;
  onOpen: (id: string, el: HTMLButtonElement) => void;
}

/** スペックアップの順番の1マス(56px)。連結線は次のマスとの間に置く(折り返したら線はそこで終わる) */
function PlanCell({ group, nextQuartile, expanded, onOpen }: PlanCellProps) {
  const first = group.steps[0];
  const labelColor =
    first && first.kind !== 'starforce' ? GRADE_TEXT_CLASS[first.toGrade] : 'text-text';
  return (
    <li className="flex items-center">
      <button
        type="button"
        aria-label={groupAriaLabel(group)}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        title={groupAriaLabel(group)}
        onClick={(e) => onOpen(group.id, e.currentTarget)}
        className={`relative flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border-2 bg-surface2 hover:brightness-110 ${focusRing} ${
          QUARTILE_STYLE[group.quartile].border
        } ${expanded ? 'ring-2 ring-accent' : ''}`}
      >
        <ItemIcon itemId={group.itemId} kind={slotKind(group.slot)} size={32} />
        <span
          className={`max-w-full truncate px-0.5 text-[11px] font-bold leading-none tabular-nums ${labelColor}`}
        >
          {group.cellLabel}
        </span>
        <KindBadge kind={group.kind} className="absolute -right-1.5 -top-1.5" />
      </button>
      {nextQuartile !== null && (
        <span
          aria-hidden="true"
          className={`h-[3px] w-2 shrink-0 ${QUARTILE_STYLE[nextQuartile].bg}`}
        />
      )}
    </li>
  );
}

export default memo(PlanCell);
