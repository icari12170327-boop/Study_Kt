import { randInt, shuffle } from '../../lib/random';
import { gridMatches, type NumberGrid, type PuzzleGenerator } from './types';
export function pyramidRows(base: number[]): number[][] {
  const rows = [[...base]];
  while (rows[0].length > 1) rows.unshift(rows[0].slice(0, -1).map((n, i) => n + rows[0][i + 1]));
  return rows;
}
/** 밑칸을 미지수로 두고 주어진 칸의 일차식을 소거한다. 완전한 계수일 때만 유일 해다. */
export function solvePyramid(rows: number[][]): number[][] | null {
  const size = rows.length;
  if (size < 3 || size > 5 || rows.some((row, r) => row.length !== r + 1 || row.some(n => !Number.isSafeInteger(n) || n < 0))) return null;
  const coefficients: number[][][] = [Array.from({ length: size }, (_, c) => Array.from({ length: size }, (_, i) => +(i === c)))];
  while (coefficients[0].length > 1) coefficients.unshift(coefficients[0].slice(0, -1)
    .map((cell, c) => cell.map((n, i) => n + coefficients[0][c + 1][i])));
  const equations = rows.flatMap((row, r) => row.flatMap((n, c) => n ? [[...coefficients[r][c], n]] : []));
  let rank = 0;
  for (let column = 0; column < size; column++) {
    const pivot = equations.findIndex((row, r) => r >= rank && Math.abs(row[column]) > 1e-8);
    if (pivot < 0) continue;
    [equations[rank], equations[pivot]] = [equations[pivot], equations[rank]];
    const divisor = equations[rank][column];
    equations[rank] = equations[rank].map(n => n / divisor);
    for (let r = 0; r < equations.length; r++) if (r !== rank) {
      const factor = equations[r][column];
      equations[r] = equations[r].map((n, i) => n - factor * equations[rank][i]);
    }
    rank++;
  }
  if (rank !== size || equations.some(row => row.slice(0, size).every(n => Math.abs(n) < 1e-8) && Math.abs(row[size]) > 1e-8)) return null;
  const base = equations.slice(0, size).map(row => Math.round(row[size]));
  if (base.some((n, i) => n <= 0 || Math.abs(n - equations[i][size]) > 1e-8)) return null;
  const answer = pyramidRows(base);
  return rows.every((row, r) => row.every((n, c) => !n || n === answer[r][c])) ? answer : null;
}
export const pyramidGenerator: PuzzleGenerator<NumberGrid, number[][]> = {
  type: 'pyramid',
  generate(difficulty, rng) {
    const seed = randInt(0, 0xffffffff, rng), size = [3, 3, 4, 4, 5][difficulty - 1];
    const answer = pyramidRows(Array.from({ length: size }, () => randInt(1, difficulty <= 2 ? 5 : 9, rng)));
    const rows = answer.map(row => [...row]);
    const cells = rows.flatMap((row, r) => row.map((_, c) => ({ r, c }))).filter(cell => difficulty >= 3 || cell.r < size - 1);
    const order = shuffle(cells, rng);
    if (difficulty >= 3) {
      const bottom = order.findIndex(cell => cell.r === size - 1);
      [order[0], order[bottom]] = [order[bottom], order[0]];
    }
    let removed = 0;
    for (const { r, c } of order) {
      if (removed >= [2, 3, 5, 6, 10][difficulty - 1]) break;
      const value = rows[r][c];
      rows[r][c] = 0;
      if (solvePyramid(rows)) removed++;
      else rows[r][c] = value;
    }
    return { type: 'pyramid', difficulty, seed, view: { rows }, answer, hint: '위 칸은 바로 아래 두 칸을 더한 수예요. 아래가 비었으면 빼 보세요.' };
  },
  check(puzzle, input) { return gridMatches(puzzle.answer, input); },
};
