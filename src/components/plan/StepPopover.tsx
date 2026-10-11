import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import Button from '../common/Button';
import Popover from '../common/Popover';
import Stars from '../common/Stars';
import { focusRing } from '../common/styles';
import { SLOT_LABEL_JA } from '../../domain/character';
import type { PlanGroup, PotStep, SfStep } from '../../domain/planTypes';
import AssumptionList from './AssumptionList';
import {
  GRADE_BORDER_CLASS,
  GRADE_LABEL_JA,
  GRADE_TEXT_CLASS,
  QUARTILE_STYLE,
  formatCount,
  formatEfficiency,
  formatGain,
  formatMel,
  formatPct,
  formatProb,
  quartileLabel,
  uniqueStrings,
} from './format';
import KindBadge from './KindBadge';

export interface StepPopoverProps {
  group: PlanGroup | null;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement>;
  /** 「この装備の全候補を見る」。候補が無ければ undefined */
  onShowCandidates?: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right tabular-nums">{children}</dd>
    </>
  );
}

function SfBreakdown({ steps }: { steps: SfStep[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs tabular-nums">
        <caption className="pb-0.5 text-left font-bold">段階ごとの内訳</caption>
        <thead>
          <tr className="border-b border-border text-muted">
            <th scope="col" className="py-0.5 pr-2 text-left font-medium">
              段階
            </th>
            <th scope="col" className="py-0.5 pr-2 text-right font-medium">
              順位
            </th>
            <th scope="col" className="py-0.5 pr-2 text-right font-medium">
              コスト
            </th>
            <th scope="col" className="py-0.5 pr-2 text-right font-medium">
              戦闘力
            </th>
            <th scope="col" className="py-0.5 text-right font-medium">
              破壊
            </th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.id} className="border-b border-border/50">
              <th scope="row" className="py-0.5 pr-2 text-left font-normal">
                ★{s.from}→{s.to}
              </th>
              <td className="py-0.5 pr-2 text-right">
                <span className={QUARTILE_STYLE[s.quartile].text}>{s.rank}位</span>
              </td>
              <td className="py-0.5 pr-2 text-right">{formatMel(s.cost)}</td>
              <td className="py-0.5 pr-2 text-right">{formatGain(s.gain)}</td>
              <td className="py-0.5 text-right">{formatCount(s.destroys, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PotDetails({ step }: { step: PotStep }) {
  return (
    <>
      <Row label="キューブ">{step.cubeName}</Row>
      <Row label="平均個数">
        平均 {formatCount(step.expectedCubes)} 個
        {step.cubesToGrade > 0 && (
          <span className="block text-xs text-muted">
            (うち等級上昇 {formatCount(step.cubesToGrade)} 個)
          </span>
        )}
      </Row>
      <Row label="1回で揃う確率">{formatProb(step.prob)}</Row>
    </>
  );
}

interface ContentsProps {
  group: PlanGroup;
  onClose: () => void;
  onShowCandidates?: () => void;
}

function Contents({ group, onShowCandidates, onClose }: ContentsProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Popover は位置が決まるまで非表示なので、1フレーム待ってからフォーカスを移す
    const id = requestAnimationFrame(() => closeRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const steps = group.steps;
  const first = steps[0];
  const last = steps[steps.length - 1];
  if (!first || !last) return null;
  const sfSteps = steps.filter((s): s is SfStep => s.kind === 'starforce');
  const pot = first.kind !== 'starforce' ? first : null;
  const gainPct = first.cpBefore > 0 ? ((last.cpAfter - first.cpBefore) / first.cpBefore) * 100 : 0;
  const assumptions = uniqueStrings(steps.flatMap((s) => s.assumptions));
  const rankText = last.rank !== first.rank ? `${first.rank}〜${last.rank}位` : `${first.rank}位`;
  const destroys = sfSteps.reduce((a, s) => a + s.destroys, 0);

  return (
    <div className="w-[min(22rem,calc(100vw-2rem))] space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words font-bold">{group.equipName}</p>
          <p className="text-xs text-muted">{SLOT_LABEL_JA[group.slot]}</p>
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

      {pot ? (
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-1 text-sm">
            <KindBadge kind={pot.kind} />
            <span>{pot.kind === 'potential' ? '潜在能力' : 'アディショナル'}</span>
            <span
              className={`rounded border px-1 text-xs ${GRADE_BORDER_CLASS[pot.toGrade]} ${GRADE_TEXT_CLASS[pot.toGrade]}`}
            >
              {GRADE_LABEL_JA[pot.toGrade]}
            </span>
          </p>
          <p className="break-words text-sm font-bold">{pot.targetLabel}</p>
          {pot.fromGrade !== pot.toGrade && (
            <p className="text-xs text-muted">
              等級: {GRADE_LABEL_JA[pot.fromGrade]} → {GRADE_LABEL_JA[pot.toGrade]}
            </p>
          )}
          {pot.newLineLabels.length > 0 && (
            <ul
              aria-label="目標の行"
              className="rounded border border-border bg-surface2 px-2 py-1 text-xs"
            >
              {pot.newLineLabels.map((l, i) => (
                <li key={`${l}:${i}`} className={GRADE_TEXT_CLASS[pot.toGrade]}>
                  {l}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm">
          スターフォース <Stars count={group.from ?? 0} to={group.to} className="font-bold" />
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <Row label="期待コスト">{formatMel(group.totalCost)}</Row>
        {!pot && <Row label="期待破壊回数">{formatCount(destroys, 2)}回</Row>}
        <Row label="戦闘力">
          {formatGain(group.totalGain)}{' '}
          <span className="text-xs text-muted">(+{formatPct(gainPct, 2)})</span>
        </Row>
        <Row label="効率">{formatEfficiency(group.efficiency)}</Row>
        <Row label="順位">
          {rankText}{' '}
          <span className={`text-xs ${QUARTILE_STYLE[group.quartile].text}`}>
            効率{quartileLabel(group.quartile)}
          </span>
        </Row>
        {pot && <PotDetails step={pot} />}
      </dl>

      {sfSteps.length > 1 && <SfBreakdown steps={sfSteps} />}

      {assumptions.length > 0 && (
        <div>
          <p className="mb-0.5 text-xs font-bold">前提</p>
          <AssumptionList items={assumptions} />
        </div>
      )}

      {onShowCandidates && (
        <Button size="sm" className="w-full" onClick={onShowCandidates}>
          この装備の全候補を見る
        </Button>
      )}
    </div>
  );
}

/** スペックアップの順番の1マスの詳細。DESIGN.md §6.5.3 */
export default function StepPopover({
  group,
  onClose,
  anchorRef,
  onShowCandidates,
}: StepPopoverProps) {
  if (!group) return null;
  return (
    <Popover open onClose={onClose} anchorRef={anchorRef} label={`${group.equipName} の詳細`}>
      <Contents
        group={group}
        onClose={() => {
          onClose();
          anchorRef.current?.focus();
        }}
        onShowCandidates={onShowCandidates}
      />
    </Popover>
  );
}
