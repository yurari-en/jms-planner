import type { PlannerSettings } from '../../domain/settings';
import { useSettingsStore } from '../../store/settings';
import Collapsible from '../common/Collapsible';
import NumberField from '../common/NumberField';
import Toggle from '../common/Toggle';
import type { SectionProps } from './sectionProps';
import SettingRow from './SettingRow';
import { onOff } from './settingsText';

type IncludeKey = keyof PlannerSettings['include'];
const INCLUDE: { key: IncludeKey; label: string }[] = [
  { key: 'starforce', label: 'スターフォース' },
  { key: 'potential', label: '潜在能力' },
  { key: 'additional', label: 'アディショナル' },
];

/** 表示の設定 */
export default function DisplaySettings({ s, d }: SectionProps) {
  const { update, set, resetKey } = useSettingsStore.getState();
  return (
    <Collapsible id="settings.display" title="表示">
      {INCLUDE.map(({ key, label }) => (
        <SettingRow
          key={key}
          name={`含める項目: ${label}`}
          isDefault={s.include[key] === d.include[key]}
          defaultText={onOff(d.include[key])}
          onReset={() =>
            set((cur) => ({ ...cur, include: { ...cur.include, [key]: d.include[key] } }))
          }
        >
          <Toggle
            label={`含める項目: ${label}`}
            description="強化順序の計算に含めます(強化順序タブでも切り替えられます)"
            checked={s.include[key]}
            onChange={(v) => set((cur) => ({ ...cur, include: { ...cur.include, [key]: v } }))}
          />
        </SettingRow>
      ))}

      <SettingRow
        name="上限★の装備を隠す"
        isDefault={s.hideMaxed === d.hideMaxed}
        defaultText={onOff(d.hideMaxed)}
        onReset={() => resetKey('hideMaxed')}
      >
        <Toggle
          label="上限★の装備を一覧から隠す"
          checked={s.hideMaxed}
          onChange={(v) => update({ hideMaxed: v })}
        />
      </SettingRow>

      <SettingRow
        name="ステップ数の上限"
        description="スペックアップの順番に出すステップ数の上限(10〜300)"
        isDefault={s.stepLimit === d.stepLimit}
        defaultText={String(d.stepLimit)}
        onReset={() => resetKey('stepLimit')}
      >
        <NumberField
          label="ステップ数の上限"
          value={s.stepLimit}
          min={10}
          max={300}
          integer
          onChange={(v) => update({ stepLimit: v })}
        />
      </SettingRow>
    </Collapsible>
  );
}
