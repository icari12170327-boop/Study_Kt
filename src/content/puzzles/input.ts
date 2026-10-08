import type { Cell } from '../math/bingo';
export type GridPuzzleType = 'sudoku' | 'pyramid';
/** 스도쿠는 새 한 자리로 교체한다. 피라미드 최대 정답 144는 세 자리 칸에 들어간다. */
export function puzzleCellInput(previous: string, value: string, type: GridPuzzleType, size: number): string {
  if (type === 'pyramid') return /^\d{0,3}$/.test(value) ? value : previous;
  // NumberPad는 현재 값 뒤에 눌린 숫자를 붙여 보내므로 그 한 자리만 받는다.
  const digit = value.length === previous.length + 1 && value.startsWith(previous) ? value.slice(-1) : value;
  return digit === '' || (/^[1-9]$/.test(digit) && Number(digit) <= size) ? digit : previous;
}
export function setPuzzleGridInput(input: string[][], cell: Cell, value: string, type: GridPuzzleType): string[][] {
  const previous = input[cell.r]?.[cell.c];
  if (previous === undefined) return input;
  const next = puzzleCellInput(previous, value, type, input.length);
  if (next === previous) return input;
  return input.map((row, r) => row.map((number, c) => r === cell.r && c === cell.c ? next : number));
}
export function completePuzzleGrid(input: unknown, type: GridPuzzleType): boolean {
  if (!Array.isArray(input)) return false;
  const size = input.length;
  if (type === 'sudoku' ? ![4, 6].includes(size) : size < 3 || size > 5) return false;
  return input.every((row, r) => Array.isArray(row) && row.length === (type === 'sudoku' ? size : r + 1) &&
    row.every(value => typeof value === 'string' && (type === 'sudoku' ? /^[1-9]$/.test(value) && Number(value) <= size : /^\d{1,3}$/.test(value))));
}
