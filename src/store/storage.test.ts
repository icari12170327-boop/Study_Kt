import { describe, expect, it } from 'vitest';
import { defaultState } from './defaults';
import { exportState, importState, normalizeState } from './storage';
import { emptyDay } from '../lib/progress';
import { SKILL_MAP } from '../content/math/skills';

describe('수학 도전 저장 호환', () => {
  it('초3=3·초5=4와 기본 하루 20문제를 준비한다', () => {
    const state = defaultState();
    expect(state.data.kid1.math).toEqual({ level: 4, history: [] });
    expect(state.data.kid2.math).toEqual({ level: 3, history: [] });
    for (const id of ['kid1', 'kid2'] as const) {
      expect(state.settings[id].missions.find((mission) => mission.type === 'math')?.target).toBe(20);
    }
  });
  it('1단계 별·오답·쿠폰·진행·단원 통계와 보호자가 저장한 목표를 모두 보존한다', () => {
    const oldDay = {
      ...emptyDay('2026-10-01'),
      progress: { math: 12 },
      mathBySkill: { 'g3-add3': { correct: 8, total: 12 } },
    };
    const legacyDay: Partial<typeof oldDay> = { ...oldDay };
    delete legacyDay.mathAttempts;
    const raw = {
      version: 1,
      data: {
        kid2: {
          stars: 35,
          streak: 3,
          wrongNotes: [
            { id: 'legacy', problem: SKILL_MAP['g3-add3'].generate(() => 0.5), addedAt: '2026-10-01', given: '0' },
          ],
          coupons: [{ id: 'coupon', label: '기존 보상', earnedAt: '2026-10-01' }],
          days: { '2026-10-01': legacyDay },
        },
      },
      settings: { kid2: { missions: [{ type: 'math', enabled: true, target: 15 }] } },
    };
    const before = structuredClone(raw);
    const restored = normalizeState(raw);
    expect(raw).toEqual(before);
    expect(restored.data.kid2).toMatchObject({
      stars: 35,
      streak: 3,
      wrongNotes: raw.data.kid2.wrongNotes,
      coupons: raw.data.kid2.coupons,
      math: { level: 3, history: [] },
    });
    expect(restored.data.kid2.days['2026-10-01']).toEqual(oldDay);
    expect(restored.settings.kid2.missions[0].target).toBe(15);
  });
  it('부분 수학 상태를 보완하고 저장된 학년에 맞는 레벨 기본값을 사용한다', () => {
    const state = normalizeState({
      version: 1,
      profiles: [{ id: 'kid1', level: 'g3' }],
      data: { kid1: { math: { lastEvaluated: '2026-10-01' } }, kid2: { math: { level: 100, history: null } } },
    });
    expect(state.data.kid1.math).toEqual({ level: 3, lastEvaluated: '2026-10-01', history: [] });
    expect(state.data.kid2.math.level).toBe(9);
    expect(state.data.kid2.math.history).toEqual([]);
    expect(normalizeState({ version: 1, data: { kid1: { math: { level: NaN } } } }).data.kid1.math.level).toBe(4);
  });
  it('새 레벨 이력·시도·평가 날짜를 백업과 복원 후에도 유지한다', () => {
    const state = defaultState();
    state.data.kid1.math = {
      level: 5,
      lastEvaluated: '2026-10-06',
      history: [{ date: '2026-10-07', level: 5, counted: 20, correct: 19, guesses: 1, medianSec: 12.5 }],
    };
    state.data.kid1.days['2026-10-06'] = {
      ...emptyDay('2026-10-06'),
      mathAttempts: [
        { skill: 'g5-frac-add', correct: true, activeMs: 12500, guessed: false },
        { skill: 'g5-frac-add', correct: false, activeMs: 500, guessed: true },
      ],
    };
    expect(importState(exportState(state))).toEqual(state);
  });
});

describe('AI 설정과 백업', () => {
  it('구형 기록에는 AI 기본값을 채우고 기기 저장 토큰은 보존한다', () => {
    const state = defaultState();
    const raw = { ...state, ai: undefined };
    expect(normalizeState(raw).ai).toEqual({});
    state.ai = { endpoint: 'https://worker.example', token: 'local-family-token' };
    expect(normalizeState(state).ai).toEqual(state.ai);
  });
  it('백업에서 토큰을 제외하고 복원 시 외부 파일의 토큰도 가져오지 않는다', () => {
    const state = defaultState();
    state.ai = { endpoint: 'https://worker.example', token: 'local-family-token' };
    const text = exportState(state);
    expect(text).not.toContain('local-family-token');
    expect(JSON.parse(text).ai).not.toHaveProperty('token');
    expect(state.ai.token).toBe('local-family-token');
    expect(importState(text).ai.endpoint).toBe('https://worker.example');
    expect(importState(JSON.stringify(state)).ai.token).toBeUndefined();
    expect(importState(text).data).toEqual(state.data);
  });
});
