import type { EquipInput } from '../../domain/character';
import Collapsible from '../common/Collapsible';
import SelectField from '../common/SelectField';
import Toggle from '../common/Toggle';
import { withOverride } from './inputHelpers';
import OptionalNumberField from './OptionalNumberField';

export interface OverridesFieldsProps {
  eq: EquipInput;
  onChange: (updater: (e: EquipInput) => EquipInput) => void;
  /** 上書き無しのときの最大★ */
  autoMaxStar: number;
  /** マスタ・手入力から決まるボス報酬扱い */
  autoBoss: boolean;
  /** 設定の「復旧用装備の価格」既定値 */
  defaultSparePriceMel: number;
  /** 部位として★強化できるか */
  slotCanStar: boolean;
}

type BossChoice = 'auto' | 'boss' | 'nonBoss';

/** 装備ごとの上書き(詳細設定) */
export default function OverridesFields({
  eq,
  onChange,
  autoMaxStar,
  autoBoss,
  defaultSparePriceMel,
  slotCanStar,
}: OverridesFieldsProps) {
  const o = eq.overrides ?? {};
  const boss: BossChoice = o.boss === undefined ? 'auto' : o.boss ? 'boss' : 'nonBoss';
  const count = Object.keys(o).length + (eq.targetStar !== undefined ? 1 : 0);

  return (
    <Collapsible
      id="input.equip.overrides"
      title={`詳細設定(上書き)${count > 0 ? ` ・${count}件` : ''}`}
      defaultCollapsed
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {slotCanStar && (
          <Toggle
            className="sm:col-span-2"
            label="★強化しない"
            description="この装備を★の順序計算から外します"
            checked={!!o.sfDisabled}
            onChange={(v) => onChange((e) => withOverride(e, 'sfDisabled', v ? true : undefined))}
          />
        )}
        <Toggle
          label="潜在を計算しない"
          description="潜在・アディの順序計算から外します"
          checked={!!o.potDisabled}
          onChange={(v) => onChange((e) => withOverride(e, 'potDisabled', v ? true : undefined))}
        />
        <Toggle
          label="炎を計算しない"
          description="追加オプションの順番から外します"
          checked={!!o.flameDisabled}
          onChange={(v) => onChange((e) => withOverride(e, 'flameDisabled', v ? true : undefined))}
        />
        {slotCanStar && (
          <OptionalNumberField
            label="最大★"
            value={o.maxStar}
            min={0}
            max={30}
            integer
            placeholder={`自動(${autoMaxStar})`}
            onChange={(v) => onChange((e) => withOverride(e, 'maxStar', v))}
          />
        )}
        {slotCanStar && (
          <OptionalNumberField
            label="目標★"
            value={eq.targetStar}
            min={0}
            max={30}
            integer
            placeholder="なし"
            onChange={(v) =>
              onChange((e) => {
                const next = { ...e };
                if (v === undefined) delete next.targetStar;
                else next.targetStar = v;
                return next;
              })
            }
          />
        )}
        <SelectField<BossChoice>
          label="ボス報酬扱い"
          value={boss}
          options={[
            { value: 'auto', label: `自動(${autoBoss ? 'ボス' : '非ボス'})` },
            { value: 'boss', label: 'ボス報酬として扱う' },
            { value: 'nonBoss', label: 'ボス報酬として扱わない' },
          ]}
          onChange={(v) =>
            onChange((e) => withOverride(e, 'boss', v === 'auto' ? undefined : v === 'boss'))
          }
        />
        {slotCanStar && (
          <OptionalNumberField
            label="復旧用装備の価格"
            value={o.sparePriceMel}
            min={0}
            integer
            suffix="メル"
            placeholder={`設定の既定値(${defaultSparePriceMel.toLocaleString('ja-JP')})`}
            onChange={(v) => onChange((e) => withOverride(e, 'sparePriceMel', v))}
          />
        )}
      </div>
    </Collapsible>
  );
}
