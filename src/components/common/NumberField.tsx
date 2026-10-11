import { useEffect, useId, useState, type ReactNode } from 'react';
import { inputClass } from './styles';

export interface NumberFieldProps {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** 単位など(例: '%', 'メル') */
  suffix?: ReactNode;
  /** 整数のみ */
  integer?: boolean;
  disabled?: boolean;
  /** ラベルを視覚的に隠す(読み上げには残す) */
  hideLabel?: boolean;
  /** 入力チェックの警告(黄色) */
  warning?: string | null;
  help?: ReactNode;
  className?: string;
  id?: string;
}

/** 全角数字・カンマ・空白を取り除いて数値に。読めなければ null */
function parseLoose(text: string, integer: boolean): number | null {
  const t = text
    .normalize('NFKC')
    .replace(/[,\s]/g, '')
    .replace(/[ー−–—]/g, '-');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return integer ? Math.trunc(n) : n;
}

function clamp(n: number, min?: number, max?: number): number {
  let v = n;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

/** 数値入力。入力のたびに(読める値なら)範囲内に丸めて onChange する。フォーカスを外すと表示を整える */
export default function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  integer = false,
  disabled,
  hideLabel,
  warning,
  help,
  className = '',
  id,
}: NumberFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [text, setText] = useState(() => String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const warnId = warning ? `${inputId}-warn` : undefined;

  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={inputId}
        className={hideLabel ? 'sr-only' : 'mb-1 flex items-center gap-1 text-xs text-muted'}
      >
        {label}
        {help}
      </label>
      <div className="flex min-w-0 items-center gap-1">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          step={step}
          aria-invalid={warning ? true : undefined}
          aria-describedby={warnId}
          className={`${inputClass} text-right tabular-nums ${warning ? 'border-effYellow' : ''}`}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseLoose(e.target.value, integer);
            if (n !== null) {
              const c = clamp(n, min, max);
              if (c !== value) onChange(c);
            }
          }}
          onBlur={() => {
            setFocused(false);
            const n = parseLoose(text, integer);
            const c =
              n === null
                ? clamp(min !== undefined && min > 0 ? min : 0, min, max)
                : clamp(n, min, max);
            if (c !== value) onChange(c);
            setText(String(c));
          }}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            const d = (step ?? 1) * (e.key === 'ArrowUp' ? 1 : -1);
            const c = clamp(Number((value + d).toFixed(6)), min, max);
            onChange(c);
            setText(String(c));
          }}
        />
        {suffix !== undefined && <span className="shrink-0 text-xs text-muted">{suffix}</span>}
      </div>
      {warning && (
        <p id={warnId} className="mt-0.5 text-xs text-effYellow">
          {warning}
        </p>
      )}
    </div>
  );
}
