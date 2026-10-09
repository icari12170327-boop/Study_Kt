import { describe, expect, it } from 'vitest';
import { hasCandidateAdditions, isQuizResponse, mergeCandidates, normalizeReadingQuiz, quizCount, quizReadiness, sameQuestion, toCandidates, type QuizCandidate } from './readingQuiz';
import { defaultState } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
const empty = { id: 'empty', q: '', a: '' };
const existing = [{ id: 'old', q: 'What   happened?', a: 'old' }];
let index = 0; const id = () => `new-${++index}`;
const candidate = (q: string, a = '답'): QuizCandidate => ({ id: id(), q, a, type: 'fact', checked: true });

describe('독서 질문 순수 함수', () => {
  it.each([['adult', 5], ['g5', 4], ['g3', 3]] as const)('%s 요청은 %s개', (level, count) => expect(quizCount(level)).toBe(count));
  it('연결·제목·요약 39/40자와 공백 경계를 안내한다', () => {
    expect(quizReadiness({ aiReady: false, title: '제목', summary: '가'.repeat(40) })).toMatchObject({ ok: false, reason: expect.stringContaining('AI 연결') });
    expect(quizReadiness({ aiReady: true, title: ' ', summary: '가'.repeat(40) })).toMatchObject({ ok: false, reason: expect.stringContaining('제목') });
    expect(quizReadiness({ aiReady: true, title: '책', summary: `  ${'가'.repeat(39)} ` })).toMatchObject({ ok: false, reason: expect.stringContaining('1자') });
    expect(quizReadiness({ aiReady: true, title: '책', summary: ` ${'가'.repeat(40)} ` })).toEqual({ ok: true });
    expect(quizReadiness({ aiReady: true, title: '책', summary: ' '.repeat(40) })).toMatchObject({ ok: false, reason: expect.stringContaining('40자') });
  });
  it('Worker 제목·요약 상한도 안내한다', () => {
    expect(quizReadiness({ aiReady: true, title: '가'.repeat(201), summary: '가'.repeat(40) }).ok).toBe(false);
    expect(quizReadiness({ aiReady: true, title: '책', summary: '가'.repeat(8001) }).ok).toBe(false);
  });
  it.each([[' What  happened? ', 'what happened'], ['질문？', '질문.'], ['Q\n A??', 'q a'], ['Question ?', 'question']])('공백·대소문자·끝 문장부호 %s / %s', (a, b) => expect(sameQuestion(a, b)).toBe(true));
  it('다른 의미의 질문은 같지 않다', () => expect(sameQuestion('왜 왔나요?', '누가 왔나요?')).toBe(false));
  it('빈 질문·답·중복·기존 질문을 빼고 앞뒤 공백과 개수 상한을 적용한다', () => {
    const raw = [{ q: 'WHAT happened？', a: '답', type: 'fact' as const }, { q: ' ', a: '답', type: 'fact' as const }, { q: '왜?', a: ' ', type: 'why' as const }, { q: ' 새 질문? ', a: ' 새 답 ', type: 'fact' as const }, { q: '새  질문.', a: '중복', type: 'why' as const }, { q: '두 번째', a: '답', type: 'apply' as const }];
    const before = structuredClone(raw);
    expect(toCandidates(existing, raw, 1, () => 'fixed')).toEqual([{ id: 'fixed', q: '새 질문?', a: '새 답', type: 'fact', checked: true }]);
    expect(raw).toEqual(before); expect(toCandidates(existing, raw, 0, id)).toEqual([]);
    expect(toCandidates(existing, raw, 5, id)).toHaveLength(2);
  });
  it('빈 수동 첫 줄 하나를 대체하고 후보 종류·체크 표시를 저장 카드에서 제거한다', () => {
    const chosen = candidate(' 질문 ', ' 답 ');
    expect(mergeCandidates([empty], [chosen])).toEqual([{ id: chosen.id, q: '질문', a: '답' }]);
    expect(hasCandidateAdditions([empty], [chosen])).toBe(true);
  });
  it('고른 후보가 모두 기존 질문과 같으면 새 카드가 없고 입력도 바꾸지 않는다', () => {
    const candidates = [candidate(' WHAT happened？ '), candidate('what   happened.')];
    const before = structuredClone({ existing, candidates });
    expect(hasCandidateAdditions(existing, candidates)).toBe(false);
    expect(mergeCandidates(existing, candidates)).toEqual(existing);
    expect({ existing, candidates }).toEqual(before);
  });
  it('중복과 새 질문을 함께 고르면 새 질문이 있을 때만 추가할 수 있다', () => {
    const duplicate = candidate('WHAT happened.'), fresh = candidate('새 질문');
    expect(hasCandidateAdditions(existing, [duplicate, fresh])).toBe(true);
    expect(hasCandidateAdditions(existing, [duplicate, { ...fresh, checked: false }])).toBe(false);
    expect(hasCandidateAdditions(existing, [candidate(' ', '답'), candidate('질문', ' ')])).toBe(false);
  });
  it('선택 해제·편집으로 빈칸이 된 후보·편집 뒤 중복을 제외하고 기존 id와 입력은 유지한다', () => {
    const candidates = [candidate('다음 질문'), { ...candidate('제외'), checked: false }, candidate(' ', '답'), candidate('질문', ' '), candidate('WHAT HAPPENED.'), candidate('다음  질문？')];
    const before = structuredClone(candidates);
    expect(mergeCandidates(existing, candidates)).toEqual([...existing, { id: candidates[0].id, q: '다음 질문', a: '답' }]);
    expect(candidates).toEqual(before); expect(mergeCandidates([empty], [])).toEqual([empty]);
    expect(mergeCandidates([empty, ...existing], [candidate('추가')])).toHaveLength(3);
  });
  it.each([null, {}, { cards: [] }, { cards: [{ q: 1, a: '답', type: 'fact' }] }, { cards: [{ q: '질문', a: '답', type: 'other' }] }, { cards: [{ q: '가'.repeat(501), a: '답', type: 'fact' }] }, { cards: Array(11).fill({ q: '질문', a: '답', type: 'fact' }) }])('잘못된 응답을 거부한다: %j', raw => expect(isQuizResponse(raw)).toBe(false));
  it('빈 문자열은 후보 변환에서 정리하고 정상 응답은 허용한다', () => expect(isQuizResponse({ cards: [{ q: '질문', a: '답', type: 'fact' }] })).toBe(true));
});
describe('독서 질문 설정 저장 호환성', () => {
  it.each([undefined, null, [], { enabled: 'false' }, { enabled: 0 }, { enabled: null }])('없는 값과 잘못된 값은 기본 켜짐: %j', raw => expect(normalizeReadingQuiz(raw)).toEqual({ enabled: true }));
  it('켜짐·꺼짐만 인정하고 알 수 없는 필드는 제거한다', () => {
    expect(normalizeReadingQuiz({ enabled: false, private: '제외' })).toEqual({ enabled: false }); expect(normalizeReadingQuiz({ enabled: true })).toEqual({ enabled: true });
  });
  it('기존 version 2 기록을 유지하며 누락 설정은 켜고 명시한 꺼짐은 유지한다', () => {
    const old = defaultState(); delete old.settings.kid1.readingQuiz;
    old.settings.kid2.readingQuiz = { enabled: false }; old.data.kid1.stars = 55;
    const result = normalizeState(old); expect(result.version).toBe(2);
    expect(result.settings.kid1.readingQuiz).toEqual({ enabled: true }); expect(result.settings.kid2.readingQuiz).toEqual({ enabled: false }); expect(result.data.kid1.stars).toBe(55);
  });
  it('설정을 포함한 백업 왕복이 전체 기록과 일치한다', () => {
    const state = normalizeState(defaultState()); state.settings.kid2.readingQuiz = { enabled: false };
    expect(importState(exportState(state))).toEqual(state);
  });
});
