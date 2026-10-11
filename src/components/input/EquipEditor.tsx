import { useId, useMemo } from 'react';
import {
  SLOT_LABEL_JA,
  emptyEquip,
  slotKind,
  slotRules,
  type EquipInput,
  type EquipSlot,
} from '../../domain/character';
import { resolveEquip, type EquipResolveDeps } from '../../domain/equip';
import { useDataStore } from '../../store/data';
import { usePlanStore } from '../../store/plan';
import { useSettingsStore } from '../../store/settings';
import Button from '../common/Button';
import HelpTip from '../common/HelpTip';
import ItemIcon from '../common/ItemIcon';
import NumberField from '../common/NumberField';
import { inputClass } from '../common/styles';
import Toggle from '../common/Toggle';
import FlameFields from './FlameFields';
import { useActiveField, useEquipWriter } from './hooks';
import ItemSearchCombobox from './ItemSearchCombobox';
import OverridesFields from './OverridesFields';
import PotentialEditor from './PotentialEditor';
import StarStepper from './StarStepper';

function Note({ children }: { children: string }) {
  return <p className="text-xs text-muted">{children}</p>;
}

function CustomFields({
  eq,
  write,
  magic,
}: {
  eq: EquipInput;
  write: (u: (e: EquipInput) => EquipInput) => void;
  magic: boolean;
}) {
  const nameId = useId();
  const c = eq.custom ?? { name: '', lv: 200, boss: false };
  const set = (patch: Partial<NonNullable<EquipInput['custom']>>) =>
    write((e) => ({ ...e, custom: { ...(e.custom ?? c), ...patch } }));
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2">
      <div className="col-span-2 min-w-0">
        <label htmlFor={nameId} className="mb-1 block text-xs text-muted">
          名前
        </label>
        <input
          id={nameId}
          type="text"
          value={c.name}
          maxLength={60}
          autoComplete="off"
          className={inputClass}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <NumberField
        label="Lv"
        value={c.lv}
        min={0}
        max={300}
        integer
        onChange={(v) => set({ lv: v })}
      />
      <Toggle
        className="self-end"
        label="ボス報酬"
        description="炎が4行・段階+2"
        checked={c.boss}
        onChange={(v) => set({ boss: v })}
      />
      <NumberField
        label="基本攻撃力"
        value={c.baseAtt ?? 0}
        min={0}
        integer
        onChange={(v) => set({ baseAtt: v })}
      />
      <NumberField
        label="基本魔力"
        value={c.baseMatt ?? 0}
        min={0}
        integer
        help={
          magic ? (
            <HelpTip
              text="魔法職は武器の基本魔力が★や炎の計算に使われます。"
              label="基本魔力のヘルプ"
            />
          ) : undefined
        }
        onChange={(v) => set({ baseMatt: v })}
      />
    </div>
  );
}

/** 選択中の部位の編集パネル */
export default function EquipEditor({ slot }: { slot: EquipSlot }) {
  const eq = useActiveField((c) => c.equips.find((e) => e.slot === slot));
  const jobId = useActiveField((c) => c.jobId);
  const data = useDataStore((s) => s.data);
  const idx = useDataStore((s) => s.idx);
  const defaultSpare = useSettingsStore((s) => s.settings?.defaultSparePriceMel ?? 0);
  const warningsText = usePlanStore((s) =>
    s.warnings
      .filter((w) => w.slot === slot)
      .map((w) => w.message)
      .join('\n'),
  );
  const write = useEquipWriter(slot);
  const headingId = useId();

  const deps = useMemo<EquipResolveDeps | null>(
    () =>
      data && idx
        ? {
            itemsById: idx.itemsById,
            starforce: data.starforce,
            isNonBossException: idx.isNonBossException,
            isFlameException: idx.isFlameException,
          }
        : null,
    [data, idx],
  );
  const meta = useMemo(() => (eq && deps ? resolveEquip(eq, deps) : null), [eq, deps]);
  const rawMeta = useMemo(
    () => (eq && deps ? resolveEquip({ ...eq, overrides: undefined }, deps) : null),
    [eq, deps],
  );

  if (!eq || !meta || !rawMeta || !idx) return null;

  const kind = slotKind(slot);
  const rules = slotRules(kind);
  const label = SLOT_LABEL_JA[slot];
  const job = jobId ? idx.jobsById.get(jobId) : undefined;
  const magic = job?.attackType === 'matt';
  const manual = eq.itemId == null && eq.custom != null;
  const missingItem = eq.itemId != null && !idx.itemsById.has(eq.itemId);
  const planWarnings = warningsText ? warningsText.split('\n') : [];

  const starNote = !rules.star
    ? 'この部位は★強化できません'
    : meta.superior
      ? 'シュペリアル装備は v1 では計算対象外'
      : eq.overrides?.sfDisabled
        ? '★強化しない設定です(詳細設定)'
        : null;
  const starWarning =
    eq.star > meta.maxStar
      ? `★が上限(${meta.maxStar})を超えています`
      : meta.superior && eq.star > 0
        ? 'シュペリアル装備の★は計算に使いません'
        : null;

  const potNote = !rules.potential
    ? 'この部位には潜在能力がありません'
    : meta.item?.noPotential === 1
      ? 'この装備には潜在能力がありません'
      : eq.overrides?.potDisabled
        ? '潜在を計算しない設定です(詳細設定)'
        : null;

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-center gap-2">
        <h3 id={headingId} className="min-w-0 flex-1 truncate text-sm font-bold">
          {label}の編集
        </h3>
        <Button
          size="sm"
          variant="danger"
          disabled={JSON.stringify(eq) === JSON.stringify(emptyEquip(slot))}
          onClick={() => write(() => emptyEquip(slot))}
        >
          装備を外す
        </Button>
      </div>

      {/* 現在の装備 */}
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-surface2/40 p-2">
        <ItemIcon itemId={meta.item?.id ?? null} kind={kind} alt={meta.name || label} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{meta.name || '未設定'}</p>
          {meta.present && (
            <p className="truncate text-[11px] text-muted">
              Lv{meta.lv}
              {meta.item?.setName ? ` ・ ${meta.item.setName}` : ''}
              {meta.boss ? ' ・ ボス報酬' : ''}
              {meta.superior ? ' ・ シュペリアル' : ''}
              {manual ? ' ・ 手入力' : ''}
            </p>
          )}
        </div>
      </div>
      {missingItem && (
        <p className="text-xs text-effYellow" role="note">
          ⚠ 装備マスタに見つかりません(ID: {eq.itemId})。検索し直すか手入力してください。
        </p>
      )}

      <Toggle
        label="手入力"
        description="装備マスタに無い装備を入力します"
        checked={manual}
        onChange={(on) =>
          write((e) => {
            if (on) {
              return {
                ...e,
                itemId: null,
                custom: {
                  name: meta.name,
                  lv: meta.lv || 200,
                  boss: meta.boss,
                  baseAtt: meta.baseAtt,
                  baseMatt: meta.baseMatt,
                },
              };
            }
            const next = { ...e };
            delete next.custom;
            return next;
          })
        }
      />
      {manual ? (
        <CustomFields eq={eq} write={write} magic={magic} />
      ) : (
        <ItemSearchCombobox
          kind={kind}
          slotLabel={label}
          onSelect={(item) =>
            write((e) => {
              const next = { ...e, itemId: item.id };
              delete next.custom;
              return next;
            })
          }
        />
      )}

      {/* ★ */}
      <StarStepper
        value={eq.star}
        max={meta.maxStar}
        disabled={!rawMeta.canStar}
        note={starNote}
        warning={starWarning}
        onChange={(v) => write((e) => ({ ...e, star: v }))}
      />

      {kind === 'weapon' && (
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <NumberField
            label="書・強化による攻撃力"
            value={eq.scrollAtt ?? 0}
            min={0}
            max={2000}
            integer
            help={
              <HelpTip
                text="武器の攻撃力のうち、強化の書・ハンマー等で上がった分(★の上昇計算に使います)。"
                label="書・強化による攻撃力のヘルプ"
              />
            }
            onChange={(v) => write((e) => ({ ...e, scrollAtt: v }))}
          />
          <NumberField
            label="書・強化による魔力"
            value={eq.scrollMatt ?? 0}
            min={0}
            max={2000}
            integer
            onChange={(v) => write((e) => ({ ...e, scrollMatt: v }))}
          />
        </div>
      )}

      {/* 潜在 / アディ */}
      {meta.part && rules.potential && meta.item?.noPotential !== 1 ? (
        <div className="min-w-0 space-y-2">
          {potNote && <Note>{potNote}</Note>}
          <PotentialEditor
            title="潜在能力"
            cube="black"
            state={eq.potential}
            part={meta.part}
            lv={meta.lv}
            onChange={(p) => write((e) => ({ ...e, potential: p }))}
          />
          <PotentialEditor
            title="アディショナル"
            cube="additional"
            state={eq.additional}
            part={meta.part}
            lv={meta.lv}
            onChange={(p) => write((e) => ({ ...e, additional: p }))}
          />
        </div>
      ) : (
        potNote && <Note>{potNote}</Note>
      )}

      {/* 炎 */}
      {rawMeta.canFlame ? (
        <div className="min-w-0 space-y-2">
          {eq.overrides?.flameDisabled && <Note>炎を計算しない設定です(詳細設定)</Note>}
          <FlameFields
            flame={eq.flame}
            showHp={job?.statFormula === 'demonAvenger'}
            onChange={(f) => write((e) => ({ ...e, flame: f }))}
          />
        </div>
      ) : (
        <Note>この部位には追加オプションが付きません</Note>
      )}

      <OverridesFields
        eq={eq}
        onChange={write}
        autoMaxStar={rawMeta.maxStar}
        autoBoss={rawMeta.boss}
        defaultSparePriceMel={defaultSpare}
        slotCanStar={rules.star}
      />

      {planWarnings.length > 0 && (
        <div role="note" className="rounded-md border border-effYellow/60 p-2">
          <p className="mb-1 text-xs font-bold text-effYellow">入力チェック</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-effYellow">
            {planWarnings.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
