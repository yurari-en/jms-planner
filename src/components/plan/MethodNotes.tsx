import type { ReactNode } from 'react';
import type { CubeTableKind, MasterData, VipRank } from '../../data/types';
import type { PlannerSettings } from '../../domain/settings';
import { formatMel } from './format';

export interface MethodNotesProps {
  data: MasterData;
  settings: PlannerSettings | null;
  /** 選択中キャラの職業 id(クール減換算の 'auto' 解決に使う) */
  jobId: string | null;
}

const KMS_TABLE_JA: Record<CubeTableKind, string> = {
  red: 'レッドキューブ',
  black: 'ブラックキューブ',
  additional: 'エディショナルキューブ',
};

const VIP_JA: Record<VipRank, string> = {
  none: 'なし',
  silver: 'シルバー',
  gold: 'ゴールド',
  diamond: 'ダイヤ',
  royal: 'ロイヤル',
};

const DESTROY_FALLBACK = {
  restorePrev: '破壊前の★へ復旧',
  restart12: '★12から再開',
} as const;

const EVENT_FALLBACK = {
  discount30: '強化費用30%割引',
  destroyDown30: '破壊確率30%減少',
  guarantee51015: '5/10/15★で100%成功',
  plusOneUnder10: '10★以下 成功時+2',
} as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="space-y-1 text-xs leading-relaxed text-muted">{children}</div>
    </section>
  );
}

/** 「計算方法」の中身: DESIGN.md §6 の要約と、いま使っている前提 */
export default function MethodNotes({ data, settings, jobId }: MethodNotesProps) {
  const job = jobId ? data.jobs.jobs.find((j) => j.id === jobId) : undefined;
  const cdrSetting = settings?.cdrLinesPer2Sec ?? 'auto';
  const cdrValue = cdrSetting === 'auto' ? job?.cdrLinesPer2Sec : cdrSetting;
  const destroyMode = settings?.destroyMode ?? data.starforce.destruction.defaultMode;
  const destroyLabel =
    data.starforce.destruction.modes?.[destroyMode]?.label ?? DESTROY_FALLBACK[destroyMode];
  const events = settings
    ? (Object.keys(EVENT_FALLBACK) as (keyof typeof EVENT_FALLBACK)[])
        .filter((k) => settings.events[k])
        .map((k) => data.starforce.events[k].label ?? EVENT_FALLBACK[k])
    : [];
  const asOf = Object.entries(data.manifest.files);
  const melPerNP = settings?.melPerNP ?? data.cubes.currency.melPerNPDefault;

  return (
    <div className="min-w-0 space-y-3 break-words">
      <Section title="効率と並べ方">
        <p>
          効率 = 戦闘力上昇 ÷
          期待コスト(メル)。いちばん効率の良い1手を選んで適用し、その状態で次の1手を選び直す貪欲法です(★は最大6段先まで先読み)。マスの色は効率の四分位です。
        </p>
        <p>
          戦闘力は、入力した表示戦闘力に「強化前後のステータス・攻撃力・ダメージ%などの因子の比」を掛けて推定します。
        </p>
      </Section>

      <Section title="スターフォース">
        <p>{data.starforce.meta.basis}</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>破壊時の扱い: {destroyLabel}</li>
          <li>スターキャッチ: {settings?.starCatch === false ? 'なし' : 'あり(成功率×1.05)'}</li>
          <li>イベント: {events.length > 0 ? events.join(' / ') : 'なし'}</li>
          <li>VIP割引: {VIP_JA[settings?.vipRank ?? 'none']}</li>
          {settings && settings.star22PlusMultiplier !== 1 && (
            <li>★22以上の費用倍率: {settings.star22PlusMultiplier}</li>
          )}
          {settings && settings.safeguardStars.length > 0 && (
            <li>破壊防止: ★{settings.safeguardStars.join('/')}</li>
          )}
        </ul>
      </Section>

      <Section title="潜在能力・アディショナル">
        <p>
          目標の行はその等級の最小値で出たと仮定します(保守的)。期待個数 = 等級上昇の期待個数(各段階
          1 ÷ 等級上昇率の合計) + 目標がそろうまでの個数(1 ÷ 1回でそろう確率)。
          {settings?.miracleTime && ' ミラクルタイム(等級上昇率2倍)を反映中。'}
          {settings?.useGuarantee && ' 等級上昇保証(天井)を反映中。'}
        </p>
        <p>
          キューブの確率は JMS 非公開のため、KMS の確率表に対応付けています(1NP ={' '}
          {formatMel(melPerNP)} で換算)。
        </p>
        <ul className="list-disc space-y-0.5 pl-4">
          {data.cubes.cubes.map((c) => (
            <li key={c.id}>
              {c.nameJa} → KMS {KMS_TABLE_JA[c.kmsEquivalent]}
              <span className="ml-1 rounded border border-effYellow/60 px-1 text-[10px] text-effYellow">
                推定
              </span>{' '}
              <span>確度 {c.confidence}</span>
              {settings?.cubes[c.id] && (
                <span>
                  {' '}
                  / 1個 {formatMel(settings.cubes[c.id].priceNP * melPerNP)}
                  {settings.cubes[c.id].enabled ? '' : '(使わない設定)'}
                </span>
              )}
            </li>
          ))}
        </ul>
        {data.cubeTables.meta.seed && (
          <p className="text-effYellow">
            確率表はシード版です。レッド表が無いためネオキューブはブラック表で代用しています。
          </p>
        )}
      </Section>

      <Section title="帽子のクールタイム減少">
        <p>
          クール減2秒 = レジェンダリー主ステ%行 {cdrValue ?? '—'} 行分として換算
          {cdrSetting === 'auto' ? `(職業既定${job ? `: ${job.nameJa}` : ''})` : '(設定値)'}。
        </p>
      </Section>

      <Section title="追加オプション(転生の炎)">
        <p>
          {data.flame.meta.basis}。炎1回の結果の分布を厳密に計算し、効率 = E[max(0, 新スコア −
          現在スコア)](炎1個あたりの期待戦闘力上昇)の高い順に並べます。
        </p>
        {data.flame.unconfirmed.length > 0 && (
          <>
            <p className="font-bold text-text">未確定</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {data.flame.unconfirmed.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="対象外">
        <p>防御率無視・クリティカル率・HP%・メル/ドロップ獲得量は戦闘力の計算に入れていません。</p>
      </Section>

      <Section title="データ基準日">
        <ul className="list-disc space-y-0.5 pl-4">
          {asOf.length === 0 ? (
            <li>不明</li>
          ) : (
            asOf.map(([file, f]) => (
              <li key={file}>
                {file}: {f.asOf ?? '不明'}
              </li>
            ))
          )}
        </ul>
      </Section>
    </div>
  );
}
