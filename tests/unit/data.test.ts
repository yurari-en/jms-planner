import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildIndexes, normalizeName } from '../../src/data/indexes';
import { DataLoadError, dataUrl, loadMasterData } from '../../src/data/loader';
import {
  cubeTablesSchema,
  cubesSchema,
  describeZodError,
  flameSchema,
  itemsSchema,
  jobsSchema,
  manifestSchema,
  starforceSchema,
} from '../../src/data/schemas';
import type {
  CubeTables,
  CubesMaster,
  DataManifest,
  FlameMaster,
  ItemMaster,
  ItemsMaster,
  JobsMaster,
  MasterData,
  StarforceMaster,
} from '../../src/data/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readText = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = <T>(rel: string): T => JSON.parse(readText(rel)) as T;

const raw = {
  starforce: readText('public/data/starforce.json'),
  cubes: readText('public/data/cubes.json'),
  flame: readText('public/data/flame.json'),
  jobs: readText('public/data/jobs.json'),
  cubeTables: readText('tests/fixtures/kms-cube-tables.seed.json'),
};

function item(
  p: Partial<ItemMaster> & Pick<ItemMaster, 'id' | 'name' | 'lv' | 'slot'>,
): ItemMaster {
  return {
    sub: '',
    jobs: [],
    boss: 0,
    superior: 0,
    setId: null,
    setName: null,
    tuc: 0,
    onlyUpgrade: 0,
    exGrade: 0,
    exceptUpgrade: 0,
    noPotential: 0,
    base: { str: 0, dex: 0, int: 0, luk: 0, att: 0, matt: 0, hp: 0 },
    ...p,
  };
}

const items: ItemsMaster = {
  meta: { source: 'test', asOf: '2026-10-12', minLevel: 100 },
  items: [
    item({ id: 1004422, name: 'アブソラブスハット', lv: 160, slot: 'hat', boss: 1 }),
    item({ id: 1004808, name: 'アーケインシェードハット', lv: 200, slot: 'hat', boss: 1 }),
    item({ id: 1005980, name: 'エテルネルナイトヘルム', lv: 250, slot: 'hat', boss: 1 }),
    item({
      id: 1213018,
      name: 'ジェネシス片手剣',
      lv: 200,
      slot: 'weapon',
      boss: 1,
      base: { str: 150, dex: 150, int: 0, luk: 0, att: 326, matt: 0, hp: 0 },
    }),
    item({ id: 1152170, name: 'スカーレットショルダー', lv: 140, slot: 'shoulder' }),
    item({ id: 1122076, name: 'カオスホーンテイルネックレス', lv: 120, slot: 'pendant' }),
    item({ id: 1113282, name: 'ゴールデンクローバーベルト', lv: 140, slot: 'belt' }),
    item({ id: 1113149, name: 'リストレイントリング', lv: 110, slot: 'ring' }),
    item({ id: 1113306, name: 'ガーディアンエンジェルリング', lv: 160, slot: 'ring' }),
  ],
};

const manifest: DataManifest = {
  version: 'abc123def0',
  generatedAt: '2026-10-12T00:00:00.000Z',
  files: { 'cubes.json': { sha: '40340a11', bytes: 5065, asOf: '2026-10-12' } },
};

function masterData(): MasterData {
  return {
    starforce: JSON.parse(raw.starforce) as StarforceMaster,
    cubes: JSON.parse(raw.cubes) as CubesMaster,
    cubeTables: JSON.parse(raw.cubeTables) as CubeTables,
    flame: JSON.parse(raw.flame) as FlameMaster,
    jobs: JSON.parse(raw.jobs) as JobsMaster,
    items,
    manifest,
  };
}

// ------------------------------------------------------------------ 1. zod
describe('schemas', () => {
  it.each([
    ['starforce', starforceSchema, raw.starforce],
    ['cubes', cubesSchema, raw.cubes],
    ['flame', flameSchema, raw.flame],
    ['jobs', jobsSchema, raw.jobs],
    ['cubeTables(seed)', cubeTablesSchema, raw.cubeTables],
    ['items(inline)', itemsSchema, JSON.stringify(items)],
    ['manifest(inline)', manifestSchema, JSON.stringify(manifest)],
    ['manifest(public)', manifestSchema, readText('public/data/manifest.json')],
  ])('%s が通る', (_name, schema, text) => {
    const r = schema.safeParse(JSON.parse(text));
    if (!r.success) throw new Error(describeZodError(r.error));
    expect(r.success).toBe(true);
  });

  it('余分なキーは残す(passthrough)', () => {
    const r = starforceSchema.parse(JSON.parse(raw.starforce)) as Record<string, unknown>;
    expect(r).toHaveProperty('unresolved');
  });

  it('壊れたデータは読めるエラーで落ちる', () => {
    const sf = readJson<Record<string, unknown>>('public/data/starforce.json');
    delete sf.probabilityBase;
    const r = starforceSchema.safeParse(sf);
    expect(r.success).toBe(false);
    if (r.success) return;
    const msg = describeZodError(r.error);
    expect(msg).toContain('probabilityBase');
    expect(msg).toContain('Required');
  });

  it('確率表の lines は3要素か null', () => {
    const ct = readJson<{ tables: Record<string, unknown[]> }>(
      'tests/fixtures/kms-cube-tables.seed.json',
    );
    ct.tables['black/legendary/hat'] = [{ minLv: 0, lines: [1, 2] }];
    const r = cubeTablesSchema.safeParse(ct);
    expect(r.success).toBe(false);
  });
});

// ------------------------------------------------------------------ 2. loader
type Served = Record<string, { status: number; body?: string }>;

function fakeFetch(served: Served) {
  const requested: string[] = [];
  const inits: (RequestInit | undefined)[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requested.push(url);
    inits.push(init);
    const key = url.replace('/jms-planner/data/', '').replace(/\?.*$/, '');
    const s = served[key] ?? { status: 404 };
    return new Response(s.body ?? 'not found', { status: s.status });
  }) as typeof fetch;
  return { impl, requested, inits };
}

function servedAll(): Served {
  return {
    'manifest.json': { status: 200, body: JSON.stringify(manifest) },
    'starforce.json': { status: 200, body: raw.starforce },
    'cubes.json': { status: 200, body: raw.cubes },
    'potential/kms-cube-tables.json': { status: 200, body: raw.cubeTables },
    'flame.json': { status: 200, body: raw.flame },
    'jobs.json': { status: 200, body: raw.jobs },
    'items.json': { status: 200, body: JSON.stringify(items) },
  };
}

describe('loader', () => {
  it('dataUrl', () => {
    expect(dataUrl('/jms-planner/', 'manifest.json', null)).toBe('/jms-planner/data/manifest.json');
    expect(dataUrl('/', 'potential/kms-cube-tables.json', 'a b')).toBe(
      '/data/potential/kms-cube-tables.json?v=a%20b',
    );
  });

  it('manifest を先に読み、version を付けて他を読む', async () => {
    const f = fakeFetch(servedAll());
    const { data, warnings } = await loadMasterData('/jms-planner/', { fetchImpl: f.impl });
    expect(f.requested[0]).toBe('/jms-planner/data/manifest.json');
    expect(f.inits[0]?.cache).toBe('no-cache');
    const v = `?v=${manifest.version}`;
    expect([...f.requested].sort()).toEqual(
      [
        '/jms-planner/data/manifest.json',
        `/jms-planner/data/starforce.json${v}`,
        `/jms-planner/data/cubes.json${v}`,
        `/jms-planner/data/potential/kms-cube-tables.json${v}`,
        `/jms-planner/data/flame.json${v}`,
        `/jms-planner/data/jobs.json${v}`,
        `/jms-planner/data/items.json${v}`,
      ].sort(),
    );
    expect(f.requested.every((u) => u.startsWith('/jms-planner/data/'))).toBe(true);
    expect(data.items.items).toHaveLength(items.items.length);
    expect(data.manifest.version).toBe(manifest.version);
    expect(data.jobs.jobs.length).toBe(50);
    // シード版の確率表は警告のみ
    expect(warnings.some((w) => w.includes('items.json'))).toBe(false);
  });

  it('items.json が 404 なら空の装備マスタ + 警告で続行', async () => {
    const s = servedAll();
    s['items.json'] = { status: 404 };
    const f = fakeFetch(s);
    const { data, warnings } = await loadMasterData('/jms-planner/', { fetchImpl: f.impl });
    expect(data.items).toEqual({ meta: { source: '', asOf: '', minLevel: 0 }, items: [] });
    expect(warnings.some((w) => w.includes('items.json'))).toBe(true);
  });

  it('manifest.json が 404 なら version=dev で続行', async () => {
    const s = servedAll();
    s['manifest.json'] = { status: 404 };
    const f = fakeFetch(s);
    const { data, warnings } = await loadMasterData('/jms-planner/', { fetchImpl: f.impl });
    expect(data.manifest.version).toBe('dev');
    expect(f.requested).toContain('/jms-planner/data/jobs.json?v=dev');
    expect(warnings.some((w) => w.includes('manifest.json'))).toBe(true);
  });

  it('starforce.json が 500 なら DataLoadError', async () => {
    const s = servedAll();
    s['starforce.json'] = { status: 500 };
    const f = fakeFetch(s);
    const p = loadMasterData('/jms-planner/', { fetchImpl: f.impl });
    await expect(p).rejects.toBeInstanceOf(DataLoadError);
    await expect(p).rejects.toMatchObject({ file: 'starforce.json' });
  });

  it('形式が不正なら DataLoadError(file 付き)', async () => {
    const s = servedAll();
    s['jobs.json'] = { status: 200, body: JSON.stringify({ _meta: {}, jobs: [{ id: 'x' }] }) };
    const f = fakeFetch(s);
    await expect(loadMasterData('/jms-planner/', { fetchImpl: f.impl })).rejects.toMatchObject({
      name: 'DataLoadError',
      file: 'jobs.json',
    });
  });

  it('manifest.json が 500 なら DataLoadError', async () => {
    const s = servedAll();
    s['manifest.json'] = { status: 500 };
    const f = fakeFetch(s);
    await expect(loadMasterData('/jms-planner/', { fetchImpl: f.impl })).rejects.toMatchObject({
      file: 'manifest.json',
    });
  });
});

// ------------------------------------------------------------------ 3-7. indexes
describe('indexes', () => {
  const ix = buildIndexes(masterData());

  it('基本の索引', () => {
    expect(ix.itemsById.get(1213018)?.base.att).toBe(326);
    expect(ix.itemsBySlot.get('ring')?.map((i) => i.lv)).toEqual([160, 110]);
    expect(ix.jobsById.get('hero')?.nameJa).toBe('ヒーロー');
    expect(ix.cubesById.get('neo')?.kmsEquivalent).toBe('red');
    const o = ix.optionById(0);
    expect(o).toBeDefined();
    expect(ix.optionByKr(o!.kr)).toBe(o);
    expect(ix.optionById(99999)).toBeUndefined();
  });

  it('cubeTable: red → black の代用', () => {
    const r = ix.cubeTable('red', 'legendary', 'weapon', 200);
    expect(r).not.toBeNull();
    expect(r!.usedCube).toBe('black');
    expect(r!.fallbackCube).toBe(true);
    expect(r!.fallbackPart).toBe(false);
    expect(r!.lines).toHaveLength(3);
  });

  it('cubeTable: overall はシードに表がある → 代用しない', () => {
    const r = ix.cubeTable('black', 'legendary', 'overall', 160);
    expect(r?.usedPart).toBe('overall');
    expect(r?.fallbackPart).toBe(false);
  });

  it('cubeTable: shield / forceShield → secondary', () => {
    const s = ix.cubeTable('black', 'legendary', 'shield', 160);
    expect(s?.usedPart).toBe('secondary');
    expect(s?.fallbackPart).toBe(true);
    expect(s?.fallbackCube).toBe(false);
    const f = ix.cubeTable('black', 'legendary', 'forceShield', 200);
    expect(f?.usedPart).toBe('secondary');
    expect(f?.fallbackPart).toBe(true);
  });

  it('cubeTable: red + shield は black + secondary', () => {
    const r = ix.cubeTable('red', 'unique', 'shield', 200);
    expect(r).toMatchObject({
      usedCube: 'black',
      usedPart: 'secondary',
      fallbackCube: true,
      fallbackPart: true,
    });
  });

  it('cubeTable: 帯の選択', () => {
    expect(ix.cubeTable('black', 'legendary', 'hat', 201)?.bandMinLv).toBe(201);
    expect(ix.cubeTable('black', 'legendary', 'hat', 200)?.bandMinLv).toBe(0);
    expect(ix.cubeTable('black', 'legendary', 'hat', 250)?.bandMinLv).toBe(201);
  });

  it('cubeTable: 表が無ければ null', () => {
    const empty = buildIndexes({
      ...masterData(),
      cubeTables: { meta: { asOf: '', note: '' }, options: [], lineDists: [], tables: {} },
    });
    expect(empty.cubeTable('black', 'legendary', 'hat', 160)).toBeNull();
    expect(empty.potentialOptionsFor('black', 'legendary', 'hat', 160)).toEqual([]);
    expect(empty.legendaryMainStatPct('hat', 160, 'STR')).toBeNull();
  });

  it('cubeTable: 帯の lines が null なら代用先へ', () => {
    const d = masterData();
    d.cubeTables.tables['black/legendary/overall'] = [{ minLv: 0, lines: null }];
    const r = buildIndexes(d).cubeTable('black', 'legendary', 'overall', 160);
    expect(r?.usedPart).toBe('top');
    expect(r?.fallbackPart).toBe(true);
  });

  it('potentialOptionsFor: 帽子レジェにクール減2秒、id 昇順で重複なし', () => {
    const opts = ix.potentialOptionsFor('black', 'legendary', 'hat', 160);
    expect(opts.some((o) => o.key === 'cdrSec' && o.value === 2)).toBe(true);
    const ids = opts.map((o) => o.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('legendaryMainStatPct', () => {
    expect(ix.legendaryMainStatPct('hat', 160, 'STR')).toBe(12);
    expect(ix.legendaryMainStatPct('hat', 201, 'STR')).toBe(13);
  });

  it('normalizeName', () => {
    expect(normalizeName('ｱｰｹｲﾝ')).toBe('あーけいん');
    expect(normalizeName('ＡＢＣ・ハット(JMS)！')).toBe('abc・はっとjms');
  });

  it('searchItems: ひらがな/カタカナ・半角全角を同一視', () => {
    expect(ix.searchItems('hat', 'あぶそ').map((i) => i.name)).toEqual(['アブソラブスハット']);
    expect(ix.searchItems('hat', 'ｱｰｹｲﾝ').map((i) => i.name)).toEqual(['アーケインシェードハット']);
  });

  it('searchItems: 部分一致は lv desc、前方一致が優先', () => {
    // エテルネルナイトヘルムは名前に「ハット」を含まない
    expect(ix.searchItems('hat', 'ハット').map((i) => i.lv)).toEqual([200, 160]);
    expect(ix.searchItems('hat', 'ト').map((i) => i.name)).toEqual([
      'エテルネルナイトヘルム',
      'アーケインシェードハット',
      'アブソラブスハット',
    ]);
    // 前方一致(lv110)が部分一致(lv160)より先
    expect(ix.searchItems('ring', 'り').map((i) => i.name)).toEqual([
      'リストレイントリング',
      'ガーディアンエンジェルリング',
    ]);
    expect(ix.searchItems('weapon', 'はっと')).toEqual([]);
  });

  it('searchItems: 空クエリは lv desc で limit 件', () => {
    expect(ix.searchItems('hat', '').map((i) => i.lv)).toEqual([250, 200, 160]);
    expect(ix.searchItems('hat', '  ', 2).map((i) => i.lv)).toEqual([250, 200]);
    expect(ix.searchItems('pocket', '')).toEqual([]);
  });

  it('isNonBossException / isFlameException', () => {
    expect(ix.isNonBossException('カオスホーンテイルネックレス')).toBe(true);
    expect(ix.isNonBossException('ホーンテイルネックレス')).toBe(true);
    expect(ix.isNonBossException('アブソラブスハット')).toBe(false);
    expect(ix.isFlameException('スカーレットショルダー')).toBe(true);
    expect(ix.isFlameException('ｽｶｰﾚｯﾄｼｮﾙﾀﾞｰ')).toBe(true);
    expect(ix.isFlameException('アブソラブスショルダー')).toBe(false);
  });
});
