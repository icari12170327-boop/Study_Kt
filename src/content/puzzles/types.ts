import type { Rng } from '../../lib/random';

export type PuzzleType = 'sudoku' | 'train' | 'pyramid' | 'balance' | 'pattern' | 'blocks';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export interface Puzzle<V = unknown, A = unknown> {
  type: PuzzleType;
  difficulty: Difficulty;
  seed: number;
  view: V;
  answer: A;
  hint: string;
}
export interface PuzzleGenerator<V = unknown, A = unknown> {
  type: PuzzleType;
  generate(difficulty: Difficulty, rng: Rng): Puzzle<V, A>;
  check(puzzle: Puzzle<V, A>, input: unknown): boolean;
}
export interface PuzzleLevel {
  level: Difficulty;
  streak: number;
  fails: number;
  solved: number;
  hinted: number;
}
export interface PuzzleRecord {
  date: string;
  type: PuzzleType;
  difficulty: Difficulty;
  correct: boolean;
  hinted: boolean;
  activeSec: number;
}
export interface PuzzleData {
  levels: Partial<Record<PuzzleType, PuzzleLevel>>;
  recent: PuzzleRecord[];
  /** 최근 기록 100개 제한과 별개로 최근 7일 합계를 유지한다. */
  daily?: { date: string; total: number; solved: number; hinted: number; activeSec: number }[];
}
export interface PuzzleResult {
  correct: boolean;
  hinted: boolean;
  revealed: boolean;
  wrong: number;
}
export interface NumberGrid { rows: number[][] }
export function gridMatches(answer: number[][], input: unknown): boolean {
  return Array.isArray(input) && input.length === answer.length && answer.every((row, r) =>
    Array.isArray(input[r]) && input[r].length === row.length && row.every((n, c) => n === input[r][c]));
}
