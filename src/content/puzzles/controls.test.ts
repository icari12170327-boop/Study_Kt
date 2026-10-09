import { describe, expect, it } from 'vitest';
import { seededRng } from '../../lib/random';
import { applyNumberKey } from '../../lib/numberPad';
import type { Cell } from '../math/bingo';
import { movePuzzleCell } from './navigation';
import { completePuzzleGrid, puzzleCellInput, setPuzzleGridInput } from './input';
import { sudokuGenerator } from './sudoku';
import { pyramidGenerator } from './pyramid';
import type { Difficulty } from './types';
const levels: Difficulty[] = [1, 2, 3, 4, 5];
const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const cellKey = (cell: Cell) => `${cell.r}:${cell.c}`;

function expectReachable(rows: number[][]) {
  const cells = rows.flatMap((row, r) => row.flatMap((n, c) => n === 0 ? [{ r, c }] : []));
  const expected = new Set(cells.map(cellKey));
  const visited = new Set([cellKey(cells[0])]);
  const queue = [cells[0]];
  for (let i = 0; i < queue.length; i++) for (const key of keys) {
    const next = movePuzzleCell(rows, queue[i], key);
    expect(rows[next.r]?.[next.c]).toBe(0);
    if (!visited.has(cellKey(next))) { visited.add(cellKey(next)); queue.push(next); }
  }
  expect(visited).toEqual(expected);
  // 좌우 한 방향만 계속 눌러도 모든 빈칸을 한 번씩 돌고 시작 칸으로 돌아온다.
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    let cursor = cells[0];
    const cycle = new Set<string>();
    for (let i = 0; i < cells.length; i++) { cycle.add(cellKey(cursor)); cursor = movePuzzleCell(rows, cursor, key); }
    expect(cycle).toEqual(expected); expect(cursor).toEqual(cells[0]);
  }
}
describe('방향키 빈칸 도달 회귀', () => {
  it('흩어진 빈칸·삼각형에서도 고립되지 않는다', () => {
    expectReachable([[0, 2, 3, 4], [1, 0, 3, 4], [1, 2, 0, 4], [1, 2, 3, 0]]);
    expectReachable([[0], [8, 0], [0, 4, 0], [1, 0, 3, 4]]);
  });
  it('위아래는 같은 열을 우선하고 없으면 해당 방향의 가까운 빈칸을 고른다', () => {
    expect(movePuzzleCell([[0, 2, 0], [1, 0, 3], [0, 4, 0]], { r: 2, c: 2 }, 'ArrowUp')).toEqual({ r: 0, c: 2 });
    expect(movePuzzleCell([[0], [8, 0], [0, 4, 0]], { r: 2, c: 2 }, 'ArrowUp')).toEqual({ r: 1, c: 1 });
    expect(movePuzzleCell([[0, 2, 3], [1, 0, 3], [0, 4, 0]], { r: 0, c: 0 }, 'ArrowDown')).toEqual({ r: 2, c: 0 });
  });
  it('빈칸 하나·빈 판·이동 키가 아닌 입력은 그대로 둔다', () => {
    for (const key of keys) expect(movePuzzleCell([[1, 0]], { r: 0, c: 1 }, key)).toEqual({ r: 0, c: 1 });
    expect(movePuzzleCell([], { r: 0, c: 0 }, 'ArrowDown')).toEqual({ r: 0, c: 0 });
    expect(movePuzzleCell([[0, 0]], { r: 0, c: 0 }, 'Enter')).toEqual({ r: 0, c: 0 });
  });
  for (const level of levels) it(`스도쿠 ${level}단계 300판의 모든 빈칸을 방문한다`, () => {
    for (let seed = 5000; seed < 5300; seed++) expectReachable(sudokuGenerator.generate(level, seededRng(seed)).view.rows);
  });
  for (const level of levels) it(`피라미드 ${level}단계 200판의 모든 빈칸을 방문한다`, () => {
    for (let seed = 5000; seed < 5200; seed++) expectReachable(pyramidGenerator.generate(level, seededRng(seed)).view.rows);
  });
});

describe('숫자 칸 입력 범위', () => {
  for (const size of [4, 5, 6]) it(`스도쿠 ${size}칸은 1~${size} 한 자리로 교체·삭제한다`, () => {
    let input = '';
    for (let n = 1; n <= size; n++) {
      input = puzzleCellInput(input, applyNumberKey(input, String(n)), 'sudoku', size);
      expect(input).toBe(String(n));
    }
    for (const key of ['0', String(size + 1), '9']) {
      expect(puzzleCellInput(input, applyNumberKey(input, key), 'sudoku', size)).toBe(input);
    }
    for (const invalid of ['123456789', '-1', '1.2', 'x']) expect(puzzleCellInput(input, invalid, 'sudoku', size)).toBe(input);
    expect(puzzleCellInput(input, applyNumberKey(input, 'Backspace'), 'sudoku', size)).toBe('');
    expect(puzzleCellInput(input, applyNumberKey(input, 'Delete'), 'sudoku', size)).toBe('');
    for (let i = 0; i < 50; i++) input = puzzleCellInput(input, applyNumberKey(input, '2'), 'sudoku', size);
    expect(input).toBe('2');
  });
  it('피라미드는 세 자리까지 받고 네 번째 숫자는 무시하며 지울 수 있다', () => {
    let input = '';
    for (const key of '123456789') input = puzzleCellInput(input, applyNumberKey(input, key), 'pyramid', 5);
    expect(input).toBe('123');
    input = puzzleCellInput(input, applyNumberKey(input, 'Backspace'), 'pyramid', 5);
    expect(input).toBe('12');
    expect(puzzleCellInput(input, applyNumberKey(input, 'Delete'), 'pyramid', 5)).toBe('');
    for (const invalid of ['123456789', '-1', '1.2', 'x']) expect(puzzleCellInput(input, invalid, 'pyramid', 5)).toBe(input);
  });
  it('5층 피라미드의 최대 정답 144도 입력 제한에 막히지 않는다', () => {
    const puzzle = pyramidGenerator.generate(5, () => 0.999999);
    expect(Math.max(...puzzle.answer.flat())).toBe(144);
    let value = '';
    for (const key of '144') value = puzzleCellInput(value, applyNumberKey(value, key), 'pyramid', 5);
    expect(value).toBe('144');
  });
  it('정상 답을 모두 입력할 수 있고 주어진 값과 원본 배열을 유지한다', () => {
    for (const level of levels) for (let seed = 0; seed < 100; seed++) {
      for (const generator of [sudokuGenerator, pyramidGenerator]) {
        const puzzle = generator.generate(level, seededRng(seed));
        let input = puzzle.view.rows.map(row => row.map(n => n ? String(n) : ''));
        const original = structuredClone(input);
        for (let r = 0; r < input.length; r++) for (let c = 0; c < input[r].length; c++) if (!puzzle.view.rows[r][c]) {
          for (const digit of String(puzzle.answer[r][c])) input = setPuzzleGridInput(input, { r, c }, applyNumberKey(input[r][c], digit), generator.type === 'sudoku' ? 'sudoku' : 'pyramid');
        }
        const type = generator.type === 'sudoku' ? 'sudoku' : 'pyramid';
        expect(completePuzzleGrid(input, type)).toBe(true);
        expect(generator.check(puzzle, input.map(row => row.map(Number)))).toBe(true);
        expect(original).toEqual(puzzle.view.rows.map(row => row.map(n => n ? String(n) : '')));
      }
    }
  });
  it('잘못된 길이·범위의 답은 제출 준비로 판정하지 않는다', () => {
    const sudoku = Array.from({ length: 4 }, () => ['1', '2', '3', '4']);
    expect(completePuzzleGrid(sudoku, 'sudoku')).toBe(true);
    for (const invalid of ['', '0', '5', '12', '123456789']) expect(completePuzzleGrid([[invalid, '2', '3', '4'], ...sudoku.slice(1)], 'sudoku')).toBe(false);
    expect(completePuzzleGrid([['144'], ['72', '72'], ['1', '2', '3']], 'pyramid')).toBe(true);
    expect(completePuzzleGrid([['1234'], ['72', '72'], ['1', '2', '3']], 'pyramid')).toBe(false);
    for (const invalid of [null, [], {}, [[1]]]) {
      expect(completePuzzleGrid(invalid, 'sudoku')).toBe(false); expect(completePuzzleGrid(invalid, 'pyramid')).toBe(false);
    }
  });
});
