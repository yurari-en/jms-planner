import { usePlanStore } from '../../store/plan';

/** 強化順序タブ(仮)。次の担当が置き換える */
export default function PlanTab() {
  const status = usePlanStore((s) => s.status);
  const plan = usePlanStore((s) => s.plan);
  const error = usePlanStore((s) => s.error);
  return (
    <div className="space-y-1 text-sm">
      <p>計算状態: {status}</p>
      <p>ステップ数: {plan ? plan.steps.length : 0}</p>
      {error && <p className="text-effRed">{error}</p>}
    </div>
  );
}
