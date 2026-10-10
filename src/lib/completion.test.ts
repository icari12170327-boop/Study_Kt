import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultSettings, defaultState, emptyProfileData } from '../store/defaults';
import { emptyDay, applyProgress } from './progress';
import { minuteTime, validMinuteTime } from './date';
import { recordTalkSeconds } from './talk';
import { exportState, importState, normalizeState } from '../store/storage';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 10, 10, 42)); });
afterEach(() => vi.useRealTimers());
const settings = { ...defaultSettings('g3'), missions: [{ type: 'math' as const, enabled: true, target: 2 }] };
it.each(['kid1', 'kid2'] as const)('%s 처음 완료할 때만 실제 시각을 남기고 보상은 종전처럼 한 번 지급한다', profileId => {
  const data = emptyProfileData(); data.lastCompleted = '2026-10-09'; data.streak = 4;
  applyProgress(data, settings, '2026-10-10', { type: 'math', correct: 1, total: 1 }, { aiReady: false, profileId });
  expect(data.days['2026-10-10'].completedAt).toBeUndefined();
  expect(applyProgress(data, settings, '2026-10-10', { type: 'math', correct: 1, total: 1 }, { aiReady: false, profileId }).justCompleted).toBe(true);
  expect(data.days['2026-10-10'].completedAt).toBe('10:42'); expect(data.stars).toBe(2); expect(data.streak).toBe(5); expect(data.coupons).toHaveLength(1);
  vi.setSystemTime(new Date(2026, 9, 10, 11, 59)); applyProgress(data, settings, '2026-10-10', { type: 'math', correct: 1, total: 1 }, { aiReady: false, profileId });
  expect(data.days['2026-10-10'].completedAt).toBe('10:42'); expect(data.stars).toBe(3); expect(data.streak).toBe(5); expect(data.coupons).toHaveLength(1);
});
it('보호자 완료·선택 실험 별 지급에는 시각을 만들지 않는다', () => {
  const data = emptyProfileData('adult'); applyProgress(data, settings, '2026-10-10', { type: 'math', amount: 2 }, { aiReady: false, profileId: 'parent' });
  expect(data.days['2026-10-10'].completedAt).toBeUndefined();
  const child = emptyProfileData(); applyProgress(child, settings, '2026-10-10', { type: 'science', stars: 1, rewardOnly: true }, { aiReady: false, profileId: 'kid1' });
  expect(child.days).toEqual({}); expect(child.stars).toBe(1);
});
it('이전 완료 기록은 다시 풀거나 목표를 늘려도 추정한 시각을 넣지 않는다', () => {
  const data = emptyProfileData(); data.days['2026-10-10'] = { ...emptyDay('2026-10-10'), completed: true, progress: { math: 2 } };
  applyProgress(data, settings, '2026-10-10', { type: 'math' }, { aiReady: false, profileId: 'kid1' });
  expect(data.days['2026-10-10'].completedAt).toBeUndefined(); expect(data.coupons).toEqual([]);
});
it('초 누적 대화가 마지막 미션이어도 같은 진행 처리에서 완료 시각을 기록한다', () => {
  const data = emptyProfileData(), talkSettings = { ...settings, missions: [{ type: 'talk' as const, enabled: true, target: 1 }] };
  recordTalkSeconds(data, talkSettings, '2026-10-10', 59, true, 'kid1'); expect(data.days['2026-10-10'].completedAt).toBeUndefined();
  recordTalkSeconds(data, talkSettings, '2026-10-10', 1, true, 'kid1'); expect(data.days['2026-10-10'].completedAt).toBe('10:42');
});
it('HH:MM 검증·부모 제외·version 2 백업 왕복에서 기존 기록과 보상이 유지된다', () => {
  const state = defaultState(), date = '2026-10-10'; state.data.kid1.days[date] = { ...emptyDay(date), completed: true, completedAt: '00:00' };
  state.data.parent.days[date] = { ...emptyDay(date), completed: true, completedAt: '10:42' };
  const normalized = normalizeState(state, date); expect(normalized.data.parent.days[date].completedAt).toBeUndefined();
  const restored = importState(exportState(normalized)); expect(restored.version).toBe(2); expect(restored).toEqual(normalized);
  for (const value of ['23:59', '00:00', '10:42']) expect(validMinuteTime(value)).toBe(true);
  for (const value of ['24:00', '12:60', '1:02', '10:2', '10:42:00', '', 1042, null, ' 10:42', '10:42\n']) {
    expect(validMinuteTime(value)).toBe(false); state.data.kid1.days[date].completedAt = value as string;
    expect(normalizeState(state, date).data.kid1.days[date]).not.toHaveProperty('completedAt');
  }
  state.data.kid1.days[date].completed = false; state.data.kid1.days[date].completedAt = '10:42'; expect(normalizeState(state, date).data.kid1.days[date]).not.toHaveProperty('completedAt');
  expect(minuteTime(new Date(2026, 9, 10, 8, 3))).toBe('08:03');
});
