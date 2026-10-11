import type { CubeId } from '../../data/types';
import { useSettingsStore } from '../../store/settings';
import Collapsible from '../common/Collapsible';
import ItemIcon from '../common/ItemIcon';
import NumberField from '../common/NumberField';
import Toggle from '../common/Toggle';
import type { SectionProps } from './sectionProps';
import SettingRow from './SettingRow';
import { fmtNum, onOff, sameValue } from './settingsText';

/** キューブの設定 */
export default function CubeSettings({ s, d, data }: SectionProps) {
  const { update, set, resetKey } = useSettingsStore.getState();
  const cubes = data.cubes.cubes;
  const guaranteeNote = cubes.find((c) => c.guaranteeNote)?.guaranteeNote;

  const setCube = (id: CubeId, patch: Partial<{ enabled: boolean; priceNP: number }>) =>
    set((cur) => {
      const prev = cur.cubes[id] ?? d.cubes[id];
      return { ...cur, cubes: { ...cur.cubes, [id]: { ...prev, ...patch } } };
    });

  return (
    <Collapsible id="settings.cubes" title="キューブ">
      {cubes.map((c) => {
        const cur = s.cubes[c.id] ?? d.cubes[c.id];
        const def = d.cubes[c.id];
        if (!cur || !def) return null;
        return (
          <SettingRow
            key={c.id}
            name={c.nameJa}
            isDefault={sameValue(cur, def)}
            defaultText={`${onOff(def.enabled)} ・ ${fmtNum(def.priceNP)} NP`}
            onReset={() => set((x) => ({ ...x, cubes: { ...x.cubes, [c.id]: { ...def } } }))}
            description={
              <>
                <span className="block">対応: {c.confidence}</span>
                {c.priceNote && <span className="block">価格: {c.priceNote}</span>}
                <span className="block">
                  1個 ≒ {fmtNum(cur.priceNP * s.melPerNP)} メル(換算レートで計算)
                </span>
              </>
            }
          >
            <div className="flex min-w-0 flex-wrap items-end gap-3">
              <ItemIcon itemId={c.itemIdIcon} kind="secondary" alt="" size={28} />
              <Toggle
                className="min-w-0 flex-1 basis-40"
                label={c.nameJa}
                description={c.target === 'potential' ? '潜在能力' : 'アディショナル'}
                checked={cur.enabled}
                onChange={(v) => setCube(c.id, { enabled: v })}
              />
              <NumberField
                className="w-36"
                label={`${c.nameJa}の価格`}
                value={cur.priceNP}
                min={0}
                suffix="NP"
                onChange={(v) => setCube(c.id, { priceNP: v })}
              />
            </div>
          </SettingRow>
        );
      })}

      <SettingRow
        name="ミラクルタイム"
        isDefault={s.miracleTime === d.miracleTime}
        defaultText={onOff(d.miracleTime)}
        onReset={() => resetKey('miracleTime')}
      >
        <Toggle
          label={data.cubes.events.miracleTime.label}
          description={`対象: ${data.cubes.events.miracleTime.appliesTo
            .map((id) => cubes.find((c) => c.id === id)?.nameJa ?? id)
            .join('・')}`}
          checked={s.miracleTime}
          onChange={(v) => update({ miracleTime: v })}
        />
      </SettingRow>

      <SettingRow
        name="等級上昇保証"
        isDefault={s.useGuarantee === d.useGuarantee}
        defaultText={onOff(d.useGuarantee)}
        onReset={() => resetKey('useGuarantee')}
      >
        <Toggle
          label="等級上昇保証(天井)を期待値に入れる"
          description={guaranteeNote ?? 'JMSで有無未確認のため既定はオフ'}
          checked={s.useGuarantee}
          onChange={(v) => update({ useGuarantee: v })}
        />
      </SettingRow>

      <SettingRow
        name="レベルごとに主ステ行"
        isDefault={s.includePerLvLines === d.includePerLvLines}
        defaultText={onOff(d.includePerLvLines)}
        onReset={() => resetKey('includePerLvLines')}
      >
        <Toggle
          label="「レベルごとに主ステ」行を目標候補に含める"
          description="キャラクターレベル○ごとに主ステータス+N の行を、潜在の目標候補に入れます"
          checked={s.includePerLvLines}
          onChange={(v) => update({ includePerLvLines: v })}
        />
      </SettingRow>
    </Collapsible>
  );
}
