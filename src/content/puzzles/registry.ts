import { seededRng } from '../../lib/random';
import { sudokuGenerator } from './sudoku';
import { trainGenerator } from './train';
import { pyramidGenerator } from './pyramid';
import type { Difficulty, PuzzleGenerator, PuzzleType } from './types';

export const PUZZLE_TYPES: PuzzleType[] = ['sudoku', 'train', 'pyramid', 'balance', 'pattern', 'blocks'];
export const GENERATORS: Partial<Record<PuzzleType, PuzzleGenerator>> = {
  sudoku: sudokuGenerator, train: trainGenerator, pyramid: pyramidGenerator,
};
export const PUZZLE_LABELS: Record<PuzzleType, string> = {
  sudoku: '스도쿠', train: '숫자 기차', pyramid: '수 피라미드', balance: '저울', pattern: '도형 규칙', blocks: '블록 세기',
};
export function registeredPuzzleTypes(): PuzzleType[] { return PUZZLE_TYPES.filter(type => !!GENERATORS[type]); }
export function generatePuzzle(type: PuzzleType, difficulty: Difficulty, seed: number) {
  const generator = GENERATORS[type];
  if (!generator) throw new Error('아직 준비되지 않은 퍼즐이에요.');
  // 원래 시드를 남겨 화면에서도 같은 판을 재현할 수 있다.
  return { ...generator.generate(difficulty, seededRng(seed)), seed };
}
