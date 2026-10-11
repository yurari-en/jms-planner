import { memo, useMemo } from 'react';
import type { StatKey } from '../../data/types';
import { jobStatKeys } from '../../domain/cp';
import { useDataStore } from '../../store/data';
import HelpTip from '../common/HelpTip';
import NumberField from '../common/NumberField';
import { useActiveField, useUpdateActive } from './hooks';
import { autoStatPct, round3, withOtherPct, withTotalPct } from './inputHelpers';

const HELP_FINAL =
  'ステータス画面の『詳細』で確認できる最終値(装備・スキル等すべて込み)。バフは切った状態で入力してください。';
const HELP_PCT =
  '%の合計(潜在・アディショナル・追加オプションの全ステータス%・アビリティ等)。ステータス画面の『詳細』で確認。装備由来の分は自動集計されるので、それ以外を「その他」に入力すると合計が自動で入ります。';
const HELP_OTHER =
  '装備以外の%(アビリティ、リンクスキル、ファミリア等)。合計 = 装備から自動集計 + その他。';
const HELP_NONPCT =
  '%が適用されない値(シンボル、ハイパーステータス、ユニオン、HEXAステータス等)。ステータス画面の『詳細』で確認。';

const StatRow = memo(function StatRow({ stat, auto }: { stat: StatKey; auto: number }) {
  const s = useActiveField((c) => c.stats[stat]);
  const savedOther = useActiveField((c) => c.pctOther?.[stat]);
  const update = useUpdateActive();
  if (!s) return null;
  const other = savedOther ?? round3(s.pct - auto);
  const idx = () => useDataStore.getState().idx;

  return (
    <fieldset className="min-w-0 rounded-md border border-border p-2">
      <legend className="px-1 text-sm font-bold">{stat}</legend>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <NumberField
          label={`${stat} 最終値`}
          value={s.final}
          min={0}
          integer
          help={<HelpTip text={HELP_FINAL} label={`${stat} 最終値のヘルプ`} />}
          onChange={(v) =>
            update((c) => ({ ...c, stats: { ...c.stats, [stat]: { ...c.stats[stat], final: v } } }))
          }
        />
        <NumberField
          label={`${stat} %未適用値`}
          value={s.nonPct}
          min={0}
          integer
          help={<HelpTip text={HELP_NONPCT} label={`${stat} %未適用値のヘルプ`} />}
          onChange={(v) =>
            update((c) => ({
              ...c,
              stats: { ...c.stats, [stat]: { ...c.stats[stat], nonPct: v } },
            }))
          }
        />
        <NumberField
          label={`${stat} %合計`}
          value={s.pct}
          min={0}
          max={10000}
          suffix="%"
          help={<HelpTip text={HELP_PCT} label={`${stat} %合計のヘルプ`} />}
          onChange={(v) => {
            const i = idx();
            if (!i) return;
            update((c) => withTotalPct(c, stat, v, i));
          }}
        />
        <NumberField
          label="その他 (アビリティ等)"
          value={other}
          min={-10000}
          max={10000}
          suffix="%"
          help={<HelpTip text={HELP_OTHER} label={`${stat} その他%のヘルプ`} />}
          warning={other < 0 ? '%合計が装備から自動集計した値より小さくなっています' : null}
          onChange={(v) => {
            const i = idx();
            if (!i) return;
            update((c) => withOtherPct(c, stat, v, i));
          }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        装備から自動集計: <span className="tabular-nums text-text">{auto}%</span>
        <span aria-hidden="true"> + </span>
        <span className="sr-only">足す</span>
        その他 <span className="tabular-nums text-text">{other}%</span>
      </p>
    </fieldset>
  );
});

function HpRow() {
  const hp = useActiveField((c) => c.hp);
  const update = useUpdateActive();
  const pure = hp?.pure ?? 0;
  const added = hp?.added ?? 0;
  return (
    <fieldset className="min-w-0 rounded-md border border-border p-2">
      <legend className="px-1 text-sm font-bold">HP</legend>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <NumberField
          label="純HP"
          value={pure}
          min={0}
          integer
          warning={pure > 0 ? null : '未入力です'}
          help={
            <HelpTip
              text="ステータス画面の『詳細』の純HP(%適用前のHP)。デーモンアヴェンジャーの主ステータスです。"
              label="純HPのヘルプ"
            />
          }
          onChange={(v) => update((c) => ({ ...c, hp: { pure: v, added: c.hp?.added ?? 0 } }))}
        />
        <NumberField
          label="追加HP"
          value={added}
          min={0}
          integer
          help={
            <HelpTip
              text="ステータス画面の『詳細』の追加HP(%が適用されないHP)。"
              label="追加HPのヘルプ"
            />
          }
          onChange={(v) => update((c) => ({ ...c, hp: { pure: c.hp?.pure ?? 0, added: v } }))}
        />
      </div>
    </fieldset>
  );
}

function AttackFields({ magic }: { magic: boolean }) {
  const attack = useActiveField((c) => c.attack);
  const dmgPct = useActiveField((c) => c.dmgPct) ?? 0;
  const bossPct = useActiveField((c) => c.bossPct) ?? 0;
  const critDmgPct = useActiveField((c) => c.critDmgPct) ?? 0;
  const update = useUpdateActive();
  const attLabel = magic ? '魔力' : '攻撃力';
  if (!attack) return null;
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-5">
      <NumberField
        label={`${attLabel} 最終値`}
        value={attack.final}
        min={0}
        integer
        warning={attack.final > 0 ? null : '未入力です'}
        help={
          <HelpTip
            text={`ステータス画面の『詳細』の${attLabel}(最終値)。`}
            label={`${attLabel}のヘルプ`}
          />
        }
        onChange={(v) => update((c) => ({ ...c, attack: { ...c.attack, final: v } }))}
      />
      <NumberField
        label={`${attLabel}%`}
        value={attack.pct}
        min={0}
        max={10000}
        suffix="%"
        help={
          <HelpTip
            text={`${attLabel}%の合計(潜在・アディ・エンブレム等)。ステータス画面の『詳細』で確認。`}
            label={`${attLabel}%のヘルプ`}
          />
        }
        onChange={(v) => update((c) => ({ ...c, attack: { ...c.attack, pct: v } }))}
      />
      <NumberField
        label="ダメージ%"
        value={dmgPct}
        min={0}
        max={10000}
        suffix="%"
        help={<HelpTip text="ステータス画面の『詳細』のダメージ。" label="ダメージ%のヘルプ" />}
        onChange={(v) => update((c) => ({ ...c, dmgPct: v }))}
      />
      <NumberField
        label="ボス%"
        value={bossPct}
        min={0}
        max={10000}
        suffix="%"
        help={
          <HelpTip
            text="ステータス画面の『詳細』のボスモンスター攻撃時のダメージ。"
            label="ボス%のヘルプ"
          />
        }
        onChange={(v) => update((c) => ({ ...c, bossPct: v }))}
      />
      <NumberField
        label="クリダメ%"
        value={critDmgPct}
        min={0}
        max={10000}
        suffix="%"
        help={
          <HelpTip
            text="ステータス画面の『詳細』のクリティカルダメージ。"
            label="クリダメ%のヘルプ"
          />
        }
        onChange={(v) => update((c) => ({ ...c, critDmgPct: v }))}
      />
    </div>
  );
}

/** ステータス: 職業の主ステ・副ステ(%入力補助つき)と攻撃力・ダメージ系 */
export default function StatsForm() {
  const jobId = useActiveField((c) => c.jobId);
  const equips = useActiveField((c) => c.equips);
  const idx = useDataStore((s) => s.idx);
  const job = jobId ? idx?.jobsById.get(jobId) : undefined;

  const auto = useMemo(
    () => (idx && equips ? autoStatPct(equips, idx) : { STR: 0, DEX: 0, INT: 0, LUK: 0 }),
    [equips, idx],
  );

  if (!job) {
    return <p className="text-sm text-effYellow">職業を選ぶとステータス欄が表示されます。</p>;
  }
  const { mainStats, subStats } = jobStatKeys(job);
  const isDA = job.statFormula === 'demonAvenger';
  const keys = [...mainStats, ...subStats];

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs text-muted">
        {isDA ? '主ステータス: HP / 副ステータス: STR' : `主ステータス: ${mainStats.join('・')}`}
        {!isDA && subStats.length > 0 && ` / 副ステータス: ${subStats.join('・')}`}
      </p>
      {isDA && <HpRow />}
      {keys.map((k) => (
        <StatRow key={k} stat={k} auto={auto[k]} />
      ))}
      <AttackFields magic={job.attackType === 'matt'} />
    </div>
  );
}
