import { describe, expect, it } from 'vitest';
import type { Level, MathAttempt, MathLevelState, WrongItem } from '../../types';
import { emptyDay } from '../../lib/progress';
import { addDays } from '../../lib/date';
import { seededRng } from '../../lib/random';
import { activeDuration, evaluateLevel, latestMathDay, mathAttempt, mathTimeline, setMathLevel } from './adaptive';
import { defaultMathState, mathLevelsFor, reviewSkills } from './levels';
import { buildLevelQueue } from './session';
import { SKILL_MAP } from './skills';

const attempt = (correct: boolean, activeMs = 10000): MathAttempt => ({
  skill: 'g3-add3',
  correct,
  activeMs,
  guessed: !correct && activeMs < 5000,
});
const day = (correct: number, total = 10, date = '2026-10-06', activeMs = 10000) => ({
  ...emptyDay(date),
  mathAttempts: Array.from({ length: total }, (_, i) => attempt(i < correct, activeMs)),
});
const history = (date: string, level: number) => ({ date, level, counted: 10, correct: 6, guesses: 0, medianSec: 10 });

describe('활동 시간과 찍기', () => {
  it('표시·입력·제출 사이의 60초 초과 공백을 각각 60초만 센다', () => {
    expect(activeDuration([0, 1000, 121000, 123000, 303000])).toBe(123000);
    expect(activeDuration([0, 60000, 120000])).toBe(120000);
    expect(activeDuration([0, 3000, 11000], 5000)).toBe(8000);
    expect(activeDuration([])).toBe(0);
    expect(activeDuration([123])).toBe(0);
  });
  it('5초 미만의 오답만 찍기로 보고 빠른 정답과 정확히 5초인 오답은 반영한다', () => {
    expect(mathAttempt('g2-times', false, [0, 4999]).guessed).toBe(true);
    expect(mathAttempt('g2-times', false, [0, 5000]).guessed).toBe(false);
    expect(mathAttempt('g2-times', true, [0, 100]).guessed).toBe(false);
  });
});

describe('학년별 레벨 출제', () => {
  for (const grade of ['g3', 'g5'] as Level[]) {
    for (const row of mathLevelsFor(grade)) {
      it(`${grade} 레벨 ${row.level}: 20문제의 주 단원 14개·복습 6개와 올바른 단원`, () => {
        const queue = buildLevelQueue(grade, row.level, [], 20, seededRng(42));
        const main = queue.filter((item) => item.band === 'main');
        const review = queue.filter((item) => item.band === 'review');
        expect(queue).toHaveLength(20);
        expect(main).toHaveLength(row.level === 1 ? 20 : 14);
        expect(review).toHaveLength(row.level === 1 ? 0 : 6);
        expect(main.every((item) => row.mainSkills.includes(item.problem.skill))).toBe(true);
        const lower = reviewSkills(grade, row.level);
        expect(review.every((item) => lower.includes(item.problem.skill))).toBe(true);
        const counts = row.mainSkills.map((skill) => main.filter((item) => item.problem.skill === skill).length);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        const reviewCounts = lower.map((skill) => review.filter((item) => item.problem.skill === skill).length);
        if (lower.length) expect(Math.max(...reviewCounts) - Math.min(...reviewCounts)).toBeLessThanOrEqual(1);
        expect(queue.every((item) => Boolean(SKILL_MAP[item.problem.skill]))).toBe(true);
      });
    }
  }
  it('하루 목표가 바뀌어도 비율을 가까운 정수로 맞추고 같은 시드로 재현한다', () => {
    const queue = buildLevelQueue('g3', 3, [], 13, seededRng(7));
    expect(queue.filter((item) => item.band === 'main')).toHaveLength(9);
    expect(queue.filter((item) => item.band === 'review')).toHaveLength(4);
    expect(buildLevelQueue('g3', 3, [], 13, seededRng(7))).toEqual(queue);
    expect(buildLevelQueue('g3', 3, [], 0)).toEqual([]);
  });
  it('오답노트도 현재 레벨의 두 비율 안에서 복습하며 한 오답을 중복 출제하지 않는다', () => {
    const wrongNotes: WrongItem[] = ['g3-add3', 'g3-sub3', 'g5-avg'].map((skill, i) => ({
      id: String(i),
      addedAt: '2026-10-01',
      given: '0',
      problem: SKILL_MAP[skill].generate(seededRng(i)),
    }));
    const queue = buildLevelQueue('g3', 9, wrongNotes, 20, seededRng(3));
    expect(queue.filter((item) => item.band === 'main')).toHaveLength(14);
    expect(queue.some((item) => item.wrongId === '0')).toBe(true);
    expect(queue.some((item) => item.wrongId === '1')).toBe(true);
    expect(queue.some((item) => item.wrongId === '2')).toBe(false);
    const ids = queue.flatMap((item) => (item.wrongId ? [item.wrongId] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('같은 단원에 오답이 몰려 있어도 아래 레벨 단원을 고르게 복습한다', () => {
    const notes = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      addedAt: '2026-10-01',
      given: '0',
      problem: SKILL_MAP['g3-add3'].generate(seededRng(i)),
    }));
    const queue = buildLevelQueue('g3', 4, notes, 20, seededRng(4));
    const review = queue.filter((item) => item.band === 'review');
    const counts = reviewSkills('g3', 4).map((skill) => review.filter((item) => item.problem.skill === skill).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(queue.filter((item) => item.wrongId).length).toBeLessThanOrEqual(10);
  });
});

describe('하루 레벨 평가', () => {
  const today = '2026-10-07';
  it('정답률 90%, 중앙값 25초의 경계에서 한 단계 승급한다', () => {
    const result = evaluateLevel(defaultMathState('g3'), day(9, 10, '2026-10-06', 25000), today);
    expect(result.level).toBe(4);
    expect(result.lastEvaluated).toBe('2026-10-06');
    expect(result.history.at(-1)).toMatchObject({ date: today, counted: 10, correct: 9, guesses: 0, medianSec: 25 });
  });
  it('중앙값이 25초를 넘거나 정답률이 90% 미만이면 승급하지 않는다', () => {
    expect(evaluateLevel(defaultMathState('g3'), day(9, 10, '2026-10-06', 25001), today).level).toBe(3);
    expect(evaluateLevel(defaultMathState('g3'), day(8), today).level).toBe(3);
  });
  it('60% 미만은 강등하고 정확히 60%는 유지한다', () => {
    expect(evaluateLevel(defaultMathState('g3'), day(5), today).level).toBe(2);
    expect(evaluateLevel(defaultMathState('g3'), day(6), today).level).toBe(3);
  });
  it('정답 시간만 중앙값으로 사용하며 짝수 개는 가운데 두 값의 평균을 사용한다', () => {
    const log = day(10, 11);
    log.mathAttempts = Array.from({ length: 10 }, (_, i) => attempt(true, i < 5 ? 20000 : 30000));
    log.mathAttempts.push(attempt(false, 600000));
    expect(evaluateLevel(defaultMathState('g3'), log, today).history.at(-1)?.medianSec).toBe(25);
    expect(evaluateLevel(defaultMathState('g3'), log, today).level).toBe(4);
  });
  it('찍기는 정답률·문제 수에서 제외하되 횟수를 기록하고 빠른 정답은 반영한다', () => {
    const log = day(10, 10, '2026-10-06', 100);
    log.mathAttempts.push(...Array.from({ length: 30 }, () => attempt(false, 100)));
    const result = evaluateLevel(defaultMathState('g3'), log, today);
    expect(result.level).toBe(4);
    expect(result.history.at(-1)).toMatchObject({ counted: 10, correct: 10, guesses: 30, medianSec: 0.1 });
  });
  it('반영 문제가 9개이거나 찍기만 있는 날은 유지한다', () => {
    expect(evaluateLevel(defaultMathState('g3'), day(9, 9), today).level).toBe(3);
    const result = evaluateLevel(defaultMathState('g3'), day(0, 50, '2026-10-06', 100), today);
    expect(result.level).toBe(3);
    expect(result.history.at(-1)).toMatchObject({ counted: 0, correct: 0, guesses: 50 });
  });
  it('최근 7일 최고 레벨보다 두 단계 낮아지지 않고 7일 창의 경계를 지킨다', () => {
    const state = { level: 5, history: [history('2026-10-01', 6)] };
    expect(evaluateLevel(state, day(0), today).level).toBe(5);
    expect(evaluateLevel({ ...state, history: [history('2026-09-30', 6)] }, day(0), today).level).toBe(4);
  });
  it('최초 레벨의 최고 기록도 보존해 매일 틀려서 연속 강등할 수 없다', () => {
    let state: MathLevelState = { level: 7, history: [] };
    state = evaluateLevel(state, day(0), today);
    expect(state.level).toBe(6);
    state = evaluateLevel(state, day(0, 10, today), '2026-10-08');
    expect(state.level).toBe(6);
  });
  it('첫 레벨과 마지막 레벨을 넘지 않는다', () => {
    expect(evaluateLevel({ level: 1, history: [] }, day(0), today).level).toBe(1);
    expect(evaluateLevel({ level: 9, history: [] }, day(10), today, 'g5').level).toBe(9);
  });
  it('같은 날 재진입·다음 날 같은 기록 재사용·현재 날짜 평가를 막는다', () => {
    const result = evaluateLevel(defaultMathState('g3'), day(10), today);
    expect(evaluateLevel(result, day(10), today)).toBe(result);
    expect(evaluateLevel(result, day(10), '2026-10-08')).toBe(result);
    expect(evaluateLevel(result, day(10, 10, today), today)).toBe(result);
    expect(evaluateLevel(result, day(10, 10, today), '2026-10-08').level).toBe(5);
  });
  it('미평가인 최근 학습일을 고르고 구형 기록이나 오늘·미래 기록은 고르지 않는다', () => {
    const logs = { a: day(10, 10, '2026-10-05'), b: day(10), c: day(10, 10, today), d: emptyDay('2026-10-04') };
    expect(latestMathDay(logs, today)?.date).toBe('2026-10-06');
    expect(latestMathDay({ d: emptyDay('2026-10-04') }, today)).toBeUndefined();
    expect(evaluateLevel(defaultMathState('g3'), undefined, today)).toEqual(defaultMathState('g3'));
  });
  it('입력을 바꾸지 않고 평가 이력을 최근 30일 분량으로 보존한다', () => {
    const state = { level: 3, history: Array.from({ length: 30 }, (_, i) => history(addDays('2026-09-07', i), 3)) };
    const before = structuredClone(state);
    const result = evaluateLevel(state, day(6), today);
    expect(state).toEqual(before);
    expect(result.history).toHaveLength(30);
    expect(result.history.at(-1)?.date).toBe(today);
  });
  it('학습 공백이 있어도 30일보다 오래된 이력을 보관하지 않는다', () => {
    const result = evaluateLevel(
      { level: 3, history: [history('2026-08-01', 3), history('2026-10-05', 3)] },
      day(6),
      today,
    );
    expect(result.history.map((row) => row.date)).toEqual(['2026-10-05', today]);
  });
  it('보호자가 수동 조정한 당일은 유지하고 다음 날 한 단계보다 크게 움직이지 않는다', () => {
    const state = setMathLevel({ level: 8, history: [history('2026-10-06', 8)] }, 2, 'g3', today);
    expect(evaluateLevel(state, day(10), today)).toBe(state);
    expect(evaluateLevel(state, day(0, 10, today), '2026-10-08').level).toBe(2);
    expect(evaluateLevel(state, day(10, 10, today), '2026-10-08').level).toBe(3);
    expect(state.history[0].level).toBe(8);
    const timeline = mathTimeline(state, { [today]: day(0, 3, today, 100) }, today);
    expect(timeline).toHaveLength(14);
    expect(timeline.at(-1)).toEqual({ date: today, level: 2, guesses: 3 });
  });
});
