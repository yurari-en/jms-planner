// メインスレッド側のプランナー呼び出し。Worker があれば Worker(Comlink)、
// 無い環境(テスト・SSR)では同じインターフェースで同スレッド実行する。
import * as Comlink from 'comlink';
import type { MasterData } from '../data/types';
import type { CharacterInput } from '../domain/character';
import type { FlameRankResult, PlanResult, PlanWarning } from '../domain/planTypes';
import { createPlannerService } from '../domain/planner';
import type { PlannerSettings } from '../domain/settings';
import type { PlannerApi } from './plan.worker';

export interface PlannerClient {
  setMasterData(data: MasterData): Promise<void>;
  buildPlan(ch: CharacterInput, settings: PlannerSettings): Promise<PlanResult>;
  rankFlames(ch: CharacterInput, settings: PlannerSettings): Promise<FlameRankResult>;
  validate(ch: CharacterInput, settings: PlannerSettings): Promise<PlanWarning[]>;
  terminate(): void;
}

function createWorkerClient(): PlannerClient {
  const worker = new Worker(new URL('./plan.worker.ts', import.meta.url), { type: 'module' });
  const remote = Comlink.wrap<PlannerApi>(worker);
  return {
    setMasterData: (data) => remote.setMasterData(data),
    buildPlan: (ch, settings) => remote.buildPlan(ch, settings),
    rankFlames: (ch, settings) => remote.rankFlames(ch, settings),
    validate: (ch, settings) => remote.validate(ch, settings),
    terminate: () => {
      remote[Comlink.releaseProxy]();
      worker.terminate();
    },
  };
}

/** Worker の無い環境用。同じ計算を同スレッドで行う(結果は Promise で返す) */
export function createInThreadClient(): PlannerClient {
  const service = createPlannerService();
  const run = <T>(f: () => T): Promise<T> => {
    try {
      return Promise.resolve(f());
    } catch (e) {
      return Promise.reject(e);
    }
  };
  return {
    setMasterData: (data) => run(() => service.setMasterData(data)),
    buildPlan: (ch, settings) => run(() => service.buildPlan(ch, settings)),
    rankFlames: (ch, settings) => run(() => service.rankFlames(ch, settings)),
    validate: (ch, settings) => run(() => service.validate(ch, settings)),
    terminate: () => {},
  };
}

export function createPlannerClient(): PlannerClient {
  return typeof Worker !== 'undefined' ? createWorkerClient() : createInThreadClient();
}
