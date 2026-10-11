import { useCallback, useMemo, useRef, useState } from 'react';
import Button from '../common/Button';
import Dialog from '../common/Dialog';
import { SLOT_LABEL_JA, type EquipSlot } from '../../domain/character';
import type { PlanGroup, PlanResult } from '../../domain/planTypes';
import CandidateTable from './CandidateTable';
import { formatCP, formatMel, formatPct } from './format';
import PlanCell from './PlanCell';
import StepPopover from './StepPopover';

export const INITIAL_VISIBLE = 60;

export interface PlanGridProps {
  plan: PlanResult;
  /** 入力の表示戦闘力(推定戦闘力の起点) */
  baseCP: number;
  stepLimit: number;
}

/** スペックアップの順番(アイコングリッド)。DESIGN.md §6.5.2 / §7.3 */
export default function PlanGrid({ plan, baseCP, stepLimit }: PlanGridProps) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [candidateSlot, setCandidateSlot] = useState<EquipSlot | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  const groups = plan.groups;
  const shown = groups.slice(0, visible);
  const rest = groups.length - shown.length;

  const onOpen = useCallback((id: string, el: HTMLButtonElement) => {
    anchorRef.current = el;
    setOpenId((cur) => (cur === id ? null : id));
  }, []);
  const onClose = useCallback(() => setOpenId(null), []);

  const openGroup: PlanGroup | null = useMemo(
    () => (openId ? (groups.find((g) => g.id === openId) ?? null) : null),
    [groups, openId],
  );

  const totalCost = useMemo(() => plan.steps.reduce((a, s) => a + s.cost, 0), [plan.steps]);
  const startCP = plan.steps[0]?.cpBefore ?? baseCP;
  const gainPct = startCP > 0 ? ((plan.finalCP - startCP) / startCP) * 100 : 0;

  const candidates = openGroup ? plan.candidatesBySlot[openGroup.slot] : undefined;
  const showCandidates =
    openGroup && candidates && candidates.length > 0
      ? () => {
          // 先にマスへフォーカスを戻しておくと、ダイアログを閉じたときにマスへ戻る
          anchorRef.current?.focus();
          setCandidateSlot(openGroup.slot);
          setOpenId(null);
        }
      : undefined;

  const dialogRows = candidateSlot ? (plan.candidatesBySlot[candidateSlot] ?? []) : [];
  const dialogName = candidateSlot
    ? (groups.find((g) => g.slot === candidateSlot)?.equipName ?? SLOT_LABEL_JA[candidateSlot])
    : '';

  return (
    <div className="min-w-0 space-y-2">
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums">
        <span>ステップ数 {plan.steps.length.toLocaleString('ja-JP')}</span>
        <span>期待コスト合計 {formatMel(totalCost)}</span>
        <span>
          推定戦闘力 {formatCP(startCP)} → {formatCP(plan.finalCP)}{' '}
          <span className="text-effGreen">(+{formatPct(gainPct, 1)})</span>
        </span>
        <span className="text-xs text-muted">計算 {Math.round(plan.computeMs)}ms</span>
      </p>
      {plan.truncated && (
        <p className="text-xs text-effYellow">
          上限 ({stepLimit}) で打ち切り。設定の「ステップ数の上限」で増やせます。
        </p>
      )}

      <ol aria-label="スペックアップの順番" className="flex min-w-0 flex-wrap gap-y-2.5 pt-1.5">
        {shown.map((g, i) => {
          const next = shown[i + 1];
          return (
            <PlanCell
              key={g.id}
              group={g}
              nextQuartile={next ? next.quartile : null}
              expanded={openId === g.id}
              onOpen={onOpen}
            />
          );
        })}
      </ol>

      {rest > 0 && (
        <div className="flex flex-wrap gap-2">
          {visible === INITIAL_VISIBLE ? (
            <Button
              size="sm"
              onClick={() => setVisible((v) => v + INITIAL_VISIBLE)}
            >{`もっと見る(+${Math.min(rest, INITIAL_VISIBLE)})`}</Button>
          ) : (
            <Button size="sm" onClick={() => setVisible(groups.length)}>
              {`すべて表示(+${rest})`}
            </Button>
          )}
        </div>
      )}

      <StepPopover
        key={openGroup?.id ?? 'none'}
        group={openGroup}
        onClose={onClose}
        anchorRef={anchorRef}
        onShowCandidates={showCandidates}
      />

      <Dialog
        open={candidateSlot !== null}
        onClose={() => setCandidateSlot(null)}
        title={`${dialogName} の全候補`}
        widthClass="max-w-3xl"
      >
        <CandidateTable rows={dialogRows} />
      </Dialog>
    </div>
  );
}
