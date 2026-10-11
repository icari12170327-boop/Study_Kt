import type { AppState } from '../types';
import { applyProgress } from './progress';
import { aiReady } from './talk';
/** 선택 보호자 미션만 하루 한 번 진행한다. 아이와 별·수학 기록에는 관여하지 않는다. */
export function applyOpicProgress(state: AppState, today: string): void {
  const data = state.data.parent, settings = state.settings.parent;
  if (!settings.missions.some(m => m.type === 'opic' && m.enabled) || (data.days[today]?.progress.opic ?? 0) >= 1) return;
  applyProgress(data, settings, today, { type: 'opic', amount: 1 }, { profileId: 'parent', aiReady: aiReady(state.ai) });
}
