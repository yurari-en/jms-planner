import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import Popover from '../common/Popover';
import { focusRing } from '../common/styles';
import { SLOT_LABEL_JA } from '../../domain/character';
import type { FlameRankRow } from '../../domain/planTypes';
import AssumptionList from './AssumptionList';
import { formatCP, formatCount, formatGain, formatPct } from './format';

export interface FlamePopoverProps {
  row: FlameRankRow | null;
  rank: number;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right tabular-nums">{children}</dd>
    </>
  );
}

/** 戦闘力換算の値を小数1桁で(+付き) */
function plus1(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n >= 100 ? formatGain(n) : `+${formatCount(n, 1)}`;
}

function Contents({
  row,
  rank,
  onClose,
}: {
  row: FlameRankRow;
  rank: number;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => closeRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  const improves = row.pImprove > 0 && Number.isFinite(row.expectedFlames);
  return (
    <div className="w-[min(20rem,calc(100vw-2rem))] space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words font-bold">{row.equipName}</p>
          <p className="text-xs text-muted">
            {SLOT_LABEL_JA[row.slot]} / Lv{row.lv} / {row.boss ? 'ボス報酬装備' : '非ボス装備'} /{' '}
            {rank}位
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className={`shrink-0 rounded px-2 py-0.5 text-muted hover:text-text ${focusRing}`}
        >
          ×
        </button>
      </div>
      <p className="text-sm font-bold">
        {improves ? `平均 ${formatCount(row.expectedFlames, 1)} 個で改善` : '改善しません'}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <Row label="改善確率">{formatPct(row.pImprove * 100, 1)}</Row>
        <Row label="改善時の平均上昇">{improves ? plus1(row.gainIfImprove) : '—'}</Row>
        <Row label="炎1個あたりの期待上昇">{plus1(row.expectedGain)}</Row>
        <Row label="現在の炎スコア(主ステ換算)">{formatCount(row.curScoreMainStat, 1)}</Row>
        <Row label="1回の平均スコア">
          {row.mean >= 100 ? formatCP(row.mean) : formatCount(row.mean, 1)}
        </Row>
      </dl>
      <p className="text-xs text-muted">上昇・スコアは戦闘力換算の推定値です。</p>
      {row.assumptions.length > 0 && (
        <div>
          <p className="mb-0.5 text-xs font-bold">前提</p>
          <AssumptionList items={row.assumptions} />
        </div>
      )}
    </div>
  );
}

/** 追加オプションの順番の1マスの詳細。DESIGN.md §6.4.3 item 4 */
export default function FlamePopover({ row, rank, onClose, anchorRef }: FlamePopoverProps) {
  if (!row) return null;
  return (
    <Popover
      open
      onClose={onClose}
      anchorRef={anchorRef}
      label={`${row.equipName} の追加オプション`}
    >
      <Contents
        row={row}
        rank={rank}
        onClose={() => {
          onClose();
          anchorRef.current?.focus();
        }}
      />
    </Popover>
  );
}
