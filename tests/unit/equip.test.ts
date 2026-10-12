// resolveEquip の★可否(補助武器は強化可能回数 tuc > 0 のものだけ★可)と潜在可否を確認する。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ItemMaster, StarforceMaster } from '../../src/data/types';
import { emptyEquip, type EquipInput } from '../../src/domain/character';
import { resolveEquip, type EquipResolveDeps } from '../../src/domain/equip';

const here = path.dirname(fileURLToPath(import.meta.url));
const starforce = JSON.parse(
  fs.readFileSync(path.resolve(here, '../../public/data/starforce.json'), 'utf8'),
) as StarforceMaster;

const master = (
  id: number,
  name: string,
  slot: ItemMaster['slot'],
  tuc: number,
  onlyUpgrade: 0 | 1 = 0,
  exGrade: 0 | 1 = 0,
  noPotential: 0 | 1 = 0,
): ItemMaster => ({
  id,
  name,
  lv: 200,
  slot,
  sub: slot === 'secondary' ? '霊符' : 'Ring',
  jobs: ['Magician'],
  boss: 0,
  superior: 0,
  setId: null,
  setName: null,
  tuc,
  onlyUpgrade,
  exGrade,
  exceptUpgrade: 0,
  noPotential,
  base: { str: 0, dex: 0, int: 0, luk: 0, att: 0, matt: 0, hp: 0 },
});

const FUDA = master(1354309, '天魂降臨霊符', 'secondary', 9);
const CLASSIC = master(1352003, '従来の補助武器', 'secondary', 0);
const SEED_RING = master(1113098, 'リストレイントリング', 'ring', 0);
const AWAKE_RING = master(1114318, 'アウェイクリング', 'ring', 3, 1, 1);
// デスティニー武器相当: 専用呪文書のみ(onlyUpgrade)だが成長システム(exGrade)は無い → ★可
const DESTINY = master(1212145, 'デスティニーシャイニングロッド', 'weapon', 9, 1, 0);
const NORMAL_RING = master(1113999, '普通の指輪', 'ring', 3, 0);
const EMBLEM = master(1190999, 'エンブレム(tuc 0)', 'emblem', 0);
const DEMON_SHIELD = master(1099999, 'デーモンのフォースシールド(tuc 0)', 'shield', 0);
const NO_POT_RING = master(1113998, '潜在不可の指輪', 'ring', 3, 0, 0, 1);

const deps: EquipResolveDeps = {
  itemsById: new Map(
    [
      FUDA,
      CLASSIC,
      SEED_RING,
      AWAKE_RING,
      NORMAL_RING,
      DESTINY,
      EMBLEM,
      DEMON_SHIELD,
      NO_POT_RING,
    ].map((i) => [i.id, i]),
  ),
  starforce,
  isNonBossException: () => false,
  isFlameException: () => false,
};

const equip = (
  itemId: number | null,
  patch: Partial<EquipInput> = {},
  slot: EquipInput['slot'] = 'secondary',
): EquipInput => ({
  ...emptyEquip(slot),
  itemId,
  ...patch,
});

describe('resolveEquip: 補助武器の★可否', () => {
  it('強化可能回数がある補助武器(カンナの霊符 tuc 9)は★可', () => {
    expect(resolveEquip(equip(FUDA.id), deps).canStar).toBe(true);
  });

  it('強化可能回数 0 の従来の補助武器は★不可', () => {
    expect(resolveEquip(equip(CLASSIC.id), deps).canStar).toBe(false);
  });

  it('★強化しない設定(sfDisabled)なら tuc があっても★不可', () => {
    expect(resolveEquip(equip(FUDA.id, { overrides: { sfDisabled: true } }), deps).canStar).toBe(
      false,
    );
  });

  it('マスタの無い手入力の補助武器は★不可', () => {
    const custom = equip(null, { custom: { name: '手入力', lv: 200, boss: false } });
    expect(resolveEquip(custom, deps).canStar).toBe(false);
  });
});

describe('resolveEquip: マスタによる★可否', () => {
  it('強化可能回数 0 の指輪(シードリング)は★不可', () => {
    expect(resolveEquip(equip(SEED_RING.id, {}, 'ring1'), deps).canStar).toBe(false);
  });

  it('装備固有の成長システム(exGrade)の指輪(アウェイクリング)は★不可', () => {
    expect(resolveEquip(equip(AWAKE_RING.id, {}, 'ring1'), deps).canStar).toBe(false);
  });

  it('強化可能回数があり成長システムでない指輪は★可', () => {
    expect(resolveEquip(equip(NORMAL_RING.id, {}, 'ring1'), deps).canStar).toBe(true);
  });

  it('専用呪文書のみ(onlyUpgrade)でも exGrade でなければ★可(デスティニー武器相当)', () => {
    expect(resolveEquip(equip(DESTINY.id, {}, 'weapon'), deps).canStar).toBe(true);
  });

  it('マスタの無い手入力の帽子は部位の規則どおり★可', () => {
    const custom = equip(null, { custom: { name: '手入力', lv: 150, boss: false } }, 'hat');
    expect(resolveEquip(custom, deps).canStar).toBe(true);
  });
});

describe('resolveEquip: マスタによる潜在可否', () => {
  const pot = (e: EquipInput) => resolveEquip(e, deps).canPotential;

  it('強化可能回数 0 の指輪(シードリング)は潜在不可', () => {
    expect(pot(equip(SEED_RING.id, {}, 'ring1'))).toBe(false);
  });

  it('強化可能回数がある指輪は潜在可', () => {
    expect(pot(equip(NORMAL_RING.id, {}, 'ring1'))).toBe(true);
  });

  it('強化可能回数 0 の補助武器は潜在可', () => {
    expect(pot(equip(CLASSIC.id))).toBe(true);
  });

  it('強化可能回数 0 のエンブレムは潜在可', () => {
    expect(pot(equip(EMBLEM.id, {}, 'emblem'))).toBe(true);
  });

  // 盾は画面上は補助武器の枠に装備する(EquipSlot に 'shield' は無い)
  it('強化可能回数 0 の盾(デーモンのフォースシールド等)は補助武器の枠で潜在可', () => {
    expect(pot(equip(DEMON_SHIELD.id))).toBe(true);
  });

  it('noPotential の装備は強化可能回数があっても潜在不可', () => {
    expect(pot(equip(NO_POT_RING.id, {}, 'ring1'))).toBe(false);
  });

  it('マスタの無い手入力の指輪は部位の規則どおり潜在可', () => {
    const custom = equip(null, { custom: { name: '手入力', lv: 150, boss: false } }, 'ring1');
    expect(pot(custom)).toBe(true);
  });

  it('潜在を計算しない設定(potDisabled)なら潜在不可', () => {
    expect(pot(equip(NORMAL_RING.id, { overrides: { potDisabled: true } }, 'ring1'))).toBe(false);
  });
});
