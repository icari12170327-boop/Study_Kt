import type { AppState, GameId, GameRecord, MathAttempt, ProfileData, ProfileSettings } from '../../types';
import { addDays, parseDateKey, toDateKey } from '../../lib/date';
import { normalizeProblem } from './fishing';
import { duelWinner } from './duel';

export const GAME_DURATION_MS = 90000;
export function roundRemaining(startedAt: number, now: number): number { return Math.max(0, GAME_DURATION_MS - Math.max(0, now - startedAt)); }
export function validGameDate(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) && toDateKey(parseDateKey(raw)) === raw;
}
export function normalizeGamesPerDay(raw: unknown): number { return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : 3; }
export function gamesPlayedToday(records: readonly GameRecord[], today: string): number { return records.filter(row => row.date === today).length; }
export function canPlay(settings: ProfileSettings, data: ProfileData, today: string): { ok: true } | { ok: false; reason: 'math-not-done' | 'limit' } {
  const math = settings.missions.find(row => row.type === 'math');
  if (!math?.enabled || math.target <= 0 || (data.days[today]?.progress.math ?? 0) < math.target) return { ok: false, reason: 'math-not-done' };
  if (gamesPlayedToday(data.games ?? [], today) >= normalizeGamesPerDay(settings.gamesPerDay)) return { ok: false, reason: 'limit' };
  return { ok: true };
}
export function crownVisible(crownUntil: string | undefined, today: string): boolean { return validGameDate(crownUntil) && crownUntil >= today; }
export function nextDay(date: string): string { return addDays(date, 1); }
export function normalizeGames(raw: unknown): GameRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row): GameRecord[] => {
    if (!row || !validGameDate(row.date) || !['fishing', 'duel', 'obby'].includes(row.game) || !Number.isInteger(row.score) || row.score < 0) return [];
    return [{ date: row.date, game: row.game, score: row.score,
      ...(Number.isInteger(row.caught) && row.caught >= 0 ? { caught: row.caught } : {}),
      ...(Number.isInteger(row.golden) && row.golden >= 0 && row.golden <= row.caught ? { golden: row.golden } : {}),
      ...(['kid1', 'kid2'].includes(row.opponent) ? { opponent: row.opponent } : {}),
      ...(typeof row.won === 'boolean' ? { won: row.won } : {}),
      ...(Number.isSafeInteger(row.stage) && row.stage >= 0 ? { stage: row.stage } : {}) }];
  }).slice(-60);
}
/** 기존 학습 평가 값은 유지하고 문제 본문만 오늘의 정상 문제로 제한한다. */
export function normalizeGameAttempts(raw: unknown, date: string, today: string): MathAttempt[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(row => row && typeof row === 'object').map(row => {
    const { problem: rawProblem, story, ...attempt } = row;
    const problem = date === today ? normalizeProblem(rawProblem) : undefined;
    return { ...attempt, ...(story === true ? { story: true } : {}), ...(problem ? { problem } : {}) } as MathAttempt;
  });
}
/** 시작할 때 한 판을 확보한다. 중단도 한 판으로 세고 학습 기록에는 손대지 않는다. */
export function reserveGame(settings: ProfileSettings, data: ProfileData, today: string, game: GameId): number | null {
  if (!canPlay(settings, data, today).ok) return null;
  data.games = [...(data.games ?? []), { date: today, game, score: 0 }].slice(-60);
  return data.games.length - 1;
}
export function finishGame(data: ProfileData, index: number, record: GameRecord): void {
  if (data.games?.[index]?.date === record.date && data.games[index].game === record.game) data.games[index] = { ...record };
}
export function reserveDuel(state: AppState, today: string): { kid1: number; kid2: number } | null {
  if (!canPlay(state.settings.kid1, state.data.kid1, today).ok || !canPlay(state.settings.kid2, state.data.kid2, today).ok) return null;
  return { kid1: reserveGame(state.settings.kid1, state.data.kid1, today, 'duel')!, kid2: reserveGame(state.settings.kid2, state.data.kid2, today, 'duel')! };
}
export function finishDuel(state: AppState, slots: { kid1: number; kid2: number }, today: string, a: number, b: number): void {
  const winner = duelWinner(a, b);
  for (const id of ['kid1', 'kid2'] as const) {
    const won = winner === 'tie' || winner === (id === 'kid1' ? 'a' : 'b');
    finishGame(state.data[id], slots[id], { date: today, game: 'duel', score: id === 'kid1' ? a : b, opponent: id === 'kid1' ? 'kid2' : 'kid1', won });
    if (won) state.data[id].crownUntil = nextDay(today);
  }
}
