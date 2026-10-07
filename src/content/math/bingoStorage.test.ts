import { describe, expect, it } from 'vitest';
import { defaultState } from '../../store/defaults';
import { exportState, importState, normalizeState } from '../../store/storage';
import { recordBingo } from './bingo';
import type { BingoRecord } from '../../types';

const rec: BingoRecord = { date: '2026-10-07', level: 'g5', limitSec: 120, found: 9, bingos: 1, hints: 2 };
describe('빙고 선택 필드와 기존 데이터 호환', () => {
  it.each([1, 2])('버전 %i의 빙고 없는 기록을 보존하고 기본값을 채운다', version => {
    const raw = { ...defaultState(), version };
    for (const pid of ['kid1', 'kid2', 'parent'] as const) {
      delete raw.settings[pid].bingo; delete raw.data[pid].bingo;
    }
    raw.data.kid1.stars = 42; raw.data.kid1.streak = 7;
    raw.data.kid1.days['2026-10-06'] = { date: '2026-10-06', progress: { math: 20 }, completed: true, correct: 20, total: 20, mathBySkill: {}, mathAttempts: [] };
    raw.data.kid1.coupons = [{ id: 'keep', label: '쿠폰', earnedAt: '2026-10-06' }];
    const normalized = normalizeState(raw);
    expect(normalized.version).toBe(2);
    expect(normalized.settings.kid1.bingo).toEqual({ enabled: true, productMix: 'normal', limitSec: 120 });
    expect(normalized.settings.kid2.bingo).toEqual({ enabled: true, productMix: 'off', limitSec: 180 });
    expect(normalized.settings.parent.bingo?.enabled).toBe(false);
    expect(normalized.data.kid1.bingo).toEqual({ recent: [], best: {} });
    expect(normalized.data.kid1.stars).toBe(42); expect(normalized.data.kid1.streak).toBe(7);
    expect(normalized.data.kid1.days['2026-10-06'].completed).toBe(true);
    expect(normalized.data.kid1.coupons).toEqual(raw.data.kid1.coupons);
  });
  it('잘못된 백업 필드와 숫자를 버리고 정상 기록·꺼 둔 설정을 유지한다', () => {
    const raw = JSON.parse(exportState(defaultState()));
    raw.settings.kid1.bingo = { enabled: false, limitSec: 77, productMix: 'broken' };
    raw.settings.kid2.bingo = { enabled: true, limitSec: -3, productMix: 'many' };
    raw.data.kid1.bingo = { recent: [null, rec, { ...rec, hints: -1 }, { ...rec, found: 1.5 }, { ...rec, bingos: '2' }, { ...rec, limitSec: null }], best: [] };
    raw.data.kid2.bingo = 'broken';
    const normalized = importState(JSON.stringify(raw));
    expect(normalized.data.kid1.bingo).toEqual({ recent: [rec], best: {} });
    expect(normalized.settings.kid1.bingo).toEqual({ enabled: false, limitSec: 120, productMix: 'normal' });
    expect(normalized.settings.kid2.bingo).toEqual({ enabled: true, limitSec: 180, productMix: 'off' });
    expect(normalized.data.kid2.bingo).toEqual({ recent: [], best: {} });
  });
  it('최근 20개와 제한 시간별 최고 기록을 백업·복원하고 다른 학습 기록은 바꾸지 않는다', () => {
    const state = defaultState(), before = structuredClone(state);
    for (let i = 0; i < 25; i++) recordBingo(state.data.kid1, { ...rec, found: i });
    recordBingo(state.data.kid1, { ...rec, limitSec: 180, found: 2 });
    const restored = importState(exportState(state));
    expect(restored).toEqual(state); expect(restored.version).toBe(2);
    expect(restored.data.kid1.bingo?.recent).toHaveLength(20);
    expect(restored.data.kid1.bingo?.best['120'].found).toBe(24);
    expect(restored.data.kid1.bingo?.best['180'].found).toBe(2);
    const others = structuredClone(restored.data.kid1), old = structuredClone(before.data.kid1);
    delete others.bingo; delete old.bingo;
    expect(others).toEqual(old);
  });
});
