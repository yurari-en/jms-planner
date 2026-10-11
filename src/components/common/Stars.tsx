export interface StarsProps {
  /** 現在★ */
  count: number;
  /** 目標★(あれば '20→22' のように表示) */
  to?: number;
  className?: string;
}

/** ★の表示。画像を使わずテキストで描く(例: ★22) */
export default function Stars({ count, to, className = '' }: StarsProps) {
  const text = to !== undefined && to !== count ? `★${count}→${to}` : `★${count}`;
  const label = text;
  return (
    <span
      role="img"
      aria-label={label}
      className={`whitespace-nowrap tabular-nums text-effYellow ${className}`}
    >
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
