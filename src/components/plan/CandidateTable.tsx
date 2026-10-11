import type { CandidateRow } from '../../domain/planTypes';
import { formatCount, formatEfficiency, formatGain, formatMel, formatProb } from './format';
import KindBadge from './KindBadge';

export interface CandidateTableProps {
  rows: readonly CandidateRow[];
}

/** 「この装備の全候補を見る」の表(初期状態に対する評価。効率の高い順) */
export default function CandidateTable({ rows }: CandidateTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">この装備に戦闘力が上がる候補はありません。</p>;
  }
  const sorted = [...rows].sort((a, b) => b.efficiency - a.efficiency);
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-xs tabular-nums">
        <caption className="pb-1 text-left text-muted">
          現在の状態に対する評価です(効率の高い順)。効率 = 戦闘力上昇 ÷ 期待コスト。
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th scope="col" className="py-1 pr-2 font-medium">
              目標
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">
              確率 / 破壊回数
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">
              期待個数
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">
              コスト
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">
              戦闘力
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              効率
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={`${r.kind}:${r.label}:${i}`} className="border-b border-border/50">
              <th scope="row" className="py-1 pr-2 text-left font-normal">
                <span className="inline-flex items-center gap-1">
                  <KindBadge kind={r.kind} />
                  <span>{r.label}</span>
                </span>
              </th>
              <td className="py-1 pr-2 text-right">
                {r.kind === 'starforce'
                  ? `破壊 ${formatCount(r.destroys ?? 0, 2)}回`
                  : r.prob !== undefined
                    ? formatProb(r.prob)
                    : '—'}
              </td>
              <td className="py-1 pr-2 text-right">
                {r.expectedCubes !== undefined ? (
                  <span title={r.cubeName}>{formatCount(r.expectedCubes)}個</span>
                ) : (
                  '—'
                )}
              </td>
              <td className="py-1 pr-2 text-right">{formatMel(r.cost)}</td>
              <td className="py-1 pr-2 text-right">{formatGain(r.gain)}</td>
              <td className="py-1 text-right">{formatEfficiency(r.efficiency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
