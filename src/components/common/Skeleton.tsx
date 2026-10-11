export interface SkeletonProps {
  className?: string;
  /** 行数(テキスト風の骨組み) */
  lines?: number;
}

/** 読み込み中の骨組み表示 */
export default function Skeleton({ className = '', lines }: SkeletonProps) {
  if (lines && lines > 0) {
    return (
      <div className={`space-y-2 ${className}`} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-surface2"
            style={{ width: `${100 - ((i * 17) % 40)}%` }}
          />
        ))}
      </div>
    );
  }
  return <div aria-hidden="true" className={`animate-pulse rounded bg-surface2 ${className}`} />;
}
