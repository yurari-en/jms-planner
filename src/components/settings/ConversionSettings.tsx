import type { FlameBase } from '../../data/types';
import type { CdrLinesSetting } from '../../domain/settings';
import { selectActiveCharacter, useCharactersStore } from '../../store/characters';
import { useSettingsStore } from '../../store/settings';
import Collapsible from '../common/Collapsible';
import NumberField from '../common/NumberField';
import SelectField from '../common/SelectField';
import type { SectionProps } from './sectionProps';
import SettingRow from './SettingRow';
import { fmtNum } from './settingsText';

const CDR_DESC =
  '帽子の「全スキルの再使用待機時間 -2秒」を、レジェンダリーの主ステータス%行の何行分とみなすか。';
const CDR_VALUES: Exclude<CdrLinesSetting, 'auto'>[] = [0, 0.5, 1, 1.5, 2, 2.5];
const FLAME_BASES: FlameBase[] = ['powerful', 'eternal', 'black'];
const FLAME_FALLBACK: Record<FlameBase, string> = {
  powerful: '強力な転生の炎',
  eternal: '永遠の転生の炎',
  black: '黒い転生の炎',
};

function cdrLabel(v: CdrLinesSetting, jobDefault: number | null): string {
  if (v === 'auto') {
    return jobDefault === null ? '自動(職業既定)' : `自動(職業既定 = ${fmtNum(jobDefault)}行)`;
  }
  return `${fmtNum(v)}行`;
}

/** 換算の設定(メル換算・帽子クール減・基準の炎) */
export default function ConversionSettings({ s, d, data }: SectionProps) {
  const { update, resetKey } = useSettingsStore.getState();
  const jobId = useCharactersStore((st) => selectActiveCharacter(st)?.jobId);
  const job = jobId ? data.jobs.jobs.find((j) => j.id === jobId) : undefined;
  const jobDefault = job ? job.cdrLinesPer2Sec : null;
  const flameName = (k: FlameBase) => data.flame.flames[k]?.jms ?? FLAME_FALLBACK[k];

  return (
    <Collapsible id="settings.conversion" title="換算">
      <SettingRow
        name="1NPあたりのメル"
        description="1億メル = 100NP なら 1,000,000"
        isDefault={s.melPerNP === d.melPerNP}
        defaultText={fmtNum(d.melPerNP)}
        onReset={() => resetKey('melPerNP')}
      >
        <NumberField
          label="1NPあたりのメル"
          value={s.melPerNP}
          min={0}
          integer
          suffix="メル"
          onChange={(v) => update({ melPerNP: v })}
        />
      </SettingRow>

      <SettingRow
        name="帽子のクール減の価値"
        description={
          <>
            {CDR_DESC}
            {job?.cdrNote && (
              <span className="block">
                {job.nameJa}: {job.cdrNote}
              </span>
            )}
          </>
        }
        isDefault={s.cdrLinesPer2Sec === d.cdrLinesPer2Sec}
        defaultText={cdrLabel(d.cdrLinesPer2Sec, jobDefault)}
        onReset={() => resetKey('cdrLinesPer2Sec')}
      >
        <SelectField<string>
          label="クール減2秒 = 主ステ%行"
          value={String(s.cdrLinesPer2Sec)}
          options={[
            { value: 'auto', label: cdrLabel('auto', jobDefault) },
            ...CDR_VALUES.map((v) => ({ value: String(v), label: cdrLabel(v, jobDefault) })),
          ]}
          onChange={(v) =>
            update({ cdrLinesPer2Sec: v === 'auto' ? 'auto' : (Number(v) as CdrLinesSetting) })
          }
        />
      </SettingRow>

      <SettingRow
        name="基準の炎"
        description={
          <>
            追加オプションの順番を計算するときの炎。
            {s.flameBase === 'black' && (
              <span className="block text-effYellow">黒い転生の炎: JMSでの入手は未確認</span>
            )}
          </>
        }
        isDefault={s.flameBase === d.flameBase}
        defaultText={flameName(d.flameBase)}
        onReset={() => resetKey('flameBase')}
      >
        <SelectField<FlameBase>
          label="基準の炎"
          value={s.flameBase}
          options={FLAME_BASES.map((k) => ({
            value: k,
            label: k === 'black' ? `${flameName(k)}(JMSでの入手は未確認)` : flameName(k),
          }))}
          onChange={(v) => update({ flameBase: v })}
        />
      </SettingRow>
    </Collapsible>
  );
}
