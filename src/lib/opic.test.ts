import { describe, expect, it } from 'vitest';
import { OPIC_QUESTIONS, SURVEY_TOPICS, UNEXPECTED_TOPICS } from '../content/opic/questions';
import { OPIC_FRAMES } from '../content/opic/frames';
import { OPIC_TYPES, type OpicFeedback } from '../../shared/opic';
import { defaultOpicSettings, emptyOpic, isOpicFeedback, modelAnswerParts, normalizeOpic, opicMetrics, pickOpicQuestion, reserveOpicQuestion, type OpicAttempt } from './opic';
import { seededRng } from './random';
import { addDays } from './date';
import { defaultState } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
const today = '2026-10-11';
const question = OPIC_QUESTIONS.find(q => q.id === 'park-describe-01')!;
const attempt = (date = today): OpicAttempt => ({ id: date, date, questionId: question.id, type: question.type, topic: question.topic, transcript: 'I go to the park. 공원 좋아요.', durationSec: 60, ...opicMetrics('I go to the park. 공원 좋아요.', 60) });
export const feedback: OpicFeedback = { taskDone: true, taskNoteKo: '장소를 설명했어요.', textType: 'sentences', levelBand: 'IM1-IM2', strengthsKo: ['경험을 말했어요.'], corrections: [{ said: 'I go to the park', better: 'I went to the park.', focus: 'went', whyKo: '과거 일을 말해요.', pattern: 'tense' }], nextStepKo: '세부 내용을 하나 더 말해요.', modelAnswer: 'I went to the park. I enjoy walking.', upgrades: [{ from: 'I go', to: 'I went' }], keyPhrases: ['I went to', 'I enjoy walking'] };
describe('오픽 질문 은행·답변 틀', () => {
  it('150문항 이상, 24주제·3단계 롤플레이·어드밴스 10개 이상을 갖춘다', () => {
    expect(OPIC_QUESTIONS.length).toBeGreaterThanOrEqual(150); expect(new Set(OPIC_QUESTIONS.map(q => q.id)).size).toBe(OPIC_QUESTIONS.length);
    for (const [topic] of [...SURVEY_TOPICS, ...UNEXPECTED_TOPICS]) for (const type of ['description', 'routine', 'past']) expect(OPIC_QUESTIONS.filter(q => q.topic === topic && q.type === type).length).toBeGreaterThanOrEqual(1);
    for (const topic of new Set(OPIC_QUESTIONS.filter(q => q.type.startsWith('roleplay')).map(q => q.topic))) expect(new Set(OPIC_QUESTIONS.filter(q => q.topic === topic && q.type.startsWith('roleplay')).map(q => q.type)).size).toBe(3);
    expect(OPIC_QUESTIONS.filter(q => ['comparison', 'issue'].includes(q.type)).length).toBeGreaterThanOrEqual(10);
    for (const q of OPIC_QUESTIONS) { expect(q.en.length).toBeLessThanOrEqual(400); expect(q.ko).toMatch(/[가-힣]/); expect(q.minLevel).toBeGreaterThanOrEqual(1); expect(q.minLevel).toBeLessThanOrEqual(6); }
    for (const type of OPIC_TYPES) { expect(OPIC_FRAMES[type].steps).toHaveLength(4); expect(OPIC_FRAMES[type].skeleton).toHaveLength(4); expect(OPIC_FRAMES[type].connectors).toHaveLength(5); expect(OPIC_FRAMES[type].fillers).toHaveLength(3); }
  });
});
describe('오늘 문항 선택', () => {
  it('주제 범주를 70/20/10 비율로 선택하고 같은 시드가 같다', () => {
    const counts = [0, 0, 0], settings = { ...defaultOpicSettings(), difficulty: 5 as const };
    for (let i = 0; i < 10000; i++) { const q = pickOpicQuestion(OPIC_QUESTIONS, settings, [], today, { rng: seededRng(i) }); const index = q.type.startsWith('roleplay') || ['comparison', 'issue'].includes(q.type) ? 2 : SURVEY_TOPICS.some(t => t[0] === q.topic) ? 0 : 1; counts[index]++; expect(q).toEqual(pickOpicQuestion(OPIC_QUESTIONS, settings, [], today, { rng: seededRng(i) })); }
    for (const [i, ratio] of [.7, .2, .1].entries()) expect(counts[i] / 10000).toBeCloseTo(ratio, 1);
  });
  it('어드밴스는 난이도 5 이상, 낮은 난이도에서는 제외한다', () => {
    for (let i = 0; i < 1000; i++) { const q = pickOpicQuestion(OPIC_QUESTIONS, defaultOpicSettings(), [], today, { rng: seededRng(i) }); expect(['comparison', 'issue']).not.toContain(q.type); }
  });
  it('묘사 다음 날 같은 주제의 일상, 그다음 과거로 나아간다', () => {
    const settings = { ...defaultOpicSettings(), survey: ['park'] };
    const first = attempt('2026-10-09'); const second = pickOpicQuestion(OPIC_QUESTIONS, settings, [first], '2026-10-10', { rng: () => .1 }); expect(second.topic).toBe('park'); expect(second.type).toBe('routine');
    const next = { ...first, questionId: second.id, type: second.type, date: '2026-10-10' }; expect(pickOpicQuestion(OPIC_QUESTIONS, settings, [first, next], today, { rng: () => .1 }).type).toBe('past');
  });
  it('최근 14일 제외, 경계 밖 허용, 바닥나면 오래된 질문으로 돌아간다', () => {
    const bank = OPIC_QUESTIONS.filter(q => q.topic === 'park' && q.type === 'description'); const previous = { ...attempt(addDays(today, -13)) };
    expect(pickOpicQuestion(bank, defaultOpicSettings(), [previous], today).id).not.toBe(previous.questionId);
    expect(pickOpicQuestion([question], defaultOpicSettings(), [{ ...previous, date: addDays(today, -14) }], today).id).toBe(question.id);
    const all = bank.map((q, i) => ({ ...previous, questionId: q.id, date: addDays(today, -i - 1) })); expect(pickOpicQuestion(bank, defaultOpicSettings(), all, today).id).toBe(bank[1].id);
  });
  it('같은 날 재방문은 고정하고 변경은 2번, 선택은 입력을 바꾸지 않는다', () => {
    const data = emptyOpic(), first = reserveOpicQuestion(data, question, today)!; const before = structuredClone(data);
    expect(pickOpicQuestion(OPIC_QUESTIONS, data.settings, data.attempts, today)).toBe(question); expect(data).toEqual(before);
    for (let i = 0; i < 2; i++) { const next = pickOpicQuestion(OPIC_QUESTIONS, data.settings, data.attempts, today, { change: true }); expect(reserveOpicQuestion(data, next, today, true)).toBeDefined(); }
    expect(reserveOpicQuestion(data, question, today, true)).toBeUndefined(); expect(first.transcript).toBe('');
  });
});
describe('오픽 수치·검증·저장', () => {
  it('영어 단어와 시간·한국어 비율은 기존 계산을 따른다', () => { expect(opicMetrics('I like parks. 공원 좋아요', 30)).toEqual({ words: 3, wpm: 6, koreanRatio: .4 }); expect(opicMetrics('', 1)).toEqual({ words: 0, wpm: 0, koreanRatio: 0 }); });
  it('응답 길이·형식 검사와 모범 답안의 변경 부분 표시', () => { expect(isOpicFeedback(feedback)).toBe(true); expect(isOpicFeedback({ ...feedback, modelAnswer: 'a'.repeat(1401) })).toBe(false); expect(isOpicFeedback({ ...feedback, corrections: Array(4).fill(feedback.corrections[0]) })).toBe(false); expect(modelAnswerParts(feedback)).toEqual([{ text: 'I went', changed: true }, { text: ' to the park. I enjoy walking.', changed: false }]); });
  it('알 수 없는 타입·주제·날짜·길이·녹음 필드를 제거하고 상한·최근 7일을 지킨다', () => {
    const raw = { ...emptyOpic(), attempts: Array.from({ length: 205 }, (_, i) => ({ ...attempt(), id: `a${i}`, feedback: { ...feedback, audio: 'secret-recording' }, audio: 'secret-recording' })), scripts: Array.from({ length: 155 }, (_, i) => ({ id: `s${i}`, questionId: question.id, type: question.type, topic: question.topic, text: 'Answer.', createdAt: today, updatedAt: today, audio: 'secret-recording' })), skipsByDate: { [today]: 2, [addDays(today, -6)]: 1, [addDays(today, -7)]: 1, '2026-02-30': 1 } };
    raw.attempts.push({ ...raw.attempts[0], date: '2026-02-30' }, { ...raw.attempts[0], topic: 'unknown' }, { ...raw.attempts[0], transcript: 'a'.repeat(6001) });
    const result = normalizeOpic(raw, today)!; expect(result.attempts).toHaveLength(200); expect(result.scripts).toHaveLength(150); expect(JSON.stringify(result)).not.toContain('secret-recording'); expect(Object.keys(result.skipsByDate!)).toHaveLength(2);
  });
  it('version 2 백업 왕복, 아이·대화·별·미션은 바뀌지 않고 토큰과 녹음은 빠진다', () => {
    const state = normalizeState(defaultState()); const before = structuredClone(state); state.data.parent.opic = { ...emptyOpic(), attempts: [{ ...attempt(toDateKeyForTest()), feedback }], scripts: [] }; state.ai.token = 'private-test-token';
    const backup = exportState(state); expect(backup).not.toContain('private-test-token'); const restored = importState(backup); expect(restored.version).toBe(2); expect(restored.data.parent.opic).toEqual(state.data.parent.opic);
    delete restored.data.parent.opic; expect(restored.data).toEqual(before.data); expect(restored.settings).toEqual(before.settings);
    const injected = structuredClone(state); injected.data.kid1.opic = emptyOpic(); expect(normalizeState(injected).data.kid1.opic).toBeUndefined();
  });
});
function toDateKeyForTest() { return today; }
it('14일 후보가 바닥나도 꺼 둔 서베이를 다시 고르지 않는다', () => {
  const settings = { ...defaultOpicSettings(), survey: ['park'] }, history = OPIC_QUESTIONS.filter(q => q.topic === 'park' && !q.type.startsWith('roleplay')).map(q => ({ ...attempt(addDays(today, -1)), questionId: q.id, type: q.type }));
  const selected = pickOpicQuestion(OPIC_QUESTIONS, settings, history, today, { rng: () => .1 }); expect(selected.topic).toBe('park');
});
it('같은 날 질문으로 돌아와도 시도 id가 겹치지 않는다', () => { const data = emptyOpic(); const first = reserveOpicQuestion(data, question, today)!; reserveOpicQuestion(data, OPIC_QUESTIONS.find(q => q.id === 'park-routine-01')!, today, true); const again = reserveOpicQuestion(data, question, today, true)!; expect(again.id).not.toBe(first.id); });
