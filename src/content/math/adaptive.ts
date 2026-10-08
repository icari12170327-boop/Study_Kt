import type { DayLog, Level, MathAttempt, MathLevelState } from '../../types';
import { addDays, lastNDays } from '../../lib/date';
import { clampMathLevel, mathLevelsFor } from './levels';

/** 문제 표시·입력·제출 사이의 각 구간을 상한까지만 센다. 단조 증가 시각을 사용한다. */
export function activeDuration(events: readonly number[], idleCapMs = 60000): number {
  return events.slice(1).reduce((sum, event, i) => sum + Math.min(idleCapMs, Math.max(0, event - events[i])), 0);
}

export function mathAttempt(skill: string, correct: boolean, events: readonly number[], story = false): MathAttempt {
  const activeMs = activeDuration(events);
  return { skill, correct, activeMs, guessed: !story && !correct && activeMs < 5000, ...(story ? { story: true } : {}) };
}

export function latestMathDay(days: Record<string, DayLog>, today: string): DayLog | undefined {
  return Object.values(days)
    .filter((day) => day.date < today && day.mathAttempts.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const retainHistory = (history: MathLevelState['history'], today: string) =>
  history.filter((row) => row.date >= addDays(today, -29) && row.date <= today).slice(-30);

export function evaluateLevel(
  state: MathLevelState,
  lastDay: DayLog | undefined,
  today: string,
  grade: Level = 'g3',
): MathLevelState {
  if (
    !lastDay ||
    lastDay.date >= today ||
    !lastDay.mathAttempts.length ||
    (state.lastEvaluated && lastDay.date <= state.lastEvaluated) ||
    state.history.some((row) => row.date === today)
  )
    return state;

  const attempts = lastDay.mathAttempts.filter((attempt) => attempt.story === true || !attempt.guessed);
  const correct = attempts.filter((attempt) => attempt.correct);
  const timedCorrect = correct.filter((attempt) => attempt.story !== true);
  const medianSec = median(timedCorrect.map((attempt) => attempt.activeMs)) / 1000;
  const levels = mathLevelsFor(grade);
  const current = clampMathLevel(state.level, grade);
  let next = current;
  if (attempts.length >= 10) {
    const accuracy = correct.length / attempts.length;
    if (accuracy >= 0.9 && timedCorrect.length > 0 && medianSec <= levels[current - 1].targetSec) next++;
    else if (accuracy < 0.6) next--;
  }
  const recent = state.history.filter((row) => row.date >= addDays(today, -6) && row.date <= today);
  const highest = Math.max(current, ...recent.map((row) => row.level));
  // 보호자의 수동 하향 조정은 존중하고, 과거 바닥까지 여러 단계 뛰어오르지 않는다.
  const floor = Math.min(current, Math.max(1, highest - 1));
  next = Math.max(floor, Math.min(levels.length, next));
  // 첫 평가 전의 레벨도 남겨 연속 강등으로 최초 최고 기록이 사라지지 않게 한다.
  const history = state.history.length
    ? state.history
    : [{ date: lastDay.date, level: current, counted: 0, correct: 0, guesses: 0, medianSec: 0 }];
  return {
    level: next,
    lastEvaluated: lastDay.date,
    history: retainHistory(
      [
        ...history,
        {
          date: today,
          level: next,
          counted: attempts.length,
          correct: correct.length,
          guesses: lastDay.mathAttempts.length - attempts.length,
          medianSec,
        },
      ],
      today,
    ),
  };
}

/** 수동 조정은 당일 자동 평가보다 우선하며 기존 학습 기록을 보존한다. */
export function setMathLevel(state: MathLevelState, level: number, grade: Level, today: string): MathLevelState {
  const next = clampMathLevel(level, grade);
  const existing = state.history.find((row) => row.date === today);
  return {
    level: next,
    lastEvaluated: addDays(today, -1),
    history: retainHistory(
      [
        ...state.history.filter((row) => row.date !== today),
        existing
          ? { ...existing, level: next }
          : { date: today, level: next, counted: 0, correct: 0, guesses: 0, medianSec: 0 },
      ],
      today,
    ),
  };
}

export function mathTimeline(state: MathLevelState, days: Record<string, DayLog>, today: string) {
  return lastNDays(14, today).map((date) => {
    const row = [...state.history].reverse().find((entry) => entry.date <= date);
    return {
      date,
      level: date === today ? state.level : row?.level,
      guesses: days[date]?.mathAttempts.filter((attempt) => attempt.story !== true && attempt.guessed).length ?? 0,
    };
  });
}
