import { useId, useMemo } from 'react';
import type { CubeTableKind, Part } from '../../data/types';
import type { PotGrade, PotState } from '../../domain/character';
import { resolvePotLines } from '../../domain/planner';
import { useDataStore } from '../../store/data';
import HelpTip from '../common/HelpTip';
import SelectField from '../common/SelectField';
import { inputClass } from '../common/styles';
import { GRADE_LABEL_JA, POT_GRADES, unknownLineIndexes, withPotLine } from './inputHelpers';

export interface PotentialEditorProps {
  title: string;
  /** 選択肢に使う確率表(潜在 = black、アディ = additional) */
  cube: CubeTableKind;
  state: PotState;
  part: Part;
  lv: number;
  onChange: (next: PotState) => void;
}

const UNKNOWN = '__unknown__';

/** 潜在/アディ: 等級 + 3行 */
export default function PotentialEditor({
  title,
  cube,
  state,
  part,
  lv,
  onChange,
}: PotentialEditorProps) {
  const idx = useDataStore((s) => s.idx);
  const baseId = useId();
  const grade = state.grade;

  const options = useMemo(
    () => (idx && grade !== 'none' ? idx.potentialOptionsFor(cube, grade, part, lv) : []),
    [idx, cube, grade, part, lv],
  );
  const table = useMemo(
    () => (idx && grade !== 'none' ? idx.cubeTable(cube, grade, part, lv) : null),
    [idx, cube, grade, part, lv],
  );
  const resolved = useMemo(() => (idx ? resolvePotLines(state, idx) : []), [idx, state]);
  const unknown = useMemo(
    () => (idx ? unknownLineIndexes(state, options, idx) : []),
    [idx, state, options],
  );
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o] as const)), [options]);

  const help =
    cube === 'additional'
      ? 'アディショナル潜在能力。選択肢は KMS エディショナルキューブの確率表(この部位・Lv・等級)に出るオプションです。'
      : '潜在能力。選択肢は KMS ブラックキューブの確率表(この部位・Lv・等級)に出るオプションです。レッド/ブラックの表は同じ選択肢なので、どのキューブで付けた行でもここから選べます。';

  return (
    <fieldset className="min-w-0 rounded-md border border-border p-2">
      <legend className="flex items-center gap-1 px-1 text-sm font-bold">
        {title}
        <HelpTip text={help} label={`${title}のヘルプ`} />
      </legend>
      <div className="min-w-0 space-y-2">
        <SelectField<PotGrade>
          label={`${title}の等級`}
          value={grade}
          options={POT_GRADES.map((g) => ({ value: g, label: GRADE_LABEL_JA[g] }))}
          onChange={(g) => onChange({ ...state, grade: g })}
        />
        {grade !== 'none' && options.length === 0 && (
          <p className="text-xs text-effYellow">
            この部位・Lv・等級の確率表がありません(装備を選ぶと選択肢が出ます)。
          </p>
        )}
        {table && (table.fallbackCube || table.fallbackPart) && (
          <p className="text-xs text-effYellow">⚠ 確率表を代用中</p>
        )}
        {[0, 1, 2].map((i) => {
          const savedId = state.lines[i] ?? null;
          const r = resolved[i] ?? null;
          const isUnknown = unknown.includes(i);
          const value = savedId == null ? '' : isUnknown ? UNKNOWN : String(r?.id ?? savedId);
          const selId = `${baseId}-line-${i}`;
          return (
            <div key={i} className="min-w-0">
              <label htmlFor={selId} className="sr-only">
                {title} {i + 1}行目
              </label>
              <div className="flex min-w-0 items-center gap-1">
                <span aria-hidden="true" className="w-4 shrink-0 text-xs text-muted">
                  {i + 1}
                </span>
                <select
                  id={selId}
                  value={value}
                  disabled={grade === 'none'}
                  aria-invalid={isUnknown || undefined}
                  className={`${inputClass} truncate ${isUnknown ? 'border-effYellow' : ''}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === UNKNOWN) return;
                    const opt = v === '' ? null : (byId.get(Number(v)) ?? null);
                    onChange(withPotLine(state, i, opt));
                  }}
                >
                  <option value="">なし／その他</option>
                  {isUnknown && <option value={UNKNOWN}>(不明な行)</option>}
                  {options.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.ja}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
        {unknown.length > 0 && (
          <p className="text-xs text-effYellow" role="note">
            ⚠ {unknown.map((i) => `${i + 1}行目`).join('・')}
            が確率表にありません(等級・装備の変更や表の更新のため)。選び直してください。
          </p>
        )}
      </div>
    </fieldset>
  );
}
