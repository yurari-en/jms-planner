import { useId } from 'react';
import type { DestroyMode, VipRank } from '../../data/types';
import type { PlannerSettings } from '../../domain/settings';
import { useSettingsStore } from '../../store/settings';
import Collapsible from '../common/Collapsible';
import NumberField from '../common/NumberField';
import SelectField from '../common/SelectField';
import { focusRing } from '../common/styles';
import Toggle from '../common/Toggle';
import type { SectionProps } from './sectionProps';
import SettingRow from './SettingRow';
import { VIP_LABEL_JA, VIP_ORDER, fmtNum, onOff, sameValue } from './settingsText';

type EventKey = keyof PlannerSettings['events'];
const EVENT_KEYS: EventKey[] = ['discount30', 'destroyDown30', 'guarantee51015', 'plusOneUnder10'];
const EVENT_FALLBACK_LABEL: Record<EventKey, string> = {
  discount30: '強化費用30%割引',
  destroyDown30: '破壊確率30%減少',
  guarantee51015: '5/10/15★で100%成功',
  plusOneUnder10: '10★以下 成功時+2',
};

/** スターフォースの設定 */
export default function StarforceSettings({ s, d, data }: SectionProps) {
  const { update, set, resetKey } = useSettingsStore.getState();
  const sf = data.starforce;
  const destroyName = useId();
  const modes = sf.destruction.modes;
  const j22 = sf.cost.jmsStar22PlusMultiplier;
  const multOptions = [...new Set([j22.default, j22.alt, s.star22PlusMultiplier])].sort(
    (a, b) => a - b,
  );
  const vip = sf.discounts.vip;

  return (
    <Collapsible id="settings.starforce" title="スターフォース">
      <SettingRow
        name="スターキャッチ"
        isDefault={s.starCatch === d.starCatch}
        defaultText={onOff(d.starCatch)}
        onReset={() => resetKey('starCatch')}
      >
        <Toggle
          label="スターキャッチ"
          description="成功率×1.05。JMS ver4.43以降は常時適用"
          checked={s.starCatch}
          onChange={(v) => update({ starCatch: v })}
        />
      </SettingRow>

      {EVENT_KEYS.map((k) => (
        <SettingRow
          key={k}
          name={`イベント: ${sf.events[k].label ?? EVENT_FALLBACK_LABEL[k]}`}
          isDefault={s.events[k] === d.events[k]}
          defaultText={onOff(d.events[k])}
          onReset={() => set((cur) => ({ ...cur, events: { ...cur.events, [k]: d.events[k] } }))}
        >
          <Toggle
            label={`イベント: ${sf.events[k].label ?? EVENT_FALLBACK_LABEL[k]}`}
            description={k === 'destroyDown30' ? sf.events.destroyDown30.note : undefined}
            checked={s.events[k]}
            onChange={(v) => set((cur) => ({ ...cur, events: { ...cur.events, [k]: v } }))}
          />
        </SettingRow>
      ))}

      <SettingRow
        name="VIPランク"
        description={vip.note}
        isDefault={s.vipRank === d.vipRank}
        defaultText={VIP_LABEL_JA[d.vipRank]}
        onReset={() => resetKey('vipRank')}
      >
        <SelectField<VipRank>
          label="VIPランク(強化費用の割引)"
          value={s.vipRank}
          options={VIP_ORDER.map((r) => ({
            value: r,
            label:
              r === 'none'
                ? VIP_LABEL_JA[r]
                : `${VIP_LABEL_JA[r]}(${fmtNum((vip.rates[r] ?? 0) * 100)}%割引)`,
          }))}
          onChange={(v) => update({ vipRank: v })}
        />
      </SettingRow>

      <SettingRow
        name="★22以上の費用倍率"
        description={j22.note}
        isDefault={s.star22PlusMultiplier === d.star22PlusMultiplier}
        defaultText={d.star22PlusMultiplier.toFixed(1)}
        onReset={() => resetKey('star22PlusMultiplier')}
      >
        <SelectField<string>
          label="★22以上の費用倍率"
          value={String(s.star22PlusMultiplier)}
          options={multOptions.map((m) => ({
            value: String(m),
            label: `${m.toFixed(1)}倍${m === j22.default ? '(KMS基準)' : m === j22.alt ? '(JMS攻略の推定)' : ''}`,
          }))}
          onChange={(v) => update({ star22PlusMultiplier: Number(v) })}
        />
      </SettingRow>

      <SettingRow
        name="破壊時の扱い"
        isDefault={s.destroyMode === d.destroyMode}
        defaultText={modes?.[d.destroyMode]?.label ?? d.destroyMode}
        onReset={() => resetKey('destroyMode')}
      >
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm">破壊時の扱い</legend>
          <div className="space-y-2">
            {(['restorePrev', 'restart12'] as DestroyMode[]).map((m) => (
              <label key={m} className="flex min-w-0 cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name={destroyName}
                  value={m}
                  checked={s.destroyMode === m}
                  onChange={() => update({ destroyMode: m })}
                  className={`mt-1 shrink-0 accent-accent ${focusRing}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm">{modes?.[m]?.label ?? m}</span>
                  {modes?.[m]?.note && (
                    <span className="block text-xs text-muted">{modes[m].note}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </SettingRow>

      <SettingRow
        name="復旧用装備の価格"
        description="破壊時の復旧に使う同名装備1個の価格。装備ごとに上書きできます(入力タブの詳細設定)。"
        isDefault={s.defaultSparePriceMel === d.defaultSparePriceMel}
        defaultText={`${fmtNum(d.defaultSparePriceMel)} メル`}
        onReset={() => resetKey('defaultSparePriceMel')}
      >
        <NumberField
          label="復旧用装備の価格(既定)"
          value={s.defaultSparePriceMel}
          min={0}
          integer
          suffix="メル"
          onChange={(v) => update({ defaultSparePriceMel: v })}
        />
      </SettingRow>

      <SettingRow
        name="破壊防止"
        description={sf.safeguard.note}
        isDefault={sameValue(s.safeguardStars, d.safeguardStars)}
        defaultText={d.safeguardStars.length ? d.safeguardStars.join('/') : 'なし'}
        onReset={() => resetKey('safeguardStars')}
      >
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm">破壊防止する段階</legend>
          <div className="flex flex-wrap gap-4">
            {sf.safeguard.stars.map((st) => (
              <label key={st} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={s.safeguardStars.includes(st)}
                  onChange={(e) => {
                    const on = e.target.checked;
                    set((cur) => {
                      const list = new Set(cur.safeguardStars);
                      if (on) list.add(st);
                      else list.delete(st);
                      return { ...cur, safeguardStars: [...list].sort((a, b) => a - b) };
                    });
                  }}
                  className={`accent-accent ${focusRing}`}
                />
                ★{st}→{st + 1}
              </label>
            ))}
          </div>
        </fieldset>
      </SettingRow>

      <SettingRow
        name="★の上限"
        description="順序計算で考える★の上限(装備の最大★と目標★の小さい方で打ち切り)"
        isDefault={s.sfMaxTarget === d.sfMaxTarget}
        defaultText={String(d.sfMaxTarget)}
        onReset={() => resetKey('sfMaxTarget')}
      >
        <NumberField
          label="順序計算で考える★の上限"
          value={s.sfMaxTarget}
          min={1}
          max={30}
          integer
          onChange={(v) => update({ sfMaxTarget: v })}
        />
      </SettingRow>
    </Collapsible>
  );
}
