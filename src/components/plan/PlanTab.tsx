import { useMemo, type ReactNode } from 'react';
import Button from '../common/Button';
import Collapsible from '../common/Collapsible';
import Skeleton from '../common/Skeleton';
import { SLOT_LABEL_JA } from '../../domain/character';
import type { PlanWarning } from '../../domain/planTypes';
import { selectActiveCharacter, useCharactersStore } from '../../store/characters';
import { useDataStore } from '../../store/data';
import { usePlanStore } from '../../store/plan';
import { useSettingsStore } from '../../store/settings';
import { useUiStore } from '../../store/ui';
import FlameGrid from './FlameGrid';
import IncludeToggles from './IncludeToggles';
import Legend from './Legend';
import MethodNotes from './MethodNotes';
import PlanGrid from './PlanGrid';

function SkeletonGrid({ count = 18 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2.5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-14 w-14" />
      ))}
    </div>
  );
}

function Card({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="min-w-0 space-y-2 rounded-lg border border-border bg-surface px-3 py-3"
    >
      <h2 id={id} className="text-base font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function WarningList({ warnings }: { warnings: PlanWarning[] }) {
  const setTab = useUiStore((s) => s.setTab);
  const setSelectedSlot = useUiStore((s) => s.setSelectedSlot);
  if (warnings.length === 0) return null;
  const go = (w?: PlanWarning) => {
    if (w?.slot) setSelectedSlot(w.slot);
    setTab('input');
  };
  return (
    <section
      aria-labelledby="plan-warnings-title"
      className="min-w-0 rounded-lg border border-effYellow/60 bg-effYellow/10 px-3 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-warnings-title" className="text-sm font-bold text-effYellow">
          入力の確認
        </h2>
        <Button size="sm" variant="ghost" onClick={() => go()}>
          キャラ・装備入力へ
        </Button>
      </div>
      <ul className="mt-1 space-y-0.5 text-sm">
        {warnings.map((w) => (
          <li key={w.message} className="flex flex-wrap items-baseline gap-x-2">
            <span className="min-w-0 break-words">
              {w.slot && <span className="text-muted">[{SLOT_LABEL_JA[w.slot]}] </span>}
              {w.message}
            </span>
            {w.slot && (
              <button
                type="button"
                onClick={() => go(w)}
                className="text-xs text-accent underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                この装備を直す
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 強化順序タブ。DESIGN.md §7.3 */
export default function PlanTab() {
  const status = usePlanStore((s) => s.status);
  const plan = usePlanStore((s) => s.plan);
  const flames = usePlanStore((s) => s.flames);
  const storeWarnings = usePlanStore((s) => s.warnings);
  const error = usePlanStore((s) => s.error);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const data = useDataStore((s) => s.data);
  const character = useCharactersStore(selectActiveCharacter);
  const setTab = useUiStore((s) => s.setTab);

  const warnings = useMemo(() => {
    const seen = new Set<string>();
    const out: PlanWarning[] = [];
    for (const w of [...(plan?.warnings ?? []), ...storeWarnings]) {
      if (seen.has(w.message)) continue;
      seen.add(w.message);
      out.push(w);
    }
    return out;
  }, [plan, storeWarnings]);

  const computing = status === 'computing';
  const includeNone = settings !== null && !Object.values(settings.include).some(Boolean);

  let planBody: ReactNode;
  if (!character) {
    planBody = (
      <p className="text-sm text-muted">
        キャラクターを作成して装備を入力すると、強化の順番がここに表示されます。
      </p>
    );
  } else if (status === 'error') {
    planBody = (
      <div className="space-y-2" role="alert">
        <p className="text-sm text-effRed">{error ?? '計算に失敗しました。'}</p>
        <Button size="sm" onClick={() => void usePlanStore.getState().recomputeNow(true)}>
          再計算
        </Button>
      </div>
    );
  } else if (plan) {
    planBody = (
      <div
        aria-busy={computing}
        className={`transition-opacity ${computing ? 'pointer-events-none opacity-50' : ''}`}
      >
        {plan.groups.length === 0 ? (
          <p className="text-sm text-muted">
            {includeNone
              ? '含める項目がすべてオフです。上のスイッチで選んでください。'
              : '戦闘力が上がる強化候補がありません。装備・ステータスの入力を確認してください。'}
          </p>
        ) : (
          <PlanGrid
            plan={plan}
            baseCP={character.displayedCP}
            stepLimit={settings?.stepLimit ?? 120}
          />
        )}
      </div>
    );
  } else if (computing) {
    planBody = (
      <div aria-busy="true">
        <p className="sr-only">計算中</p>
        <SkeletonGrid />
      </div>
    );
  } else {
    planBody = (
      <div className="space-y-2">
        <p className="text-sm text-muted">
          まだ計算結果がありません。装備を入力すると自動で計算します。
        </p>
        <Button size="sm" variant="ghost" onClick={() => setTab('input')}>
          キャラ・装備入力へ
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <IncludeToggles />

      <WarningList warnings={warnings} />

      <Card title="スペックアップの順番" id="plan-order-title">
        {computing && (
          <p className="text-xs text-muted" role="status">
            計算中…
          </p>
        )}
        {planBody}
        <Legend />
      </Card>

      {data && (
        <Collapsible id="plan-method" title="計算方法" defaultCollapsed>
          <MethodNotes data={data} settings={settings} jobId={character?.jobId ?? null} />
        </Collapsible>
      )}

      {character && status !== 'error' && (
        <Card title="追加オプションの順番" id="plan-flame-title">
          {!flames && computing ? (
            <SkeletonGrid count={10} />
          ) : (
            <FlameGrid
              flames={flames}
              dimmed={computing}
              flameMaster={data?.flame ?? null}
              flameBase={settings?.flameBase ?? null}
              onChangeBase={(flameBase) => updateSettings({ flameBase })}
            />
          )}
        </Card>
      )}
    </div>
  );
}
