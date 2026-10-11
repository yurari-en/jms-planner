// 強化順序・炎ランキングの計算を行う Web Worker(DESIGN.md §6.5)。DOM は使わない。
import * as Comlink from 'comlink';
import type { MasterData } from '../data/types';
import type { CharacterInput } from '../domain/character';
import type { FlameRankResult, PlanResult, PlanWarning } from '../domain/planTypes';
import { createPlannerService } from '../domain/planner';
import type { PlannerSettings } from '../domain/settings';

const service = createPlannerService();

const api = {
  /** マスタを受け取り、索引(PlanContext)を作って保持する */
  setMasterData(data: MasterData): void {
    service.setMasterData(data);
  },
  /** setMasterData の前に呼ぶと例外 */
  buildPlan(ch: CharacterInput, settings: PlannerSettings): PlanResult {
    return service.buildPlan(ch, settings);
  },
  rankFlames(ch: CharacterInput, settings: PlannerSettings): FlameRankResult {
    return service.rankFlames(ch, settings);
  },
  validate(ch: CharacterInput, settings: PlannerSettings): PlanWarning[] {
    return service.validate(ch, settings);
  },
};

export type PlannerApi = typeof api;

Comlink.expose(api);
