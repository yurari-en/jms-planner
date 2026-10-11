import { useId, type ReactNode } from 'react';
import { inputClass } from './styles';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SelectGroup<V extends string> {
  label: string;
  options: SelectOption<V>[];
}

export interface SelectFieldProps<V extends string> {
  label: ReactNode;
  value: V;
  onChange: (value: V) => void;
  options?: SelectOption<V>[];
  /** optgroup で分ける場合 */
  groups?: SelectGroup<V>[];
  disabled?: boolean;
  hideLabel?: boolean;
  help?: ReactNode;
  className?: string;
  id?: string;
}

export default function SelectField<V extends string>({
  label,
  value,
  onChange,
  options,
  groups,
  disabled,
  hideLabel,
  help,
  className = '',
  id,
}: SelectFieldProps<V>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const renderOption = (o: SelectOption<V>) => (
    <option key={o.value} value={o.value} disabled={o.disabled}>
      {o.label}
    </option>
  );
  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={selectId}
        className={hideLabel ? 'sr-only' : 'mb-1 flex items-center gap-1 text-xs text-muted'}
      >
        {label}
        {help}
      </label>
      <select
        id={selectId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as V)}
        className={`${inputClass} truncate`}
      >
        {options?.map(renderOption)}
        {groups?.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map(renderOption)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
