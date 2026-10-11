import { QUARTILES, QUARTILE_STYLE, quartileLabel } from './format';
import KindBadge from './KindBadge';

/** 凡例: 効率の四分位の色とラベル、種別バッジ */
export default function Legend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"
      aria-label="凡例"
    >
      <span className="font-bold text-text">効率</span>
      {QUARTILES.map((q) => (
        <span key={q} className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className={`inline-block h-3 w-3 rounded-sm border-2 ${QUARTILE_STYLE[q].border}`}
          />
          {quartileLabel(q)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <KindBadge kind="potential" />
        潜在能力
      </span>
      <span className="inline-flex items-center gap-1">
        <KindBadge kind="additional" />
        アディショナル
      </span>
      <span>★ = スターフォース(バッジなし)</span>
    </div>
  );
}
