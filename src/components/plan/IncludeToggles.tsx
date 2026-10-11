import Button from '../common/Button';
import Toggle from '../common/Toggle';
import { useSettingsStore } from '../../store/settings';
import type { PlannerSettings } from '../../domain/settings';
import { KIND_LABEL_JA } from './format';

type IncludeKey = keyof PlannerSettings['include'];
const KEYS: IncludeKey[] = ['starforce', 'potential', 'additional'];

/** 含める項目(スターフォース / 潜在能力 / アディショナル)。DESIGN.md §7.3 */
export default function IncludeToggles() {
  const include = useSettingsStore((s) => s.settings?.include ?? null);
  const update = useSettingsStore((s) => s.update);
  const disabled = include === null;
  const setAll = (v: boolean) => update({ include: { starforce: v, potential: v, additional: v } });
  const allOn = include !== null && KEYS.every((k) => include[k]);
  const allOff = include !== null && KEYS.every((k) => !include[k]);

  return (
    <section
      aria-labelledby="plan-include-title"
      className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-include-title" className="text-sm font-bold">
          含める項目
        </h2>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || allOn}
            onClick={() => setAll(true)}
          >
            すべて選択
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || allOff}
            onClick={() => setAll(false)}
          >
            すべて解除
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {KEYS.map((k) => (
          <Toggle
            key={k}
            label={KIND_LABEL_JA[k]}
            checked={include?.[k] ?? false}
            disabled={disabled}
            onChange={(v) => {
              if (include) update({ include: { ...include, [k]: v } });
            }}
          />
        ))}
      </div>
    </section>
  );
}
