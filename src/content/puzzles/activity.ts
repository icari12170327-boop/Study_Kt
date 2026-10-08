import { activeDuration } from '../math/adaptive';
export const PUZZLE_IDLE_MS = 15_000;
export const PUZZLE_HINT_MS = 120_000;
export interface PuzzleClock { activeMs: number; lastAt: number; running: boolean }
export function startPuzzleClock(now: number): PuzzleClock { return { activeMs: 0, lastAt: now, running: true }; }
export function puzzleActiveMs(clock: PuzzleClock, now: number): number {
  return clock.activeMs + (clock.running ? activeDuration([clock.lastAt, now], PUZZLE_IDLE_MS) : 0);
}
export function puzzlePaused(clock: PuzzleClock, now: number): boolean {
  return !clock.running || now - clock.lastAt >= PUZZLE_IDLE_MS;
}
export function puzzleActivity(clock: PuzzleClock, now: number): PuzzleClock {
  return { activeMs: puzzleActiveMs(clock, now), lastAt: now, running: true };
}
export function pausePuzzleClock(clock: PuzzleClock, now: number): PuzzleClock {
  return { activeMs: puzzleActiveMs(clock, now), lastAt: now, running: false };
}
