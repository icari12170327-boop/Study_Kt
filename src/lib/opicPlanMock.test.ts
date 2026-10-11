import { describe, expect, it, vi } from 'vitest';
import { opicPlan, opicFocusWeight, gradeScriptRetell, reviewOpicScript, dueOpicScript, scriptKeyPhrases } from './opicPlan';
import { archiveCompletedMock, buildOpicMock, adjustOpicMock, mockAllowance, resumeOpicMock, opicMockResult, type OpicMock } from './opicMock';
import { emptyOpic, defaultOpicSettings, pickOpicQuestion, opicMetrics, type OpicAttempt, type OpicScript } from './opic';
import { seededRng } from './random';
import { addDays } from './date';
import { QUESTION_MAP, OPIC_QUESTIONS, SURVEY_TOPICS } from '../content/opic/questions';
import { OPIC_BANDS, type OpicFeedback } from '../../shared/opic';
import { runOpicFeedbackBatch } from './opicFeedbackBatch';
import { applyOpicProgress } from './opicProgress';
import { defaultState } from '../store/defaults';
import { normalizeState, exportState, importState } from '../store/storage';
import { buildWeeklyStats, opicWeeklyStats, weekRange } from './weeklyReport';
const today = '2026-10-11';
const script: OpicScript = { id: 'note', questionId: 'park-describe-01', topic: 'park', type: 'description', text: 'I like taking a walk. We enjoy the fresh air. It makes me feel calm.', createdAt: '2026-10-10', updatedAt: '2026-10-10', keyPhrases: ['taking a walk', 'the fresh air', 'feel calm'] };
const feedback = (band: OpicFeedback['levelBand'] = 'IM1-IM2', taskDone = true): OpicFeedback => ({ taskDone, levelBand: band, taskNoteKo: '경험을 설명했어요.', textType: 'sentences', strengthsKo: ['내 경험을 말했어요.'], corrections: [], nextStepKo: '세부 내용을 더 말해요.', modelAnswer: 'I like the park.', upgrades: [], keyPhrases: ['I like', 'the park'] });
const answer = (mock: OpicMock, i: number): OpicAttempt => { const q = QUESTION_MAP.get(mock.questionIds[i])!; return { id: `${mock.id}:${i}`, date: mock.date, questionId: q.id, type: q.type, topic: q.topic, transcript: 'I like the park.', durationSec: 30, ...opicMetrics('I like the park.', 30) }; };
const fullMock = (id = 'mock'): OpicMock => { const mock = buildOpicMock(defaultOpicSettings(), today, seededRng(2), id); return { ...mock, adjustment: 'same', answers: mock.questionIds.map((_, i) => ({ ...answer(mock, i), feedback: feedback() })) }; };

describe('8주 계획과 초점', () => {
  it('시험일 역산과 4구간·월말·연말 경계, 지난 시험 숨김', () => {
    const data = emptyOpic(); data.settings.examDate = '2027-01-25';
    const start = addDays(data.settings.examDate, -55);
    expect(start).toBe('2026-12-01'); data.planStartedAt = start;
    for (const [offset, phase] of [[0, 0], [13, 0], [14, 1], [27, 1], [28, 2], [41, 2], [42, 3], [55, 3]]) expect(opicPlan(data, addDays(start, offset))?.phase).toBe(phase);
    expect(opicPlan(data, '2027-01-25')?.daysLeft).toBe(0); expect(opicPlan(data, '2027-01-26')).toBeUndefined();
  });
  it('날짜 없으면 저장한 시작일부터 8주이며 매일 초기화되지 않는다', () => { const data = { ...emptyOpic(), planStartedAt: '2026-10-01' }; expect(opicPlan(data, '2026-10-15')).toMatchObject({ start: '2026-10-01', end: '2026-11-25', phase: 1, daysLeft: null }); expect(opicPlan(data, '2026-12-31')?.phase).toBe(3); });
  it('초점 가중치를 준 뒤에도 범주 비율·진도·14일·같은 날 선택을 지킨다', () => {
    expect(opicFocusWeight('past', 'park', 1, ['park'])).toBe(3); expect(opicFocusWeight('routine', 'park', 1, ['park'])).toBe(1);
    expect(opicFocusWeight('issue', 'home', 3, ['home'], ['issue'])).toBe(3);
    const settings = { ...defaultOpicSettings(), difficulty: 5 as const }, counts = [0, 0, 0];
    for (let i = 0; i < 10000; i++) { const q = pickOpicQuestion(OPIC_QUESTIONS, settings, [], today, { rng: seededRng(i), phase: 2 }); counts[q.type.startsWith('roleplay') || ['comparison', 'issue'].includes(q.type) ? 2 : SURVEY_TOPICS.some(t => t[0] === q.topic) ? 0 : 1]++; }
    [.7, .2, .1].forEach((ratio, i) => expect(counts[i] / 10000).toBeCloseTo(ratio, 1));
    const data = fullMock(); const previous = { ...answer(data, 1), date: addDays(today, -1) }; const next = pickOpicQuestion(OPIC_QUESTIONS, { ...settings, survey: [previous.topic] }, [previous], today, { rng: () => .1, phase: 1 }); expect(next.type).toBe('routine'); expect(next.id).not.toBe(previous.questionId);
    expect(pickOpicQuestion(OPIC_QUESTIONS, settings, [{ ...previous, date: today }], today, { phase: 3 }).id).toBe(previous.questionId);
  });
});
it('시험까지 20일이면 시작일을 고정해 남은 21일을 4등분하고 매일 재시작하지 않는다', () => {
  const data = { ...emptyOpic(), planStartedAt: '2026-12-20' }; data.settings.examDate = '2027-01-09';
  for (const [offset, phase] of [[0,0],[5,0],[6,1],[10,1],[11,2],[15,2],[16,3],[20,3]]) expect(opicPlan(data, addDays(data.planStartedAt, offset))).toMatchObject({ start: '2026-12-20', phase });
  expect(opicPlan(data, data.planStartedAt)?.daysLeft).toBe(20);
  expect(opicPlan(data, '2027-01-10')).toBeUndefined();
});
it('시험 당일 새로 시작해도 유효한 구간이고 오래 준비한 경우에는 최대 8주다', () => {
  const data = { ...emptyOpic(), planStartedAt: today }; data.settings.examDate = today;
  expect(opicPlan(data,today)).toMatchObject({ phase: 0, daysLeft: 0 });
  data.planStartedAt = '2026-01-01'; data.settings.examDate = '2027-01-25';
  expect(opicPlan(data,'2026-12-01')).toMatchObject({ start: '2026-12-01', phase: 0 });
});
describe('답안 다시 말하기', () => {
  it('핵심 표현 세 개 중 두 개를 직접 이어 말해야 성공한다', () => { expect(gradeScriptRetell(script.keyPhrases!, 'I am taking a walk in the fresh air.')).toEqual({ used: 2, total: 3, success: true }); expect(gradeScriptRetell(script.keyPhrases!, 'I like the walk and fresh food.').success).toBe(false); expect(gradeScriptRetell([], 'Any words.').success).toBe(false); });
  it('1→3→7일 갱신은 성공에만 단계가 오르고 실패는 다음 날이다', () => { let value = script; for (const [stage, days] of [[1, 1], [2, 3], [3, 7]]) { value = reviewOpicScript(value, true, today); expect(value.stage).toBe(stage); expect(value.dueDate).toBe(addDays(today, days)); } expect(reviewOpicScript(value, false, today)).toMatchObject({ stage: 3, dueDate: addDays(today, 1) }); expect(script.stage).toBeUndefined(); });
  it('오래 밀린 노트 하나, 답안은 키워드만 준비하고 예전 노트도 돌린다', () => { const data = emptyOpic(); data.scripts = [{ ...script, id: 'new', dueDate: today }, { ...script, id: 'old', dueDate: addDays(today, -2) }]; expect(dueOpicScript(data, today)?.id).toBe('old'); expect(scriptKeyPhrases({ ...script, keyPhrases: undefined }, data)).toHaveLength(3); expect(dueOpicScript({ ...data, scripts: [{ ...script, dueDate: addDays(today, 1) }] }, today)).toBeUndefined(); });
});
describe('15문항 실전 구성·조정·결과', () => {
  it.each([1, 2, 3, 4, 5, 6] as const)('난이도 %s의 15문항과 콤보·롤플레이 순서, 같은 시드', difficulty => {
    const settings = { ...defaultOpicSettings(), difficulty }, mock = buildOpicMock(settings, today, seededRng(3), 'fixed');
    expect(mock).toEqual(buildOpicMock(settings, today, seededRng(3), 'fixed')); expect(mock.questionIds).toHaveLength(15);
    const qs = mock.questionIds.map(id => QUESTION_MAP.get(id)!); expect(qs[0].type).toBe('self-intro');
    for (const start of [1, 4, 7]) { expect(qs.slice(start, start + 3).map(q => q.type)).toEqual(['description', 'routine', 'past']); expect(new Set(qs.slice(start, start + 3).map(q => q.topic)).size).toBe(1); }
    expect(SURVEY_TOPICS.some(t => t[0] === qs[1].topic)).toBe(true); expect(SURVEY_TOPICS.some(t => t[0] === qs[7].topic)).toBe(false);
    expect(qs.slice(10, 13).map(q => q.type)).toEqual(['roleplay-questions', 'roleplay-solution', 'roleplay-experience']);
    expect(qs.slice(13).map(q => q.type)).toEqual(difficulty >= 5 ? ['comparison', 'issue'] : ['routine', 'past']);
  });
  it('7번 뒤 이후 문항만 실제 minLevel에 맞는 문항으로 바꾸고 중복 조정은 없다', () => {
    const mock = buildOpicMock(defaultOpicSettings(), today, seededRng(4), 'm'); mock.answers = mock.questionIds.slice(0, 7).map((_, i) => answer(mock, i));
    const next = adjustOpicMock(mock, 'easier'); expect(next.questionIds.slice(0, 7)).toEqual(mock.questionIds.slice(0, 7)); expect(next.answers).toEqual(mock.answers); expect(next.adjustment).toBe('easier'); expect(adjustOpicMock(next, 'harder')).toEqual(next);
    const low = { ...mock, difficulty: 1 as const }; const hard = adjustOpicMock(low, 'harder'); expect(QUESTION_MAP.get(hard.questionIds[7])!.minLevel).toBe(2);
  });
  it('이어 보기는 그날만, 회수·시간·생성량 하나라도 부족하면 막는다', () => { const mock = fullMock(); expect(resumeOpicMock(mock, today)).toBe(mock); expect(resumeOpicMock(mock, addDays(today, 1))).toBeUndefined(); expect(mockAllowance({ transcribes: 15, transcribeSeconds: 2250, generates: 15 })).toBeUndefined(); for (const value of [{ transcribes: 14, transcribeSeconds: 2250, generates: 15 }, { transcribes: 15, transcribeSeconds: 2249, generates: 15 }, { transcribes: 15, transcribeSeconds: 2250, generates: 14 }, undefined]) expect(mockAllowance(value)).toBeTruthy(); });
  it('예상 범위 중앙값·과제 달성률 Top3는 누락 피드백을 실패로 세지 않는다', () => { const mock = fullMock(); mock.answers.forEach((a, i) => { a.feedback = feedback(OPIC_BANDS[i % 6], i !== 1 && i !== 2 && i !== 10); }); delete mock.answers[14].feedback; const result = opicMockResult(mock); expect(result.measured).toBe(14); expect(result.band).toBe('IM1-IM2'); expect(result.weak.map(w => w.type)).toEqual(['roleplay-questions', 'description', 'routine']); expect(result.nextFocus).toContain('묘사'); });
});
describe('피드백 일괄 요청', () => {
  it('최대 3개만 동시에 실행하고 실패한 문항만 재시도한다', async () => {
    let running = 0, maximum = 0; const saved = new Map<number, string>(), request = vi.fn(async (i: number) => { running++; maximum = Math.max(maximum, running); await new Promise(resolve => setTimeout(resolve, 1)); running--; if (i === 4 && !saved.has(0)) throw new Error(); if (i === 5) throw new Error(); return `ok${i}`; });
    const failed = await runOpicFeedbackBatch(Array.from({ length: 15 }, (_, i) => i), request, (i, result) => saved.set(i, result), new AbortController().signal); expect(maximum).toBe(3); expect(failed).toEqual([5]);
    request.mockImplementation(async i => `retried${i}`); await runOpicFeedbackBatch(failed, request, (i, result) => saved.set(i, result), new AbortController().signal); expect(request).toHaveBeenCalledTimes(16); expect(saved.size).toBe(15);
  });
  it('이탈한 뒤 도착한 결과는 저장하지 않고 다음 묶음도 요청하지 않는다', async () => { let release!: (value: string) => void; const request = vi.fn(() => new Promise<string>(resolve => { release = resolve; })), save = vi.fn(), controller = new AbortController(); const pending = runOpicFeedbackBatch([1], request, save, controller.signal); controller.abort(); release('late'); await pending; expect(save).not.toHaveBeenCalled(); });
});
describe('저장·미션·리포트 호환', () => {
  it('모의고사20개·진행중1개·답안 선택 필드만 정규화하고 녹음은 버린다', () => {
    const state = defaultState(); state.data.parent.opic = { ...emptyOpic(), scripts: [{ ...script, stage: 2, dueDate: addDays(today, 3) }], mocks: Array.from({ length: 21 }, (_, i) => fullMock(`m${i}`)), currentMock: { ...fullMock('ongoing'), answers: [] } };
    Object.assign(state.data.parent.opic.currentMock!, { audio: 'private-audio', blob: 'private-blob' });
    const normalized = normalizeState(state, today); expect(normalized.version).toBe(2); expect(normalizeState({ ...state, data: { ...state.data, parent: { ...state.data.parent, opic: { ...state.data.parent.opic, mocks: [fullMock('duplicate'), fullMock('duplicate')] } } } }, today).data.parent.opic?.mocks).toHaveLength(1); expect(normalized.data.parent.opic?.mocks).toHaveLength(20); expect(normalized.data.parent.opic?.scripts[0]).toMatchObject({ stage: 2, dueDate: addDays(today, 3) }); expect(JSON.stringify(normalized)).not.toContain('private-audio');
    expect(normalizeState(normalized, addDays(today, 1)).data.parent.opic?.currentMock).toBeUndefined();
    const bad = structuredClone(state); Object.assign(bad.data.parent.opic!.scripts[0], { stage: 9, dueDate: '2026-02-30' }); expect(normalizeState(bad, today).data.parent.opic?.scripts[0].stage).toBeUndefined();
    const backup = importState(exportState(normalized)); expect(backup.data.parent.opic).toEqual(normalized.data.parent.opic);
  });
  it('마지막 답변부터 완료 기록을 자동 보관하고 피드백은 같은 ID에 갱신하며 최대 20회다', () => {
    const mock = fullMock('latest'), prior = Array.from({ length: 20 }, (_, i) => fullMock(`m${i}`));
    const before = structuredClone(prior), saved = archiveCompletedMock(prior, mock);
    expect(saved).toHaveLength(20); expect(saved[0].id).toBe('m1'); expect(prior).toEqual(before);
    const changed = structuredClone(mock); changed.answers[0].feedback = feedback('IH-AL');
    const updated = archiveCompletedMock(saved, changed); expect(updated).toHaveLength(20); expect(updated.at(-1)?.answers[0].feedback?.levelBand).toBe('IH-AL');
    expect(saved.at(-1)?.answers[0].feedback?.levelBand).toBe('IM1-IM2'); delete changed.answers[0].feedback; expect(archiveCompletedMock(updated, changed).at(-1)?.answers[0].feedback?.levelBand).toBe('IH-AL'); changed.answers[0].transcript = 'A different answer.'; expect(archiveCompletedMock(updated, changed).at(-1)?.answers[0].feedback).toBeUndefined();
    expect(archiveCompletedMock([], { ...mock, answers: mock.answers.slice(0,14) })).toEqual([]);
  });
  it('마치기 없이 다음 날 넘어가도 완료 기록·피드백·백업은 남고 미완료 판만 버린다', () => {
    const state = defaultState(); state.data.parent.opic = { ...emptyOpic(), currentMock: fullMock() };
    const next = normalizeState(state, addDays(today,1));
    expect(next.data.parent.opic?.currentMock).toBeUndefined(); expect(next.data.parent.opic?.mocks?.[0]).toEqual(fullMock());
    expect(importState(exportState(next)).data.parent.opic?.mocks).toEqual(next.data.parent.opic?.mocks);
    state.data.parent.opic.currentMock!.answers.pop(); expect(normalizeState(state,addDays(today,1)).data.parent.opic?.mocks).toBeUndefined();
  });
  it('T27a 데이터는 유지되고 오픽 미션은 보호자만 기본 꺼짐이며 한 번만 진행한다', () => {
    const original = defaultState(), legacy = emptyOpic(); legacy.scripts = [script]; original.data.parent.opic = legacy;
    const state = normalizeState(original, today); expect(state.data.parent.opic).toEqual(legacy); expect(state.settings.parent.missions.find(m => m.type === 'opic')?.enabled).toBe(false); expect(state.settings.kid1.missions.some(m => m.type === 'opic')).toBe(false);
    const before = structuredClone(state); applyOpicProgress(state, today); expect(state).toEqual(before);
    state.settings.parent.missions.find(m => m.type === 'opic')!.enabled = true; applyOpicProgress(state, today); applyOpicProgress(state, today); expect(state.data.parent.days[today].progress.opic).toBe(1); expect(state.data.parent.days[today].progress.talk).toBeUndefined(); expect(state.data.parent.stars).toBe(before.data.parent.stars); expect(state.data.kid1).toEqual(before.data.kid1);
  });
  it('오픽 집계는 기존 기록을 읽기만 하고 아이 리포트는 바뀌지 않는다', () => { const state = normalizeState(defaultState(), today), before = buildWeeklyStats(state, 'kid1', weekRange(today)); state.data.parent.opic = { ...emptyOpic(), mocks: [fullMock()], attempts: [answer(fullMock('daily'), 0)] }; const frozen = structuredClone(state); const stats = opicWeeklyStats(state.data.parent.opic, weekRange(today)); expect(stats.practices).toBe(2); expect(stats.answered).toBe(16); expect(stats.averageWords).toBe(4); expect(stats.latestBand).toBe('IM1-IM2'); expect(state).toEqual(frozen); expect(buildWeeklyStats(state, 'kid1', weekRange(today))).toEqual(before); expect(opicWeeklyStats(undefined, weekRange(today))).toMatchObject({ practices: 0, averageWords: null }); });
});
