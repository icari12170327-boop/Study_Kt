import type { BingoRecord, Level, ProfileData, ProfileSettings } from '../../types';
import { randInt, shuffle, type Rng } from '../../lib/random';
import { parseDateKey, toDateKey } from '../../lib/date';

export type Cell = { r: number; c: number };
export type BingoOp = 'sum' | 'product';
export type ProductMix = 'off' | 'few' | 'normal' | 'many';
export interface BingoGoal { op: BingoOp; target: number }
export interface BingoBoard { size: number; grid: number[][]; goals: BingoGoal[] }
export const MAX_BOARD_ATTEMPTS = 40;
const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
const same = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;
const integerCell = (a: Cell) => Number.isInteger(a.r) && Number.isInteger(a.c) && a.r >= 0 && a.c >= 0;
export function isStraightLine(cells: Cell[]): boolean {
  if (cells.length !== 3 || !cells.every(integerCell)) return false;
  const [a, b, c] = cells, dr = b.r - a.r, dc = b.c - a.c;
  return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0) && c.r - b.r === dr && c.c - b.c === dc;
}
export function lineFromEnds(a: Cell, b: Cell): Cell[] | null {
  if (!integerCell(a) || !integerCell(b)) return null;
  const cells = [a, { r: (a.r + b.r) / 2, c: (a.c + b.c) / 2 }, b];
  return isStraightLine(cells) ? cells : null;
}
function allLines(board: BingoBoard): Cell[][] {
  const lines: Cell[][] = [];
  for (let r = 0; r < board.size; r++) for (let c = 0; c < board.size; c++) for (const [dr, dc] of DIRECTIONS) {
    const end = { r: r + 2 * dr, c: c + 2 * dc };
    if (end.r >= 0 && end.r < board.size && end.c >= 0 && end.c < board.size)
      lines.push([{ r, c }, { r: r + dr, c: c + dc }, end]);
  }
  return lines;
}
const valuesFor = (board: BingoBoard, cells: Cell[]) => cells.map(cell => board.grid[cell.r][cell.c]);
const calculate = (values: number[], op: BingoOp) => values.reduce((a, b) => op === 'sum' ? a + b : a * b, op === 'sum' ? 0 : 1);
export function checkLine(board: BingoBoard, goal: BingoGoal, cells: Cell[]):
  { ok: true } | { ok: false; reason: 'not-line' } | { ok: false; reason: 'wrong'; values: number[]; result: number } {
  if (!isStraightLine(cells) || cells.some(cell => cell.r >= board.size || cell.c >= board.size || !Number.isFinite(board.grid[cell.r]?.[cell.c]))) return { ok: false, reason: 'not-line' };
  const values = valuesFor(board, cells), result = calculate(values, goal.op);
  return result === goal.target ? { ok: true } : { ok: false, reason: 'wrong', values, result };
}
export function findLines(board: BingoBoard, goal: BingoGoal): Cell[][] {
  return allLines(board).filter(line => checkLine(board, goal, line).ok);
}
function signatures(board: BingoBoard, goal: BingoGoal): string[] {
  return findLines(board, goal).map(line => valuesFor(board, line).sort((a, b) => a - b).join(','));
}
function candidates(board: BingoBoard, op: BingoOp, level: 'g3' | 'g5'): BingoGoal[] {
  const low = op === 'product' ? 12 : level === 'g3' ? 6 : 10, high = op === 'product' ? 400 : level === 'g3' ? 24 : 50;
  const targets = new Map<number, number[][]>();
  for (const line of allLines(board)) {
    const values = valuesFor(board, line), target = calculate(values, op);
    const list = targets.get(target) ?? [];
    list.push(values); targets.set(target, list);
  }
  return [...targets].filter(([target, lines]) => target >= low && target <= high && lines.length <= 4 && (op === 'sum' || lines.every(values => !values.includes(1))))
    .map(([target]) => ({ op, target }));
}
function goalsFor(board: BingoBoard, level: 'g3' | 'g5', products: number, rng: Rng): BingoGoal[] | undefined {
  const chosen = shuffle(candidates(board, 'product', level), rng).slice(0, products);
  if (chosen.length !== products) return;
  const used = new Set(chosen.flatMap(goal => signatures(board, goal)));
  const sums = shuffle(candidates(board, 'sum', level), rng).filter(goal => !chosen.some(row => row.target === goal.target) && !signatures(board, goal).some(key => used.has(key))).slice(0, 5 - products);
  return sums.length + products === 5 ? shuffle([...chosen, ...sums], rng) : undefined;
}
const FALLBACK_G3 = [[9, 3, 9, 2, 9], [3, 4, 6, 8, 3], [6, 3, 8, 5, 6], [5, 4, 8, 4, 6], [5, 6, 9, 3, 7]];
const FALLBACK_G5 = [[20, 17, 11, 7, 8], [7, 9, 5, 10, 3], [6, 14, 5, 8, 1], [4, 4, 8, 1, 12], [7, 1, 12, 20, 14]];
/** 재시도 상한에 닿으면 목표·정답 줄 개수를 검증한 예비 판을 쓴다. */
export function generateBingoBoard(level: 'g3' | 'g5', rng: Rng, opts?: { productMix?: ProductMix }): BingoBoard {
  const mix = opts?.productMix ?? 'normal', products = level === 'g3' || mix === 'off' ? 0 : mix === 'few' ? 1 : mix === 'many' ? 4 : randInt(2, 3, rng);
  const size = 5;
  for (let attempt = 0; attempt < MAX_BOARD_ATTEMPTS; attempt++) {
    const values = shuffle(Array.from({ length: size * size }, (_, i) => randInt(1, level === 'g3' ? 9 : products && i < Math.floor(size * size / 2) ? 12 : 20, rng)), rng);
    const board: BingoBoard = { size, grid: Array.from({ length: size }, (_, r) => values.slice(r * size, (r + 1) * size)), goals: [] };
    const goals = goalsFor(board, level, products, rng);
    if (goals) return { ...board, goals };
  }
  const sums = level === 'g3' ? [21, 10, 20, 23, 15] : [48, 33, 34, 35, 40];
  const goals: BingoGoal[] = [...[275, 400, 315, 150].slice(0, products).map(target => ({ op: 'product' as const, target })),
    ...sums.slice(0, 5 - products).map(target => ({ op: 'sum' as const, target }))];
  return { size, grid: (level === 'g3' ? FALLBACK_G3 : FALLBACK_G5).map(row => [...row]), goals: shuffle(goals, rng) };
}
export interface BingoClock { limitMs: number; remainingMs: number; runningSince?: number }
export function startClock(limitSec: number, now: number): BingoClock {
  const limitMs = Number.isFinite(limitSec) ? Math.max(0, limitSec * 1000) : 0;
  return { limitMs, remainingMs: limitMs, runningSince: now };
}
export function remaining(clock: BingoClock, now: number): number {
  return Math.max(0, clock.remainingMs - (clock.runningSince === undefined ? 0 : Math.max(0, now - clock.runningSince)));
}
export function pauseClock(clock: BingoClock, now: number): BingoClock {
  return { limitMs: clock.limitMs, remainingMs: remaining(clock, now) };
}
export function resumeClock(clock: BingoClock, now: number): BingoClock {
  return clock.runningSince === undefined ? { ...clock, runningSince: now } : { ...clock };
}
export function adjustClock(clock: BingoClock, now: number, deltaMs: number): BingoClock {
  return { ...clock, remainingMs: Math.max(0, Math.min(clock.limitMs, remaining(clock, now) + deltaMs)),
    ...(clock.runningSince !== undefined ? { runningSince: now } : {}) };
}
export function bingoBestKey(size: number, limitSec: number): string {
  return `${size}x${size}-${limitSec}`;
}
export function updateBest(best: Record<string, BingoRecord>, rec: BingoRecord, size = 5): { best: Record<string, BingoRecord>; isNew: boolean } {
  const key = bingoBestKey(size, rec.limitSec), old = best[key];
  // 0개인 판은 최근 기록에만 남기고 최고 기록으로 축하하지 않는다.
  const isNew = rec.found > 0 && (!old || rec.found > old.found || (rec.found === old.found && rec.hints < old.hints));
  return { best: isNew ? { ...best, [key]: { ...rec } } : { ...best }, isNew };
}
export function defaultBingoSettings(level: Level): NonNullable<ProfileSettings['bingo']> {
  return { enabled: level !== 'adult', productMix: level === 'g5' ? 'normal' : 'off', limitSec: level === 'g3' ? 180 : 120 };
}
function object(raw: unknown): Record<string, unknown> { return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}; }
export function normalizeBingoSettings(raw: unknown, level: Level): NonNullable<ProfileSettings['bingo']> {
  const row = object(raw), base = defaultBingoSettings(level);
  return { enabled: typeof row.enabled === 'boolean' ? row.enabled && level !== 'adult' : base.enabled,
    productMix: level !== 'g5' ? 'off' : ['off', 'few', 'normal', 'many'].includes(String(row.productMix)) ? row.productMix as ProductMix : base.productMix,
    limitSec: typeof row.limitSec === 'number' && Number.isInteger(row.limitSec) && row.limitSec >= 60 && row.limitSec <= 300 && row.limitSec % 30 === 0 ? row.limitSec : base.limitSec };
}
function validRecord(raw: unknown): BingoRecord | undefined {
  const row = object(raw);
  if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || toDateKey(parseDateKey(row.date)) !== row.date || !['g3', 'g5'].includes(String(row.level)) ||
    !['limitSec', 'found', 'bingos', 'hints'].every(key => typeof row[key] === 'number' && Number.isSafeInteger(row[key]) && Number(row[key]) >= 0)) return;
  return { date: row.date, level: row.level as Level, limitSec: row.limitSec as number, found: row.found as number, bingos: row.bingos as number, hints: row.hints as number };
}
export function normalizeBingoData(raw: unknown): NonNullable<ProfileData['bingo']> {
  const row = object(raw);
  const recent = (Array.isArray(row.recent) ? row.recent.map(validRecord).filter((rec): rec is BingoRecord => !!rec) : []).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  const best: Record<string, BingoRecord> = {};
  const legacyG3: BingoRecord[] = [];
  for (const [key, value] of Object.entries(object(row.best))) {
    const rec = validRecord(value);
    if (!rec) continue;
    // 둘째의 예전 숫자 키는 이미 5×5 기록이다. 첫째의 6×6 숫자 키만 따로 보존한다.
    if (key === String(rec.limitSec) && rec.level === 'g3') legacyG3.push(rec);
    else if ([String(rec.limitSec), bingoBestKey(5, rec.limitSec), bingoBestKey(6, rec.limitSec)].includes(key)) best[key] = rec;
  }
  for (const rec of legacyG3) {
    const key = bingoBestKey(5, rec.limitSec);
    // 새 키를 먼저 읽어 동점이면 새 키를 유지하고, 더 좋은 예전 기록은 이어 받는다.
    best[key] = best[key] ? updateBest(best, rec).best[key] : rec;
  }
  return { recent, best };
}
/** 자유 놀이 기록만 갱신하고 학습 진행·보상을 건드리지 않는다. */
export function recordBingo(data: ProfileData, rec: BingoRecord, size = 5): boolean {
  const saved = data.bingo ?? { recent: [], best: {} }, result = updateBest(saved.best, rec, size);
  data.bingo = { recent: [{ ...rec }, ...saved.recent].slice(0, 20), best: result.best };
  return result.isNew;
}
export function toggleCell(selected: Cell[], cell: Cell): Cell[] {
  return selected.some(row => same(row, cell)) ? selected.filter(row => !same(row, cell)) : [...selected, cell];
}
export function moveCell(cell: Cell, key: string, size: number): Cell {
  const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0, dc = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
  return { r: Math.max(0, Math.min(size - 1, cell.r + dr)), c: Math.max(0, Math.min(size - 1, cell.c + dc)) };
}

export type BingoMode = 'time' | 'practice';
export type BingoPhase = 'countdown' | 'playing' | 'bingo' | 'paused' | 'ended';
export interface BingoGame {
  level: 'g3' | 'g5'; productMix: ProductMix; limitSec: number; mode: BingoMode;
  phase: BingoPhase; pausedPhase?: 'countdown' | 'playing' | 'bingo';
  board: BingoBoard; goalIndex: number; selected: Cell[]; cursor: Cell; lines: Cell[][];
  found: number; bingos: number; hints: number; boardFound: number;
  clock: BingoClock; countdown: BingoClock;
  elapsedMs: number; activeSince?: number; goalStartedMs: number; passReadyMs: number;
  hinted: boolean; hintCell?: Cell; transitionMs?: number;
  feedback?: { kind: 'correct' | 'wrong' | 'not-line' | 'pass' | 'hint'; text: string; cells: Cell[]; atMs: number };
}
export type BingoAction = { type: 'tick' | 'pause' | 'resume' | 'hint' | 'pass' | 'undo' | 'clear' }
  | { type: 'select'; cell: Cell } | { type: 'line'; cells: Cell[] } | { type: 'move'; key: string };
export function startBingoGame(level: 'g3' | 'g5', settings: NonNullable<ProfileSettings['bingo']>, mode: BingoMode, rng: Rng, now: number): BingoGame {
  return { level, productMix: settings.productMix, limitSec: settings.limitSec, mode,
    phase: mode === 'time' ? 'countdown' : 'playing', board: generateBingoBoard(level, rng, settings),
    goalIndex: 0, selected: [], cursor: { r: 0, c: 0 }, lines: [], found: 0, bingos: 0, hints: 0, boardFound: 0,
    clock: pauseClock(startClock(settings.limitSec, now), now), countdown: startClock(3, now),
    elapsedMs: 0, ...(mode === 'practice' ? { activeSince: now } : {}), goalStartedMs: 0, passReadyMs: 0, hinted: false };
}
/** 힌트와 패스도 실제 시간 차이를 쓰고, 멈춰 있던 시간은 포함하지 않는다. */
export function bingoElapsed(game: BingoGame, now: number): number {
  return game.elapsedMs + (game.activeSince === undefined ? 0 : Math.max(0, now - game.activeSince));
}
export function canBingoHint(game: BingoGame, now: number): boolean {
  return game.phase === 'playing' && !game.hinted && bingoElapsed(game, now) - game.goalStartedMs >= (game.mode === 'time' ? 20000 : 40000)
    && (game.mode === 'practice' || remaining(game.clock, now) > 0);
}
export function canBingoPass(game: BingoGame, now: number): boolean {
  return game.phase === 'playing' && bingoElapsed(game, now) >= game.passReadyMs && (game.mode === 'practice' || remaining(game.clock, now) > 0);
}
function endGame(game: BingoGame, now: number): BingoGame {
  return { ...game, phase: 'ended', selected: [], elapsedMs: bingoElapsed(game, now), activeSince: undefined, clock: pauseClock(game.clock, now) };
}
function tickGame(game: BingoGame, now: number, rng: Rng): BingoGame {
  if (game.phase === 'countdown' && remaining(game.countdown, now) === 0) {
    const started = (game.countdown.runningSince ?? now) + game.countdown.remainingMs;
    game = { ...game, phase: 'playing', clock: resumeClock(game.clock, started), activeSince: started };
  }
  if ((game.phase === 'playing' || game.phase === 'bingo') && game.mode === 'time' && remaining(game.clock, now) === 0) return endGame(game, now);
  if (game.phase === 'bingo' && bingoElapsed(game, now) >= (game.transitionMs ?? 0)) {
    return { ...game, phase: 'playing', board: generateBingoBoard(game.level, rng, { productMix: game.productMix }),
      goalIndex: 0, boardFound: 0, selected: [], lines: [], hinted: false, hintCell: undefined, feedback: undefined, goalStartedMs: bingoElapsed(game, now) };
  }
  return game;
}
function advanceGoal(game: BingoGame, now: number): BingoGame {
  const next = { ...game, goalIndex: game.goalIndex + 1, selected: [], hinted: false, hintCell: undefined, goalStartedMs: bingoElapsed(game, now) };
  if (next.goalIndex < 5) return next;
  next.bingos += next.boardFound === 5 ? 1 : 0;
  return next.mode === 'practice' ? endGame(next, now) : { ...next, phase: 'bingo', transitionMs: bingoElapsed(next, now) + 900 };
}
function gradeGame(game: BingoGame, cells: Cell[], now: number): BingoGame {
  const goal = game.board.goals[game.goalIndex], result = checkLine(game.board, goal, cells), atMs = bingoElapsed(game, now);
  if (result.ok) {
    const next: BingoGame = { ...game, found: game.found + 1, boardFound: game.boardFound + 1, lines: [...game.lines, cells.map(cell => ({ ...cell }))],
      clock: game.mode === 'time' ? adjustClock(game.clock, now, 5000) : game.clock, feedback: { kind: 'correct', text: '딩! 찾았어요', cells, atMs } };
    return advanceGoal(next, now);
  }
  return { ...game, selected: [], feedback: result.reason === 'not-line'
    ? { kind: 'not-line', text: '한 줄로 붙어 있는 3칸을 골라요', cells, atMs }
    : { kind: 'wrong', text: `${result.values.join(goal.op === 'sum' ? ' + ' : ' × ')} = ${result.result}, 목표는 ${goal.target}야`, cells, atMs } };
}
/** 모든 입력 전에 종료 시각을 확인하므로 마지막 순간의 정답으로 시간이 살아나지 않는다. */
export function actBingo(game: BingoGame, action: BingoAction, now: number, rng: Rng): BingoGame {
  game = tickGame(game, now, rng);
  if (action.type === 'tick' || game.phase === 'ended') return game;
  if (action.type === 'pause' && game.phase !== 'paused') {
    return { ...game, pausedPhase: game.phase, phase: 'paused', selected: [], clock: pauseClock(game.clock, now), countdown: pauseClock(game.countdown, now),
      elapsedMs: bingoElapsed(game, now), activeSince: undefined };
  }
  if (action.type === 'resume' && game.phase === 'paused') {
    const phase = game.pausedPhase ?? 'playing';
    return { ...game, phase, pausedPhase: undefined, clock: phase === 'countdown' ? game.clock : resumeClock(game.clock, now),
      countdown: resumeClock(game.countdown, now), ...(phase !== 'countdown' ? { activeSince: now } : {}) };
  }
  if (game.phase !== 'playing') return game;
  switch (action.type) {
    case 'select': {
      if (!integerCell(action.cell) || action.cell.r >= game.board.size || action.cell.c >= game.board.size) return game;
      const selected = toggleCell(game.selected, action.cell), next = { ...game, selected, cursor: action.cell };
      return selected.length === 3 ? gradeGame(next, selected, now) : next;
    }
    case 'line': return gradeGame(game, action.cells, now);
    case 'move': return { ...game, cursor: moveCell(game.cursor, action.key, game.board.size) };
    case 'undo': return { ...game, selected: game.selected.slice(0, -1) };
    case 'clear': return { ...game, selected: [] };
    case 'pass': return canBingoPass(game, now) ? advanceGoal({ ...game, passReadyMs: bingoElapsed(game, now) + 3000,
      feedback: { kind: 'pass', text: '다음 문제로 가요', cells: [], atMs: bingoElapsed(game, now) } }, now) : game;
    case 'hint': {
      if (!canBingoHint(game, now)) return game;
      const next: BingoGame = { ...game, hinted: true, hints: game.hints + 1, hintCell: findLines(game.board, game.board.goals[game.goalIndex])[0][1],
        clock: game.mode === 'time' ? adjustClock(game.clock, now, -3000) : game.clock,
        feedback: { kind: 'hint', text: '반짝이는 칸을 가운데에 놓아요', cells: [], atMs: bingoElapsed(game, now) } };
      return tickGame(next, now, rng);
    }
    default: return game;
  }
}
