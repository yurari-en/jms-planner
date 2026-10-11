import Button from '../common/Button';
import NumberField from '../common/NumberField';

export interface StarStepperProps {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** 無効のときの理由 */
  note?: string | null;
  warning?: string | null;
}

/** ★の数値ステッパー(0〜最大★) */
export default function StarStepper({
  value,
  max,
  onChange,
  disabled,
  note,
  warning,
}: StarStepperProps) {
  // 上限を超えた保存値も表示できるよう、入力欄の上限は大きい方
  const upper = Math.max(max, value);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-end gap-1">
        <Button
          size="sm"
          aria-label="★を1つ減らす"
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, Math.min(value - 1, max)))}
          className="mb-0.5"
        >
          −
        </Button>
        <NumberField
          className="w-28"
          label={`★(現在 / 最大${max})`}
          value={value}
          min={0}
          max={upper}
          integer
          disabled={disabled}
          suffix={`/ ${max}`}
          onChange={(v) => onChange(Math.min(v, max))}
        />
        <Button
          size="sm"
          aria-label="★を1つ増やす"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="mb-0.5"
        >
          ＋
        </Button>
      </div>
      {warning && (
        <p role="note" className="mt-1 text-xs text-effYellow">
          ⚠ {warning}
        </p>
      )}
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}
