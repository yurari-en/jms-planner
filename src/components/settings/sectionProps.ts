import type { MasterData } from '../../data/types';
import type { PlannerSettings } from '../../domain/settings';

export interface SectionProps {
  /** 現在の設定 */
  s: PlannerSettings;
  /** 既定値 */
  d: PlannerSettings;
  data: MasterData;
}
