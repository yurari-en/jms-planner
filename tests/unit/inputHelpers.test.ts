import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildIndexes } from '../../src/data/indexes';
import type {
  CubeTables,
  CubesMaster,
  FlameMaster,
  JobsMaster,
  MasterData,
  PotOption,
  StarforceMaster,
} from '../../src/data/types';
import { emptyCharacter, type CharacterInput, type PotState } from '../../src/domain/character';
import {
  autoStatPct,
  otherPctOf,
  parseOptionalNumber,
  replaceEquip,
  syncPctAfterEquipChange,
  unknownLineIndexes,
  withOtherPct,
  withOverride,
  withPotLine,
  withTotalPct,
} from '../../src/components/input/inputHelpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = <T>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.resolve(here, rel), 'utf8')) as T;

const DATA: MasterData = {
  starforce: readJson<StarforceMaster>('../../public/data/starforce.json'),
  cubes: readJson<CubesMaster>('../../public/data/cubes.json'),
  cubeTables: readJson<CubeTables>('../fixtures/kms-cube-tables.seed.json'),
  flame: readJson<FlameMaster>('../../public/data/flame.json'),
  jobs: readJson<JobsMaster>('../../public/data/jobs.json'),
  items: { meta: { source: 'test', asOf: '2026-01-01', minLevel: 0 }, items: [] },
  manifest: { version: 'test', generatedAt: '2026-01-01T00:00:00Z', files: {} },
};
const idx = buildIndexes(DATA);
const OPTS = idx.potentialOptionsFor('black', 'legendary', 'hat', 160);

function opt(key: string, value: number, stat?: string): PotOption {
  const o = OPTS.find((x) => x.key === key && x.value === value && (!stat || x.stat === stat));
  if (!o) throw new Error(`option not found ${key} ${value} ${stat ?? ''}`);
  return o;
}

function pot(lines: (PotOption | null)[]): PotState {
  let s: PotState = { grade: 'legendary', lines: [null, null, null] };
  lines.forEach((o, i) => (s = withPotLine(s, i, o)));
  return s;
}

const strPct = OPTS.filter((o) => o.key === 'statPct' && o.stat === 'STR').sort(
  (a, b) => b.value - a.value,
)[0] as PotOption;
const allPct = OPTS.filter((o) => o.key === 'allStatPct').sort((a, b) => b.value - a.value)[0] as
  PotOption | undefined;

function charWithHat(): CharacterInput {
  const ch = emptyCharacter('c1');
  return replaceEquip(ch, 'hat', (e) => ({
    ...e,
    potential: pot([strPct, strPct, allPct ?? null]),
    flame: { ...e.flame, allStatPct: 6 },
  }));
}

describe('autoStatPct', () => {
  it('潜在の主ステ%・全ステ%と炎の全ステ%を合計する', () => {
    const ch = charWithHat();
    const auto = autoStatPct(ch.equips, idx);
    const all = allPct?.value ?? 0;
    expect(auto.STR).toBeCloseTo(strPct.value * 2 + all + 6, 9);
    expect(auto.DEX).toBeCloseTo(all + 6, 9);
  });

  it('等級なしの行は数えない', () => {
    const ch = replaceEquip(charWithHat(), 'hat', (e) => ({
      ...e,
      potential: { ...e.potential, grade: 'none' },
    }));
    expect(autoStatPct(ch.equips, idx).STR).toBe(6);
  });

  it('アディの行も数える', () => {
    const ch = replaceEquip(emptyCharacter('c'), 'top', (e) => ({
      ...e,
      additional: pot([strPct, null, null]),
    }));
    expect(autoStatPct(ch.equips, idx).STR).toBe(strPct.value);
  });
});

describe('その他% と %合計', () => {
  it('withOtherPct は 合計 = 自動 + その他 を書く', () => {
    const ch = withOtherPct(charWithHat(), 'STR', 25, idx);
    const auto = autoStatPct(ch.equips, idx).STR;
    expect(ch.pctOther?.STR).toBe(25);
    expect(ch.stats.STR.pct).toBeCloseTo(auto + 25, 9);
  });

  it('withTotalPct は その他 = 合計 − 自動 を保存する', () => {
    const ch = withTotalPct(charWithHat(), 'STR', 100, idx);
    const auto = autoStatPct(ch.equips, idx).STR;
    expect(ch.stats.STR.pct).toBe(100);
    expect(ch.pctOther?.STR).toBeCloseTo(100 - auto, 9);
  });

  it('otherPctOf は未保存なら 合計 − 自動 を返す', () => {
    const ch = charWithHat();
    ch.stats.STR.pct = 80;
    const auto = autoStatPct(ch.equips, idx).STR;
    expect(otherPctOf(ch, 'STR', auto)).toBeCloseTo(80 - auto, 9);
  });

  it('装備の変更で自動集計が変わったら %合計 が追従する', () => {
    const prev = withOtherPct(charWithHat(), 'STR', 30, idx);
    const next = replaceEquip(prev, 'hat', (e) => ({ ...e, flame: { ...e.flame, allStatPct: 0 } }));
    const synced = syncPctAfterEquipChange(prev, next, idx);
    expect(synced.stats.STR.pct).toBeCloseTo(prev.stats.STR.pct - 6, 9);
    expect(synced.pctOther?.STR).toBe(30);
  });

  it('その他 が未保存なら 旧合計 − 旧自動 を確定して保存する', () => {
    const prev = charWithHat();
    prev.stats.DEX.pct = 50;
    const before = autoStatPct(prev.equips, idx).DEX;
    const next = replaceEquip(prev, 'hat', (e) => ({ ...e, flame: { ...e.flame, allStatPct: 9 } }));
    const synced = syncPctAfterEquipChange(prev, next, idx);
    expect(synced.pctOther?.DEX).toBeCloseTo(50 - before, 9);
    expect(synced.stats.DEX.pct).toBeCloseTo(53, 9);
  });

  it('自動集計が変わらなければ同じオブジェクトを返す', () => {
    const prev = charWithHat();
    const next = replaceEquip(prev, 'hat', (e) => ({ ...e, star: 10 }));
    expect(syncPctAfterEquipChange(prev, next, idx)).toBe(next);
  });
});

describe('潜在の行', () => {
  it('withPotLine は lines と lineKr を同期する', () => {
    const s = withPotLine({ grade: 'legendary', lines: [null, null, null] }, 1, strPct);
    expect(s.lines).toEqual([null, strPct.id, null]);
    expect(s.lineKr).toEqual([null, strPct.kr, null]);
    const cleared = withPotLine(s, 1, null);
    expect(cleared.lines[1]).toBeNull();
    expect(cleared.lineKr?.[1]).toBeNull();
  });

  it('unknownLineIndexes は選択肢に無い行を返す', () => {
    const s: PotState = { grade: 'legendary', lines: [strPct.id, 999999, null] };
    expect(unknownLineIndexes(s, OPTS, idx)).toEqual([1]);
    expect(unknownLineIndexes(s, [], idx)).toEqual([0, 1]);
    expect(unknownLineIndexes({ ...s, grade: 'none' }, OPTS, idx)).toEqual([]);
  });

  it('opt ヘルパが主ステ行を見つける', () => {
    expect(opt('statPct', strPct.value, 'STR').id).toBe(strPct.id);
  });
});

describe('その他のヘルパ', () => {
  it('withOverride は undefined で削除し、空なら overrides を消す', () => {
    const eq = emptyCharacter('x').equips[0]!;
    const a = withOverride(eq, 'maxStar', 15);
    expect(a.overrides).toEqual({ maxStar: 15 });
    const b = withOverride(a, 'maxStar', undefined);
    expect(b.overrides).toBeUndefined();
  });

  it('parseOptionalNumber は空欄を undefined、読めない値を null にする', () => {
    expect(parseOptionalNumber('')).toBeUndefined();
    expect(parseOptionalNumber(' 1,000 ')).toBe(1000);
    expect(parseOptionalNumber('１２')).toBe(12);
    expect(parseOptionalNumber('abc')).toBeNull();
  });
});
