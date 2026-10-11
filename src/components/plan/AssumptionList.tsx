import { assumptionTags } from './format';

/** 前提・注記の一覧。「推定」「代用表」「クール減換算」は印を付ける */
export default function AssumptionList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-xs text-muted">
      {items.map((a) => (
        <li key={a} className="flex flex-wrap items-baseline gap-1">
          <span aria-hidden="true">・</span>
          {assumptionTags(a).map((t) => (
            <span
              key={t}
              className="rounded border border-effYellow/60 px-1 text-[10px] leading-4 text-effYellow"
            >
              {t}
            </span>
          ))}
          <span className="min-w-0 break-words">{a}</span>
        </li>
      ))}
    </ul>
  );
}
