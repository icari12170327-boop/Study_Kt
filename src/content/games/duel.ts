import type { Level, MathProblem } from '../../types';
import { seededRng } from '../../lib/random';
import { buildLevelQueue } from '../math/session';

export function duelQueue(grade: Level, level: number, seed: number): MathProblem[] {
  return buildLevelQueue(grade, level, [], 10, seededRng(seed)).map(item => item.problem);
}
export function duelScore(correct: number, remainingMs: number): number {
  return Math.max(0, Math.min(10, Math.floor(correct))) * 10 + Math.floor(Math.max(0, Math.min(90000, remainingMs)) / 1000);
}
export function duelWinner(a: number, b: number): 'a' | 'b' | 'tie' { return a > b ? 'a' : a < b ? 'b' : 'tie'; }
