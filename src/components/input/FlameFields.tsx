import type { FlameState } from '../../domain/character';
import HelpTip from '../common/HelpTip';
import NumberField from '../common/NumberField';

export interface FlameFieldsProps {
  flame: FlameState;
  onChange: (next: FlameState) => void;
  /** デーモンアヴェンジャーのみ 最大HP 欄を出す */
  showHp: boolean;
}

const FIELDS: { key: keyof FlameState; label: string; pct?: boolean }[] = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'int', label: 'INT' },
  { key: 'luk', label: 'LUK' },
  { key: 'att', label: '攻撃力' },
  { key: 'matt', label: '魔力' },
  { key: 'allStatPct', label: '全ステ%', pct: true },
  { key: 'bossPct', label: 'ボス%', pct: true },
  { key: 'dmgPct', label: 'ダメージ%', pct: true },
];

/** 追加オプション(炎)の現在値 */
export default function FlameFields({ flame, onChange, showHp }: FlameFieldsProps) {
  const fields = showHp ? [...FIELDS, { key: 'hp' as const, label: '最大HP' }] : FIELDS;
  return (
    <fieldset className="min-w-0 rounded-md border border-border p-2">
      <legend className="flex items-center gap-1 px-1 text-sm font-bold">
        追加オプション
        <HelpTip
          text="装備ツールチップの追加オプション(緑の数値)だけを入力します。2種類のステータスが上がる行(例: STR・DEX +30)はそれぞれの欄に入れてください。"
          label="追加オプションのヘルプ"
        />
      </legend>
      <div className="grid min-w-0 grid-cols-3 gap-2">
        {fields.map((f) => (
          <NumberField
            key={f.key}
            label={f.label}
            value={flame[f.key]}
            min={0}
            max={f.key === 'hp' ? 100000 : 1000}
            integer
            suffix={'pct' in f && f.pct ? '%' : undefined}
            onChange={(v) => onChange({ ...flame, [f.key]: v })}
          />
        ))}
      </div>
    </fieldset>
  );
}
