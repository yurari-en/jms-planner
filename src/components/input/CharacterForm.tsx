import { useId, useMemo } from 'react';
import { useDataStore } from '../../store/data';
import HelpTip from '../common/HelpTip';
import NumberField from '../common/NumberField';
import SelectField, { type SelectGroup } from '../common/SelectField';
import { inputClass } from '../common/styles';
import { useActiveField, useUpdateActive } from './hooks';

/** 基本情報: キャラ名・職業・Lv・表示戦闘力 */
export default function CharacterForm() {
  const name = useActiveField((c) => c.name) ?? '';
  const jobId = useActiveField((c) => c.jobId) ?? '';
  const level = useActiveField((c) => c.level) ?? 1;
  const cp = useActiveField((c) => c.displayedCP) ?? 0;
  const jobs = useDataStore((s) => s.data?.jobs.jobs);
  const update = useUpdateActive();
  const nameId = useId();

  const groups = useMemo(() => {
    const map = new Map<string, SelectGroup<string>>();
    for (const j of jobs ?? []) {
      let g = map.get(j.branch);
      if (!g) map.set(j.branch, (g = { label: j.branch, options: [] }));
      g.options.push({ value: j.id, label: j.nameJa });
    }
    const out = [...map.values()];
    if (jobId && !(jobs ?? []).some((j) => j.id === jobId)) {
      out.unshift({ label: '不明', options: [{ value: jobId, label: `(不明な職業: ${jobId})` }] });
    }
    return out;
  }, [jobs, jobId]);

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <label htmlFor={nameId} className="mb-1 block text-xs text-muted">
          キャラ名
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          maxLength={40}
          autoComplete="off"
          className={inputClass}
          onChange={(e) => {
            const v = e.target.value;
            update((c) => ({ ...c, name: v }));
          }}
        />
      </div>
      <SelectField
        className="col-span-2 sm:col-span-1"
        label="職業"
        value={jobId}
        groups={groups}
        onChange={(v) => update((c) => ({ ...c, jobId: v }))}
      />
      <NumberField
        label="Lv"
        value={level}
        min={1}
        max={300}
        integer
        onChange={(v) => update((c) => ({ ...c, level: v }))}
      />
      <NumberField
        label="表示戦闘力"
        value={cp}
        min={0}
        integer
        help={
          <HelpTip text="ステータス画面の戦闘力をそのまま入力します。上昇量の推定の基準になります。" />
        }
        warning={cp > 0 ? null : '未入力です(戦闘力の上昇量を計算できません)'}
        onChange={(v) => update((c) => ({ ...c, displayedCP: v }))}
      />
    </div>
  );
}
