import { memo } from 'react';
import { SLOT_LABEL_JA, slotKind, type EquipSlot } from '../../domain/character';
import { useDataStore } from '../../store/data';
import { usePlanStore } from '../../store/plan';
import { useUiStore } from '../../store/ui';
import ItemIcon from '../common/ItemIcon';
import Stars from '../common/Stars';
import { focusRing } from '../common/styles';
import GradeBadge from './GradeBadge';
import { useActiveField } from './hooks';

/** 部位カード。押すとその部位を編集パネルで開く */
function EquipCard({ slot }: { slot: EquipSlot }) {
  const eq = useActiveField((c) => c.equips.find((e) => e.slot === slot));
  const item = useDataStore((s) =>
    eq?.itemId != null ? (s.idx?.itemsById.get(eq.itemId) ?? null) : null,
  );
  const warn = usePlanStore((s) =>
    s.warnings
      .filter((w) => w.slot === slot)
      .map((w) => w.message)
      .join('\n'),
  );
  const selected = useUiStore((s) => s.selectedSlot === slot);
  const setSelectedSlot = useUiStore((s) => s.setSelectedSlot);

  const kind = slotKind(slot);
  const label = SLOT_LABEL_JA[slot];
  const name = item?.name ?? eq?.custom?.name ?? '';
  const lv = item?.lv ?? eq?.custom?.lv;
  const hasItem = !!name;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => setSelectedSlot(slot)}
      className={`flex w-full min-w-0 items-start gap-2 rounded-md border p-2 text-left transition-colors ${focusRing} ${
        selected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface hover:border-accent/60 hover:bg-surface2'
      }`}
    >
      <ItemIcon itemId={item ? item.id : null} kind={kind} alt={name || label} size={32} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted">
          <span className="truncate">{label}</span>
          {warn && (
            <span className="shrink-0 text-effYellow" title={warn} role="img" aria-label={warn}>
              ⚠
            </span>
          )}
        </span>
        <span className={`truncate text-xs ${hasItem ? 'text-text' : 'text-muted'}`}>
          {hasItem ? name : '未設定'}
        </span>
        {hasItem && (
          <span className="flex min-w-0 flex-wrap items-center gap-1 text-[11px]">
            {lv !== undefined && <span className="text-muted tabular-nums">Lv{lv}</span>}
            {eq && eq.star > 0 && <Stars count={eq.star} />}
            {eq && <GradeBadge prefix="潜" grade={eq.potential.grade} />}
            {eq && <GradeBadge prefix="ア" grade={eq.additional.grade} />}
          </span>
        )}
      </span>
    </button>
  );
}

export default memo(EquipCard);
