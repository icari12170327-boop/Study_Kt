import { describe, expect, it, vi } from 'vitest';
import { filterCorrections, focusParts, isCorrections, normalizeCorrections, normalizeReviewResult, saveCorrection, selfFixed } from './talkCorrections';
import { addCorrectionTarget, normalizeRetrieval, pickReviewTargets, reusedExpression, updateRetrieval } from './retrieval';
import { defaultState } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
import { seededRng } from './random';
import { addDays } from './date';
import type { RetrievalItem, TalkLog } from '../types';
const today = '2026-10-10';
const item = { said: 'I go yesterday.', better: 'I went yesterday.', focus: 'went', whyKo: '지난 일이에요.', hintKo: '언제 한 일인가요?', pattern: 'tense' as const };
const result = { items: [item], praiseKo: '뜻을 잘 전했어요.', createdAt: today };
const target = (patch: Partial<RetrievalItem> = {}): RetrievalItem => ({ id: 'retr-1', text: 'I went yesterday.', mode: 'coach', source: 'correction', stage: 0, misses: 0, createdAt: '2026-10-01', dueDate: today, ...patch });
const log: TalkLog = { id: 'talk-1', date: today, mode: 'coach', seconds: 60, englishRatio: 1, lines: [{ role: 'kid', text: item.said, at: 1 }], corrections: result, reviewResult: { targets: [item.better], reused: [] } };
describe('오늘의 교정 안전 검증·직접 고침', () => {
  it('앱에서도 출력 형식·길이·열거값과 인용·핵심 부분을 확인한다', () => {
    expect(isCorrections(result)).toBe(true);
    for (const raw of [null, {}, { ...result, items: Array(4).fill(item) }, { ...result, items: [{ ...item, focus: 'a'.repeat(41) }] }, { ...result, items: [{ ...item, pattern: 'wrong' }] }, { ...result, praiseKo: '' }]) expect(isCorrections(raw)).toBe(false);
    expect(filterCorrections({ ...result, items: [item, { ...item, said: 'AI said this' }, { ...item, focus: 'will go' }] }, [item.said]).items).toEqual([item]);
    expect(normalizeCorrections({ ...result, createdAt: '2026-02-30' }, [item.said])).toBeUndefined();
    expect(normalizeCorrections(result, [])?.items).toEqual([]);
    expect(normalizeReviewResult({ targets: [item.better], reused: ['invented'] })).toBeUndefined();
  });
  it('공백·대소문자·구두점·축약형은 허용하고 핵심 교정 누락·단어 순서·과한 추가는 거부한다', () => {
    expect(selfFixed(item, '  I WENT yesterday! ')).toBe(true);
    for (const answer of ['I go yesterday.', 'yesterday went I', '', 'I went yesterday but I never did and I do not agree']) expect(selfFixed(item, answer)).toBe(false);
    expect(selfFixed({ ...item, better: 'I am working today.', focus: 'am working' }, "I'm working today.")).toBe(true);
    const long = { ...item, better: 'I have worked here for a very long time now.', focus: 'have worked' };
    expect(selfFixed(long, 'I have worked here for a long time now.')).toBe(true);
    expect(selfFixed(long, 'I have worked here for long time now.')).toBe(false);
    expect(selfFixed(long, 'I work here for a very long time now.')).toBe(false);
    expect(focusParts(item.better, item.focus)).toEqual(['I ', 'went', ' yesterday.']);
  });
});
describe('다시 꺼내기 간격 반복', () => {
  it('오늘까지 만기인 항목 중 같은 모드·오래 밀린 순으로 최대 두 개를 고른다', () => {
    const values = [target({ id: 'biz-old', mode: 'biz', dueDate: '2026-10-01' }), target({ id: 'future', dueDate: '2026-10-11' }), target({ id: 'coach-new', dueDate: '2026-10-09' }), target({ id: 'learned', stage: 3, learnedAt: today }), target({ id: 'coach-old', dueDate: '2026-10-03' })];
    const before = structuredClone(values);
    expect(pickReviewTargets(values, today, 'coach').map(row => row.id)).toEqual(['coach-old', 'coach-new']);
    expect(pickReviewTargets(values, today).map(row => row.id)).toEqual(['biz-old', 'coach-old']);
    expect(values).toEqual(before);
  });
  it('직접 말한 표현만 1·3·7일로 올리고 stage 3 성공은 익힘으로 남긴다', () => {
    let current = target();
    for (const [stage, interval] of [[1, 1], [2, 3], [3, 7]] as const) {
      const updated = updateRetrieval([current], [current], ['Yes, I went yesterday. Thank you.'], today);
      expect(updated.result).toEqual({ targets: [item.better], reused: [item.better] });
      expect(updated.items[0]).toMatchObject({ stage, misses: 0, dueDate: addDays(today, interval) }); current = updated.items[0];
    }
    expect(updateRetrieval([current], [current], [item.better], today).items[0].learnedAt).toBe(today);
    expect(reusedExpression('I am working today.', ["Yes, I'm working today!"])).toBe(true);
    expect(reusedExpression(item.better, ['I go yesterday.'])).toBe(false);
    expect(reusedExpression(item.better, ['I went', 'yesterday.'])).toBe(false);
    expect(reusedExpression(item.better, ['yesterday I went'])).toBe(false);
  });
  it('못 말하면 다음 날로 미루고 세 번 연속부터 일주일, 성공하면 실패 횟수를 초기화한다', () => {
    let current = target({ stage: 2 });
    for (let misses = 1; misses <= 4; misses++) {
      const updated = updateRetrieval([current], [current], [], today);
      expect(updated.items[0]).toMatchObject({ stage: 2, misses, dueDate: addDays(today, misses >= 3 ? 7 : 1) }); current = updated.items[0];
    }
    expect(updateRetrieval([current], [current], [item.better], today).items[0].misses).toBe(0);
    const untouched = target({ id: 'other' });
    expect(updateRetrieval([current, untouched], [current], [], today).items[1]).toEqual(untouched);
    expect(untouched).toEqual(target({ id: 'other' }));
  });
  it('새 표현은 다음 날 stage 0으로 넣고 재저장해도 간격을 되돌리지 않는다', () => {
    const rows = addCorrectionTarget([], item.better, 'coach', '2026-12-31', 'new');
    expect(rows[0]).toMatchObject({ stage: 0, dueDate: '2027-01-01', createdAt: '2026-12-31' });
    const existing = target({ stage: 2 });
    expect(addCorrectionTarget([existing], 'I WENT yesterday!', 'biz', today, 'other')).toEqual([existing]);
  });
});
describe('저장 정규화·백업·분리', () => {
  it('형식·날짜·길이·중복·최대 60개·30일 경계를 정규화한다', () => {
    for (const patch of [{ text: 12 }, { id: '' }, { text: 'a'.repeat(161) }, { dueDate: '2026-02-30' }, { createdAt: 'bad' }, { stage: 4 }, { stage: '1' }, { misses: -1 }, { misses: 1.5 }, { source: 'bad' }, { mode: 'kid' }, { learnedAt: 'bad' }]) expect(normalizeRetrieval([{ ...target(), ...patch }], today)).toEqual([]);
    expect(normalizeRetrieval([target(), target()], today)).toHaveLength(1);
    expect(normalizeRetrieval(Array.from({ length: 70 }, (_, i) => target({ id: `id-${i}`, text: `I like tea ${i}.` })), today)).toHaveLength(60);
    expect(normalizeRetrieval([target({ stage: 3, createdAt: '2026-08-01', learnedAt: '2026-09-10' })], today)).toEqual([]);
    expect(normalizeRetrieval([target({ stage: 3, createdAt: '2026-08-01', learnedAt: '2026-09-11' })], today)).toHaveLength(1);
  });
  it('version 2·기존 기록·아이 기록을 유지하고 보호자만 새 선택 필드를 복원한다', () => {
    const raw = defaultState(); raw.data.parent.talks = [log]; raw.data.parent.retrieval = [target()];
    raw.data.kid1.talks = [{ ...log, mode: undefined, corrections: undefined, reviewResult: undefined }];
    const oldChild = structuredClone(raw.data.kid1);
    const normalized = normalizeState(raw, today);
    expect(normalized.version).toBe(2); expect(normalized.data.parent.talks[0]).toEqual(log); expect(normalized.data.parent.retrieval).toEqual([target()]); expect(normalized.data.kid1).toEqual(oldChild);
    raw.data.kid1.retrieval = [target()]; raw.data.kid1.talks[0].corrections = result; raw.data.kid1.talks[0].reviewResult = log.reviewResult;
    const stripped = normalizeState(raw, today);
    expect(stripped.data.kid1.retrieval).toBeUndefined(); expect(stripped.data.kid1.talks[0].corrections).toBeUndefined(); expect(stripped.data.kid1.talks[0].reviewResult).toBeUndefined();
    expect(normalizeState(defaultState(), today).data.parent.retrieval).toEqual([]);
  });
  it('백업 왕복에서 교정·직접 고침·재사용 결과·복습 단계를 유지하고 별·미션은 바꾸지 않는다', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    try {
      const state = defaultState(), before = structuredClone(state.data.parent);
      const fixed = { ...item, selfFixed: true };
      saveCorrection(state.data.parent, fixed, 'coach', today, Date.now(), seededRng(1));
      state.data.parent.talks = [{ ...log, corrections: { ...result, items: [fixed] } }];
      expect(state.data.parent.customCards?.[0]).toMatchObject({ en: item.better, ko: item.whyKo, source: '교정' });
      expect(state.data.parent.retrieval?.[0]).toMatchObject({ stage: 0, dueDate: '2026-10-11' });
      const restored = importState(exportState(state)); expect(restored.data.parent).toEqual(state.data.parent); expect(restored.version).toBe(2);
      const protectedFields = (data: typeof before) => Object.fromEntries(Object.entries(data).filter(([key]) => !['customCards', 'retrieval', 'talks'].includes(key)));
      const rest = protectedFields(state.data.parent), old = protectedFields(before);
      expect(rest).toEqual(old);
      const first = structuredClone(state.data.parent.retrieval); saveCorrection(state.data.parent, fixed, 'coach', today, Date.now(), seededRng(2)); expect(state.data.parent.retrieval).toEqual(first);
    } finally { vi.useRealTimers(); }
  });
});
