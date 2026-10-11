import type { StepKind } from '../../domain/planTypes';

export interface KindBadgeProps {
  kind: StepKind;
  className?: string;
}

/** 種別バッジ: 潜在 = 紫「潜」、アディ = 緑「ア」、★ はなし */
export default function KindBadge({ kind, className = '' }: KindBadgeProps) {
  if (kind === 'starforce') return null;
  const pot = kind === 'potential';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold leading-none text-white ${
        pot ? 'bg-effPurple' : 'bg-effGreen'
      } ${className}`}
    >
      {pot ? '潜' : 'ア'}
    </span>
  );
}
