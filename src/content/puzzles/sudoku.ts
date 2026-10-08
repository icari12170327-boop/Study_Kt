import { randInt, shuffle, type Rng } from '../../lib/random';
import { gridMatches, type Difficulty, type NumberGrid, type PuzzleGenerator } from './types';

export interface SudokuView extends NumberGrid { size: number; boxRows: number; boxCols: number }
/** 풀이 탐색도 상한을 둔다. 상한에 도달한 판은 생성할 때 채택하지 않는다. */
export function solveSudoku(rows: number[][], boxRows: number, boxCols: number, maxNodes = 50_000) {
  const size = rows.length;
  const grid = rows.map(row => [...row]);
  let count = 0;
  let nodes = 0;
  let solution: number[][] | undefined;
  let exhausted = false;
  if (![4, 6].includes(size) || boxRows * boxCols !== size || size % boxRows || size % boxCols ||
    grid.some(row => row.length !== size || row.some(n => !Number.isInteger(n) || n < 0 || n > size))) {
    return { count, solution, exhausted };
  }
  const allowed = (r: number, c: number, n: number) => {
    for (let i = 0; i < size; i++) if ((i !== c && grid[r][i] === n) || (i !== r && grid[i][c] === n)) return false;
    const br = Math.floor(r / boxRows) * boxRows, bc = Math.floor(c / boxCols) * boxCols;
    for (let i = br; i < br + boxRows; i++) for (let j = bc; j < bc + boxCols; j++) {
      if ((i !== r || j !== c) && grid[i][j] === n) return false;
    }
    return true;
  };
  if (grid.some((row, r) => row.some((n, c) => n !== 0 && !allowed(r, c, n)))) return { count, solution, exhausted };
  const search = () => {
    if (count >= 2 || exhausted) return;
    if (++nodes > maxNodes) { exhausted = true; return; }
    let best: { r: number; c: number; candidates: number[] } | undefined;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!grid[r][c]) {
      const candidates = Array.from({ length: size }, (_, i) => i + 1).filter(n => allowed(r, c, n));
      if (!candidates.length) return;
      if (!best || candidates.length < best.candidates.length) best = { r, c, candidates };
    }
    if (!best) { count++; solution ??= grid.map(row => [...row]); return; }
    for (const n of best.candidates) {
      grid[best.r][best.c] = n;
      search();
      grid[best.r][best.c] = 0;
      if (count >= 2 || exhausted) break;
    }
  };
  search();
  return { count, solution, exhausted };
}

export const sudokuGenerator: PuzzleGenerator<SudokuView, number[][]> = {
  type: 'sudoku',
  generate(difficulty: Difficulty, rng: Rng) {
    const seed = randInt(0, 0xffffffff, rng);
    const size = difficulty <= 3 ? 4 : 6;
    const boxRows = 2, boxCols = size / 2;
    const order = (groups: number, width: number) => shuffle(Array.from({ length: groups }, (_, i) => i), rng)
      .flatMap(group => shuffle(Array.from({ length: width }, (_, i) => group * width + i), rng));
    const rowOrder = order(size / boxRows, boxRows), colOrder = order(size / boxCols, boxCols);
    const symbols = shuffle(Array.from({ length: size }, (_, i) => i + 1), rng);
    const answer = rowOrder.map(r => colOrder.map(c => symbols[(r * boxCols + Math.floor(r / boxRows) + c) % size]));
    const rows = answer.map(row => [...row]);
    const target = [4, 6, 8, 14, 20][difficulty - 1];
    let removed = 0;
    // 한 번의 유한한 순회로 끝낸다. 목표보다 빈칸이 적어도 유일 해를 우선한다.
    for (const index of shuffle(Array.from({ length: size * size }, (_, i) => i), rng)) {
      if (removed >= target) break;
      const r = Math.floor(index / size), c = index % size, value = rows[r][c];
      rows[r][c] = 0;
      const solved = solveSudoku(rows, boxRows, boxCols);
      if (solved.count === 1 && !solved.exhausted) removed++;
      else rows[r][c] = value;
    }
    return { type: 'sudoku', difficulty, seed, view: { rows, size, boxRows, boxCols }, answer,
      hint: `가로, 세로, 굵은 선 안에 1부터 ${size}까지 한 번씩 넣어요.` };
  },
  check(puzzle, input) { return gridMatches(puzzle.answer, input); },
};
