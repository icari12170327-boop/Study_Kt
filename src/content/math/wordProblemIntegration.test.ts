import { describe, expect, it } from 'vitest';
import type { MathProblem } from '../../types';
import { defaultState } from '../../store/defaults';
import { exportState, importState, normalizeState } from '../../store/storage';
import { emptyDay } from '../../lib/progress';
import { toDateKey } from '../../lib/date';
import { seededRng } from '../../lib/random';
import { evaluateLevel, mathAttempt, mathTimeline } from './adaptive';
import { defaultMathState } from './levels';
import { buildLevelQueue, buildMathQueue } from './session';
import { buildFishPool } from '../games/fishing';
import { duelQueue } from '../games/duel';
import { normalizeGameAttempts } from '../games/limits';
import { withoutStory } from './wordProblem';
const today = toDateKey();
const problem: MathProblem = { skill: 'g3-sub3', question: '123 - 45 =', answer: { kind: 'int', value: 78 } };

describe('문장제 평가·저장·게임 연결', () => {
  it('빠른 문장제 오답은 찍기가 아니고 정답률에는 포함된다', () => {
    expect(mathAttempt(problem.skill, false, [0, 100], true)).toMatchObject({ story: true, guessed: false, correct: false });
    const log = emptyDay('2026-10-07');
    log.mathAttempts = [...Array.from({ length: 10 }, () => mathAttempt(problem.skill, true, [0, 10000])),
      ...Array.from({ length: 10 }, () => ({ ...mathAttempt(problem.skill, false, [0, 100], true), guessed: true }))];
    const result = evaluateLevel(defaultMathState('g3'), log, '2026-10-08');
    expect(result.level).toBe(2);
    expect(result.history.at(-1)).toMatchObject({ counted: 20, correct: 10, guesses: 0, medianSec: 10 });
    expect(mathTimeline(result, { [log.date]: log }, '2026-10-08').find(row => row.date === log.date)?.guesses).toBe(0);
  });
  it('느린 문장제 정답이 연산 시간 중앙값을 늘리지 않는다', () => {
    const log = emptyDay('2026-10-07');
    log.mathAttempts = [...Array.from({ length: 10 }, () => mathAttempt(problem.skill, true, [0, 20000])),
      ...Array.from({ length: 10 }, () => mathAttempt(problem.skill, true, [0, 60000, 120000], true))];
    const result = evaluateLevel(defaultMathState('g3'), log, '2026-10-08');
    expect(result.level).toBe(4); expect(result.history.at(-1)).toMatchObject({ counted: 20, correct: 20, medianSec: 20 });
  });
  it('문장제만 있는 날은 연산 시간 근거 없이 자동 승급하지 않는다', () => {
    const log = emptyDay('2026-10-07'); log.mathAttempts = Array.from({ length: 20 }, () => mathAttempt(problem.skill, true, [0, 100], true));
    expect(evaluateLevel(defaultMathState('g3'), log, '2026-10-08').level).toBe(3);
  });
  it('오래된 v2에 기본 비율을 더하고 기존 관심사와 학습·보상을 보존한다', () => {
    const old = defaultState(); delete old.settings.kid1.wordProblemRatio; delete old.settings.kid2.wordProblemRatio;
    old.settings.kid1.talk!.interests = ['축구', '공룡']; old.data.kid1.stars = 31; old.data.kid1.streak = 4;
    const migrated = normalizeState(old); expect(migrated.version).toBe(2);
    expect(migrated.settings.kid1.wordProblemRatio).toBe(20); expect(migrated.settings.kid1.talk!.interests).toEqual(['축구','공룡']);
    expect(migrated.settings.kid1).not.toHaveProperty('interests'); expect(migrated.data.kid1).toEqual(old.data.kid1);
    for (const raw of [0, 20, 40]) { old.settings.kid2.wordProblemRatio = raw; expect(normalizeState(old).settings.kid2.wordProblemRatio).toBe(raw); }
    for (const raw of [-1, 100, NaN, '40', null]) expect(normalizeState({ ...old, settings: { ...old.settings, kid2: { ...old.settings.kid2, wordProblemRatio: raw } } }).settings.kid2.wordProblemRatio).toBe(20);
  });
  it('오늘·지난 날의 story 표시를 백업해 평가를 유지하고 문제·오답은 식만 저장한다', () => {
    const state = defaultState(), storyProblem = { ...problem, story: '공룡 스티커 이야기' };
    const row = { ...mathAttempt(problem.skill, false, [0, 100], true), problem: storyProblem };
    state.data.kid2.days[today] = { ...emptyDay(today), mathAttempts: [row] };
    state.data.kid2.days['2000-01-01'] = { ...emptyDay('2000-01-01'), mathAttempts: [row] };
    state.data.kid2.wrongNotes = [{ id: 'story-wrong', problem: storyProblem, given: '0', addedAt: today }];
    state.settings.kid2.wordProblemRatio = 0;
    const normalized = normalizeState(state, today), restored = importState(exportState(state));
    for (const next of [normalized, restored]) {
      expect(next.data.kid2.days[today].mathAttempts[0]).toEqual({ ...row, problem });
      expect(next.data.kid2.days['2000-01-01'].mathAttempts[0]).toEqual(mathAttempt(problem.skill, false, [0, 100], true));
      expect(next.data.kid2.wrongNotes[0].problem).toEqual(problem); expect(next.settings.kid2.wordProblemRatio).toBe(0);
    }
    expect(normalizeGameAttempts([{ ...row, story: 'false' }], today, today)[0]).not.toHaveProperty('story');
  });
  it('기존 오답 복습·낚시·대결은 이야기 없이 식만 쓴다', () => {
    const note = { id: 'wrong', problem: { ...problem, story: '123枚あり45枚使いました。' }, given: '0', addedAt: today };
    for (const queue of [buildMathQueue([problem.skill], [note], 20, seededRng(10)), buildLevelQueue('g3', 3, [note], 20, seededRng(10))]) {
      expect(queue.find(item => item.wrongId)?.problem).toEqual(problem);
      expect(queue.every(item => !item.problem.story)).toBe(true);
    }
    expect(buildFishPool([{ ...mathAttempt(problem.skill, false, [0,100], true), problem: note.problem }], [], 8)[0].problem).toEqual(problem);
    expect(duelQueue('g3', 3, 10).every(item => !item.story)).toBe(true);
    expect(withoutStory(note.problem)).toEqual(problem); expect(note.problem.story).toBeTruthy();
  });
});
