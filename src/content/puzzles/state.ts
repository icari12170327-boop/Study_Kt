import type { Level, ProfileData } from '../../types';
import { lastNDays, parseDateKey, toDateKey } from '../../lib/date';
import { PUZZLE_TYPES } from './registry';
import type { Difficulty, PuzzleData, PuzzleLevel, PuzzleRecord, PuzzleResult, PuzzleType } from './types';

export function initialPuzzleLevel(grade: Level): Difficulty { return grade === 'g5' ? 2 : 1; }
export function defaultPuzzleLevel(grade: Level): PuzzleLevel {
  return { level: initialPuzzleLevel(grade), streak: 0, fails: 0, solved: 0, hinted: 0 };
}
export function emptyPuzzleData(grade: Level): PuzzleData {
  return { levels: Object.fromEntries(PUZZLE_TYPES.map(type => [type, defaultPuzzleLevel(grade)])), recent: [], daily: [] };
}
export function adjustPuzzleLevel(state: PuzzleLevel, result: PuzzleResult): PuzzleLevel {
  const clean = result.correct && !result.hinted && !result.revealed && result.wrong < 2;
  const next = { ...state, solved: state.solved + +result.correct, hinted: state.hinted + +result.hinted,
    streak: clean ? state.streak + 1 : 0, fails: clean ? 0 : state.fails + 1 };
  if (next.streak >= 3) { next.level = Math.min(5, next.level + 1) as Difficulty; next.streak = 0; }
  if (next.fails >= 2) { next.level = Math.max(1, next.level - 1) as Difficulty; next.fails = 0; }
  return next;
}
/** 자유 놀이 기록은 이 필드만 바꾼다. 학습과 보상 함수는 호출하지 않는다. */
export function recordPuzzle(data: ProfileData, grade: Level, record: PuzzleRecord, result: PuzzleResult): void {
  const puzzles = data.puzzles ??= emptyPuzzleData(grade);
  puzzles.levels[record.type] = adjustPuzzleLevel(puzzles.levels[record.type] ?? defaultPuzzleLevel(grade), result);
  puzzles.daily ??= aggregateDays(puzzles.recent);
  const day = puzzles.daily.find(row => row.date === record.date);
  if (day) { day.total++; day.solved += +record.correct; day.hinted += +record.hinted; day.activeSec += record.activeSec; }
  else puzzles.daily.push({ date: record.date, total: 1, solved: +record.correct, hinted: +record.hinted, activeSec: record.activeSec });
  const dates = new Set(lastNDays(7, record.date));
  puzzles.daily = puzzles.daily.filter(row => dates.has(row.date)).sort((a, b) => a.date.localeCompare(b.date));
  puzzles.recent = [...puzzles.recent, record].slice(-100);
}
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateKey(parseDateKey(value)) === value;
}
function aggregateDays(recent: PuzzleRecord[]): NonNullable<PuzzleData['daily']> {
  const days: NonNullable<PuzzleData['daily']> = [];
  for (const row of recent) {
    let day = days.find(day => day.date === row.date);
    if (!day) { day = { date: row.date, total: 0, solved: 0, hinted: 0, activeSec: 0 }; days.push(day); }
    day.total++; day.solved += +row.correct; day.hinted += +row.hinted; day.activeSec += row.activeSec;
  }
  return days.sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
}
function difficulty(value: unknown, fallback: Difficulty): Difficulty {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5 ? value as Difficulty : fallback;
}
export function normalizePuzzleSettings(value: unknown): { enabled: boolean } {
  const raw = object(value);
  return { enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true };
}
export function normalizePuzzleData(value: unknown, grade: Level): PuzzleData {
  const raw = object(value), levels = object(raw.levels);
  const normalized = emptyPuzzleData(grade);
  for (const type of PUZZLE_TYPES) {
    const row = object(levels[type]);
    normalized.levels[type] = { level: difficulty(row.level, initialPuzzleLevel(grade)),
      streak: Math.min(2, count(row.streak)), fails: Math.min(1, count(row.fails)), solved: count(row.solved), hinted: count(row.hinted) };
  }
  normalized.recent = (Array.isArray(raw.recent) ? raw.recent : []).flatMap(value => {
    const row = object(value);
    if (!validDate(row.date) ||
      !PUZZLE_TYPES.includes(row.type as PuzzleType) || difficulty(row.difficulty, 1) !== row.difficulty ||
      typeof row.correct !== 'boolean' || typeof row.hinted !== 'boolean' ||
      typeof row.activeSec !== 'number' || !Number.isFinite(row.activeSec) || row.activeSec < 0) return [];
    return [{ date: row.date, type: row.type as PuzzleType, difficulty: row.difficulty as Difficulty,
      correct: row.correct, hinted: row.hinted, activeSec: Math.floor(row.activeSec) }];
  }).slice(-100);
  normalized.daily = Array.isArray(raw.daily) ? raw.daily.flatMap(value => {
    const row = object(value);
    if (!validDate(row.date) || !Number.isSafeInteger(row.total) || Number(row.total) < 0 ||
      !Number.isSafeInteger(row.activeSec) || Number(row.activeSec) < 0) return [];
    return [{ date: row.date, total: count(row.total), solved: Math.min(count(row.total), count(row.solved)),
      hinted: Math.min(count(row.total), count(row.hinted)), activeSec: count(row.activeSec) }];
  }).filter((row, i, rows) => rows.findIndex(other => other.date === row.date) === i)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-7) : aggregateDays(normalized.recent);
  return normalized;
}
export function puzzleSummary(data: PuzzleData | undefined, today: string, days = 7) {
  const dates = new Set(lastNDays(days, today));
  const rows = (data?.daily ?? aggregateDays(data?.recent ?? [])).filter(row => dates.has(row.date));
  const sum = rows.reduce((sum, row) => ({ total: sum.total + row.total, solved: sum.solved + row.solved,
    hinted: sum.hinted + row.hinted, activeSec: sum.activeSec + row.activeSec }), { total: 0, solved: 0, hinted: 0, activeSec: 0 });
  return { ...sum, correctRate: sum.total ? Math.round(sum.solved / sum.total * 100) : 0 };
}
