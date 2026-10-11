// 静的マスタの読み込み。DESIGN.md §4.1。React / DOM に依存しない(fetch は注入可能)。
import type { z } from 'zod';
import {
  cubeTablesSchema,
  cubesSchema,
  describeZodError,
  flameSchema,
  itemsSchema,
  jobsSchema,
  manifestSchema,
  starforceSchema,
} from './schemas';
import type {
  CubeTables,
  CubesMaster,
  DataManifest,
  FlameMaster,
  ItemsMaster,
  JobsMaster,
  MasterData,
  StarforceMaster,
} from './types';

export class DataLoadError extends Error {
  constructor(
    public file: string,
    message: string,
    public cause?: unknown,
  ) {
    super(`${file}: ${message}`);
    this.name = 'DataLoadError';
  }
}

export interface LoadOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface LoadResult {
  data: MasterData;
  warnings: string[];
}

export const DATA_FILES = {
  starforce: 'starforce.json',
  cubes: 'cubes.json',
  cubeTables: 'potential/kms-cube-tables.json',
  flame: 'flame.json',
  jobs: 'jobs.json',
  items: 'items.json',
  manifest: 'manifest.json',
} as const;

export function dataUrl(baseUrl: string, file: string, version: string | null): string {
  return `${baseUrl}data/${file}` + (version ? `?v=${encodeURIComponent(version)}` : '');
}

type FetchOutcome = { ok: true; json: unknown } | { ok: false; status: number };

async function fetchJson(
  fetchImpl: typeof fetch,
  file: string,
  url: string,
  init: RequestInit,
): Promise<FetchOutcome> {
  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch (e) {
    if (init.signal?.aborted) throw e;
    throw new DataLoadError(file, '通信に失敗しました', e);
  }
  if (!res.ok) return { ok: false, status: res.status };
  try {
    return { ok: true, json: (await res.json()) as unknown };
  } catch (e) {
    if (init.signal?.aborted) throw e;
    throw new DataLoadError(file, 'JSON として読めません', e);
  }
}

function validate<T>(file: string, schema: z.ZodTypeAny, json: unknown): T {
  const r = schema.safeParse(json);
  if (!r.success) {
    throw new DataLoadError(file, `形式が不正です\n${describeZodError(r.error)}`, r.error);
  }
  // スキーマは最低限の形だけを検証し、残りのキーは passthrough で通す
  return r.data as T;
}

function httpError(file: string, status: number): DataLoadError {
  return new DataLoadError(file, `読み込みに失敗しました(HTTP ${status})`);
}

/**
 * manifest.json を先に読み(cache: 'no-cache')、その version を `?v=` に付けて他のファイルを並列に読む。
 * - manifest.json が 404: version='dev' で続行し warnings に入れる
 * - items.json が 404: 空の装備マスタで続行し warnings に入れる
 * - それ以外の失敗: DataLoadError
 */
export async function loadMasterData(baseUrl: string, opts: LoadOptions = {}): Promise<LoadResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const signal = opts.signal;
  const warnings: string[] = [];

  // ---- manifest
  const mf = DATA_FILES.manifest;
  const mRes = await fetchJson(fetchImpl, mf, dataUrl(baseUrl, mf, null), {
    cache: 'no-cache',
    signal,
  });
  let manifest: DataManifest;
  if (mRes.ok) {
    manifest = validate<DataManifest>(mf, manifestSchema, mRes.json);
  } else if (mRes.status === 404) {
    manifest = { version: 'dev', generatedAt: '', files: {} };
    warnings.push(
      'manifest.json が見つかりません。開発用のバージョン(dev)で読み込みました(キャッシュが更新されない場合があります)。',
    );
  } else {
    throw httpError(mf, mRes.status);
  }
  const version = manifest.version;

  // ---- 本体(並列)
  const load = async <T>(file: string, schema: z.ZodTypeAny): Promise<T> => {
    const r = await fetchJson(fetchImpl, file, dataUrl(baseUrl, file, version), { signal });
    if (!r.ok) throw httpError(file, r.status);
    return validate<T>(file, schema, r.json);
  };
  const loadItems = async (): Promise<ItemsMaster> => {
    const file = DATA_FILES.items;
    const r = await fetchJson(fetchImpl, file, dataUrl(baseUrl, file, version), { signal });
    if (r.ok) return validate<ItemsMaster>(file, itemsSchema, r.json);
    if (r.status === 404) {
      warnings.push(
        '装備マスタ(items.json)が見つかりません。装備検索は使えません(手入力は可能です)。`npm run data:items` で生成してください。',
      );
      return { meta: { source: '', asOf: '', minLevel: 0 }, items: [] };
    }
    throw httpError(file, r.status);
  };

  const [starforce, cubes, cubeTables, flame, jobs, items] = await Promise.all([
    load<StarforceMaster>(DATA_FILES.starforce, starforceSchema),
    load<CubesMaster>(DATA_FILES.cubes, cubesSchema),
    load<CubeTables>(DATA_FILES.cubeTables, cubeTablesSchema),
    load<FlameMaster>(DATA_FILES.flame, flameSchema),
    load<JobsMaster>(DATA_FILES.jobs, jobsSchema),
    loadItems(),
  ]);

  if (cubeTables.meta.seed) {
    warnings.push(
      'キューブ確率表がシード版です。レッド(ネオキューブ)はブラックの表で代用しています(`npm run data:cubes` で完全版に更新できます)。',
    );
  }

  return {
    data: { starforce, cubes, cubeTables, flame, jobs, items, manifest },
    warnings,
  };
}
