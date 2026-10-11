import { useId, type ReactNode } from 'react';
import { focusRing } from './styles';

export interface ToggleProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: ReactNode;
  className?: string;
}

/** オン/オフのスイッチ(role="switch") */
export default function Toggle({
  label,
  checked,
  onChange,
  disabled,
  description,
  className = '',
}: ToggleProps) {
  const id = useId();
  return (
    <div className={`flex min-w-0 items-start gap-2 ${className}`}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${focusRing} ${
          checked ? 'border-accent bg-accent' : 'border-border bg-surface2'
        }`}
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm">
          {label}
        </label>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
    </div>
  );
}
