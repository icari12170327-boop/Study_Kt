import { describe, expect, it } from 'vitest';
import { seededRng } from '../../lib/random';
import { GENERATORS, generatePuzzle, registeredPuzzleTypes } from './registry';
import { solveSudoku, sudokuGenerator } from './sudoku';
import { pyramidGenerator, solvePyramid } from './pyramid';
import { trainGenerator } from './train';
import { adjustPuzzleLevel, defaultPuzzleLevel } from './state';
import { pausePuzzleClock, puzzleActiveMs, puzzleActivity, puzzlePaused, startPuzzleClock } from './activity';
import { movePuzzleCell } from './navigation';
import type { Difficulty } from './types';
const levels: Difficulty[] = [1, 2, 3, 4, 5];

describe('공통 생성기', () => {
  it('이번에는 세 종류만 등록한다', () => expect(registeredPuzzleTypes()).toEqual(['sudoku', 'train', 'pyramid']));
  for (const type of registeredPuzzleTypes()) for (const level of levels) {
    it(`${type} ${level}단계는 같은 시드로 재현되고 정답만 채점한다`, () => {
      const generator = GENERATORS[type]!;
      const puzzle = generator.generate(level, seededRng(426));
      expect(generator.generate(level, seededRng(426))).toEqual(puzzle);
      expect(generator.check(puzzle, puzzle.answer)).toBe(true);
      for (const invalid of [undefined, null, [], {}, NaN, '']) expect(generator.check(puzzle, invalid)).toBe(false);
      expect(generatePuzzle(type, level, 426).seed).toBe(426);
    });
  }
  it('미등록 생성기는 호출할 수 없다', () => expect(() => generatePuzzle('blocks', 1, 0)).toThrow());
});
describe('스도쿠 유일 해', () => {
  for (const level of levels) it(`${level}단계 200회 생성`, () => {
    for (let seed = 0; seed < 200; seed++) {
      const puzzle = sudokuGenerator.generate(level, seededRng(seed));
      const { size, rows, boxRows, boxCols } = puzzle.view;
      expect(size).toBe(level <= 3 ? 4 : 6);
      const solved = solveSudoku(rows, boxRows, boxCols);
      expect(solved.exhausted).toBe(false);
      expect(solved.count).toBe(1);
      expect(solved.solution).toEqual(puzzle.answer);
      const symbols = Array.from({ length: size }, (_, i) => i + 1);
      for (let r = 0; r < size; r++) {
        expect([...puzzle.answer[r]].sort()).toEqual(symbols);
        expect(puzzle.answer.map(row => row[r]).sort()).toEqual(symbols);
      }
      for (let r = 0; r < size; r += boxRows) for (let c = 0; c < size; c += boxCols) {
        expect(puzzle.answer.slice(r, r + boxRows).flatMap(row => row.slice(c, c + boxCols)).sort()).toEqual(symbols);
      }
      expect(rows.flat().filter(n => !n).length).toBeGreaterThan(0);
    }
  });
  it('여러 해, 모순, 탐색 상한을 구별한다', () => {
    const empty = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    expect(solveSudoku(empty, 2, 2).count).toBe(2);
    expect(solveSudoku([[1, 1, 0, 0], ...empty.slice(1)], 2, 2).count).toBe(0);
    expect(solveSudoku(empty, 2, 2, 1).exhausted).toBe(true);
    expect(solveSudoku([[1]], 2, 2).count).toBe(0);
  });
  it('상수 난수로도 유한하게 끝나고 유일 해를 유지한다', () => {
    for (const level of levels) {
      const puzzle = sudokuGenerator.generate(level, () => 0);
      expect(solveSudoku(puzzle.view.rows, 2, puzzle.view.boxCols).count).toBe(1);
    }
  });
});
describe('수 피라미드 유일 해', () => {
  for (const level of levels) it(`${level}단계 200회 생성`, () => {
    for (let seed = 0; seed < 200; seed++) {
      const puzzle = pyramidGenerator.generate(level, seededRng(seed));
      expect(solvePyramid(puzzle.view.rows)).toEqual(puzzle.answer);
      for (let r = 0; r < puzzle.answer.length - 1; r++) for (let c = 0; c <= r; c++) {
        expect(puzzle.answer[r][c]).toBe(puzzle.answer[r + 1][c] + puzzle.answer[r + 1][c + 1]);
      }
      if (level <= 2) expect(puzzle.view.rows.at(-1)!.every(n => n > 0)).toBe(true);
      else expect(puzzle.view.rows.at(-1)!.includes(0)).toBe(true);
    }
  });
  it('밑칸을 결정할 수 없거나 서로 모순이면 거절한다', () => {
    expect(solvePyramid([[10], [0, 0], [0, 0, 0]])).toBeNull();
    expect(solvePyramid([[99], [3, 5], [1, 2, 3]])).toBeNull();
    for (const level of levels) expect(solvePyramid(pyramidGenerator.generate(level, () => 0).view.rows)).not.toBeNull();
  });
});
describe('숫자 기차 규칙', () => {
  for (const level of levels) it(`${level}단계의 다음 수`, () => {
    for (let seed = 0; seed < 100; seed++) {
      const puzzle = trainGenerator.generate(level, seededRng(seed));
      const n = [...puzzle.view.numbers, puzzle.answer];
      const d = n.slice(1).map((value, i) => value - n[i]);
      if (level === 1 || level === 2) { expect(new Set(d).size).toBe(1); expect(Math.sign(d[0])).toBe(level === 1 ? 1 : -1); }
      if (level === 3) expect(n.slice(1).every((value, i) => value === n[i] * 2)).toBe(true);
      if (level === 4) { expect(d[0]).not.toBe(d[1]); expect(d).toEqual([d[0], d[1], d[0], d[1], d[0]]); }
      if (level === 5) { const dd = d.slice(1).map((value, i) => value - d[i]); expect(new Set(dd).size).toBe(1); expect(dd[0]).toBeGreaterThan(0); }
      expect(n.every(value => Number.isInteger(value) && value > 0)).toBe(true);
    }
  });
});
describe('종류별 난이도', () => {
  const clean = { correct: true, hinted: false, revealed: false, wrong: 0 };
  it('세 번 깨끗하게 풀면 올라가고 상한을 지킨다', () => {
    let state = defaultPuzzleLevel('g5');
    for (let i = 0; i < 3; i++) state = adjustPuzzleLevel(state, clean);
    expect(state).toMatchObject({ level: 3, streak: 0, fails: 0, solved: 3 });
    expect(adjustPuzzleLevel({ ...state, level: 5, streak: 2 }, clean).level).toBe(5);
  });
  for (const failure of [{ ...clean, wrong: 2 }, { ...clean, hinted: true }, { ...clean, correct: false, revealed: true }]) {
    it(`실패 두 번은 내려간다 ${JSON.stringify(failure)}`, () => {
      const original = defaultPuzzleLevel('g5');
      const once = adjustPuzzleLevel(original, failure);
      expect(once.fails).toBe(1);
      expect(adjustPuzzleLevel(once, failure)).toMatchObject({ level: 1, fails: 0, streak: 0 });
      expect(original).toEqual(defaultPuzzleLevel('g5'));
      expect(adjustPuzzleLevel({ ...once, level: 1 }, failure).level).toBe(1);
    });
  }
  it('한 번 오답 뒤 정답은 성공, 성공·실패 연속 횟수는 서로 끊는다', () => {
    expect(adjustPuzzleLevel({ ...defaultPuzzleLevel('g3'), fails: 1 }, { ...clean, wrong: 1 })).toMatchObject({ streak: 1, fails: 0 });
    expect(adjustPuzzleLevel({ ...defaultPuzzleLevel('g3'), streak: 2 }, { ...clean, hinted: true })).toMatchObject({ streak: 0, fails: 1, hinted: 1 });
  });
});
describe('활동 시간과 칸 이동', () => {
  it('15초 무입력은 멈추고 입력으로 이어진다', () => {
    const start = startPuzzleClock(0);
    expect(puzzleActiveMs(start, 60_000)).toBe(15_000);
    expect(puzzlePaused(start, 15_000)).toBe(true);
    const resumed = puzzleActivity(start, 60_000);
    expect(puzzleActiveMs(resumed, 63_000)).toBe(18_000);
    expect(puzzlePaused(resumed, 63_000)).toBe(false);
  });
  it('백그라운드는 동결하고 복귀 후 입력 때 재개한다', () => {
    const paused = pausePuzzleClock(startPuzzleClock(0), 3000);
    expect(puzzleActiveMs(paused, 1_000_000)).toBe(3000);
    expect(puzzleActiveMs(puzzleActivity(paused, 1_000_000), 1_001_000)).toBe(4000);
  });
  it('짧은 입력 간격의 합과 역행 시계를 처리한다', () => {
    let clock = startPuzzleClock(0);
    for (let time = 10_000; time <= 120_000; time += 10_000) clock = puzzleActivity(clock, time);
    expect(puzzleActiveMs(clock, 120_000)).toBe(120_000);
    expect(puzzleActiveMs(clock, 119_000)).toBe(120_000);
  });
  it('정해진 칸을 건너뛰고 줄 끝과 피라미드의 없는 칸에서도 다른 빈칸으로 간다', () => {
    expect(movePuzzleCell([[0, 1, 0], [0, 0, 0]], { r: 0, c: 0 }, 'ArrowRight')).toEqual({ r: 0, c: 2 });
    expect(movePuzzleCell([[0, 1, 0]], { r: 0, c: 2 }, 'ArrowRight')).toEqual({ r: 0, c: 0 });
    expect(movePuzzleCell([[0], [0, 0], [0, 0, 0]], { r: 2, c: 2 }, 'ArrowUp')).toEqual({ r: 1, c: 1 });
  });
});
