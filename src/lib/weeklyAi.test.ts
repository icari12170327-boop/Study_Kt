import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
import { addDays } from './date';
import { buildWeeklyStats, weekRange } from './weeklyReport';
import { normalizeWeeklyAi, requestWeeklyAi, saveWeeklyAi } from './weeklyAi';

const ai = { goodKo: '꾸준히 했어요.', watchKo: '함께 살펴봐 주세요.', nextKo: '과학 문제를 함께 풀어 보세요.', createdAt: '2026-10-09T00:00:00.000Z' };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('주간 AI 저장 호환성', () => {
  it('기존 version 2에는 빈 선택 필드를 채우고 기록을 유지한다', () => {
    const old = defaultState(); delete old.data.kid1.weeklyAi;
    old.data.kid1.stars = 40;
    const next = normalizeState(old, '2026-10-09');
    expect(next.version).toBe(2); expect(next.data.kid1.weeklyAi).toEqual({}); expect(next.data.kid1.stars).toBe(40);
  });
  it('현재 주를 포함한 최근 12주만 남긴다', () => {
    const raw = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [addDays('2026-10-05', -i * 7), ai]));
    const result = normalizeWeeklyAi(raw, '2026-10-09');
    expect(Object.keys(result)).toHaveLength(12); expect(result['2026-07-20']).toEqual(ai); expect(result['2026-07-13']).toBeUndefined();
  });
  it('잘못된 주·미래·길이·생성 날짜와 추가 메타데이터를 정리한다', () => {
    expect(normalizeWeeklyAi({ '2026-10-06': ai, '2026-10-12': ai, '2026-02-30': ai, '2026-09-28': { ...ai, goodKo: 'a'.repeat(301) }, '2026-09-21': { ...ai, createdAt: '2026-02-30T00:00:00Z' }, '2026-10-05': { ...ai, raw: '삭제' } }, '2026-10-09')).toEqual({ '2026-10-05': ai });
    expect(normalizeWeeklyAi(null)).toEqual({}); expect(normalizeWeeklyAi([])).toEqual({});
  });
  it('AI 저장은 해당 프로필 weeklyAi만 바꾼다', () => {
    const state = defaultState(), before = structuredClone(state);
    saveWeeklyAi(state.data.kid1, '2026-10-05', ai, '2026-10-09');
    expect(state.data.kid1.weeklyAi).toEqual({ '2026-10-05': ai });
    state.data.kid1.weeklyAi = before.data.kid1.weeklyAi; expect(state).toEqual(before);
  });
  it('백업과 복원에서 주간 요약과 기존 학습 기록을 유지한다', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 9));
    const state = normalizeState(defaultState()); state.data.kid2.weeklyAi = { '2026-10-05': ai }; state.data.kid2.stars = 71;
    expect(importState(exportState(state))).toEqual(state);
  });
});
describe('주간 AI 요청', () => {
  const config = { endpoint: 'https://worker.example', token: 't'.repeat(32) };
  const stats = buildWeeklyStats(defaultState(), 'kid1', weekRange('2026-10-09'));
  it('함수를 호출했을 때 한 번만 보호자 숫자 요약을 보내고 결과를 반환한다', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => { void _url; void _init; return Response.json({ ok: true, data: ai }); }); vi.stubGlobal('fetch', fetch);
    const state = defaultState(), before = structuredClone(state);
    const result = await requestWeeklyAi(config, stats, 'g5');
    expect(fetch).toHaveBeenCalledTimes(1); expect(result.goodKo).toBe(ai.goodKo);
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string);
    expect(body.profileId).toBe('parent'); expect(body.input.level).toBe('g5'); expect(body.input.stats.talk.highlights).toEqual([]);
    expect(state).toEqual(before);
  });
  it.each([Response.json({ ok: true, data: { ...ai, goodKo: 'a'.repeat(301) } }), Response.json({ error: 'limit' }, { status: 429 })])('잘못된 결과나 한도 초과는 저장하지 않고 실패한다', async response => {
    vi.stubGlobal('fetch', vi.fn(async () => response.clone()));
    await expect(requestWeeklyAi(config, stats, 'g5')).rejects.toThrow();
  });
});
