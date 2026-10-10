// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Home } from './Home';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { emptyDay } from '../lib/progress';
import type { ProfileId } from '../types';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 10, 10, 42, 50)); localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); localStorage.clear(); });
async function mount(profileId: ProfileId, stamp?: string) {
  const state = defaultState(); state.settings[profileId].missions = state.settings[profileId].missions.map(m => ({ ...m, enabled: m.type === 'math', ...(m.type === 'math' ? { target: 2 } : {}) }));
  state.data[profileId].days['2026-10-10'] = { ...emptyDay('2026-10-10'), progress: { math: 2 }, completed: true, ...(stamp ? { completedAt: stamp } : {}) };
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(Home, { profileId, go: vi.fn() }))));
}
it('아이 카드에 이름·실제 요일·첫 완료 시각·현재 분·끝낸 미션을 함께 표시한다', async () => {
  await mount('kid1', '10:40'); const card = host.querySelector('.completion-card')!;
  expect(card.textContent).toContain('오늘 학습 완료 ✅'); expect(card.textContent).toContain(defaultState().profiles[0].name);
  expect(card.textContent).toContain('2026-10-10 (토)'); expect(card.textContent).toContain('10:40 완료'); expect(card.textContent).toContain('지금 시각 10:42'); expect(card.textContent).toContain('🔢 수학 도전 2문제'); expect(card.textContent).toContain(`쿠폰을 받았어요: ${defaultState().settings.kid1.rewardLabel}`);
  const before = localStorage.getItem('study-kt:v1'); await act(async () => vi.advanceTimersByTime(10000)); expect(card.textContent).toContain('지금 시각 10:43'); expect(card.textContent).toContain('10:40 완료'); expect(localStorage.getItem('study-kt:v1')).toBe(before);
  await act(async () => root.render(null)); expect(vi.getTimerCount()).toBe(0);
});
it('예전 아이 기록은 완료 시각을 추정하지 않고 보호자에는 새 카드를 표시하지 않는다', async () => {
  await mount('kid2'); expect(host.querySelector('.completion-card')).not.toBeNull(); expect(host.querySelector('.completion-times')!.textContent).not.toContain('완료');
  await act(async () => root.render(null)); await mount('parent', '10:40'); expect(host.querySelector('.completion-card')).toBeNull();
});
it('자정에 오늘 기록으로 바뀌고 이전 완료 캡처 카드가 남지 않는다', async () => {
  vi.setSystemTime(new Date(2026, 9, 10, 23, 59, 50)); await mount('kid1', '10:40'); expect(host.querySelector('.completion-card')).not.toBeNull();
  await act(async () => vi.advanceTimersByTime(10000)); expect(host.querySelector('.completion-card')).toBeNull();
});
