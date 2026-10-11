import { useEffect, useId, useState, type ReactNode } from 'react';
import { inputClass } from '../common/styles';
import { parseOptionalNumber } from './inputHelpers';

export interface OptionalNumberFieldProps {
  label: ReactNode;
  /** undefined = 空欄 */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  integer?: boolean;
  /** 空欄のときの薄い表示(例: '自動') */
  placeholder?: string;
  suffix?: ReactNode;
  help?: ReactNode;
  warning?: string | null;
  disabled?: boolean;
  className?: string;
}

function clamp(n: number, min?: number, max?: number): number {
  let v = n;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

/** 空欄を許す数値入力(空欄 = 未設定 / 自動) */
export default function OptionalNumberField({
  label,
  value,
  onChange,
  min,
  max,
  integer,
  placeholder,
  suffix,
  help,
  warning,
  disabled,
  className = '',
}: OptionalNumberFieldProps) {
  const id = useId();
  const show = (v: number | undefined) => (v === undefined ? '' : String(v));
  const [text, setText] = useState(() => show(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value === undefined ? '' : String(value));
  }, [value, focused]);

  const read = (t: string): number | undefined | null => {
    const n = parseOptionalNumber(t);
    if (n === undefined || n === null) return n;
    return clamp(integer ? Math.trunc(n) : n, min, max);
  };
  const warnId = warning ? `${id}-warn` : undefined;

  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-1 flex items-center gap-1 text-xs text-muted">
        {label}
        {help}
      </label>
      <div className="flex min-w-0 items-center gap-1">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={warning ? true : undefined}
          aria-describedby={warnId}
          className={`${inputClass} text-right tabular-nums ${warning ? 'border-effYellow' : ''}`}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setText(e.target.value);
            const n = read(e.target.value);
            if (n !== null && n !== value) onChange(n);
          }}
          onBlur={() => {
            setFocused(false);
            const n = read(text);
            const v = n === null ? value : n;
            if (v !== value) onChange(v);
            setText(show(v));
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
