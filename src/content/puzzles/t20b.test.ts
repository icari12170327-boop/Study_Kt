import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { seededRng } from '../../lib/random';
import { sudokuGenerator, solveSudoku } from './sudoku';
import { blockOrigin, hasColumnOverlap, blocksGenerator, blocksGeometry, BLOCK_SLOT_LABELS } from './blocks';
import { defaultState } from '../../store/defaults';
import { normalizeState, exportState, importState } from '../../store/storage';
import { PUZZLE_RENDERERS, puzzleInstruction } from '../../components/puzzles/renderers';
import type { Difficulty } from './types';

describe('T20b 5×5 스도쿠', () => {
  it('상자 없는 풀이기는 행·열만 검사하고 모순·여러 해·탐색 상한을 구별한다', () => {
    const latin = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => (r + c) % 5 + 1));
    expect(solveSudoku(latin, 1, 5)).toMatchObject({ count: 1, exhausted: false, solution: latin });
    expect(solveSudoku(latin, 2, 3).count).toBe(0);
    const duplicate = latin.map(row => [...row]); duplicate[0][0] = duplicate[0][1];
    expect(solveSudoku(duplicate, 1, 5).count).toBe(0);
    const empty = latin.map(row => row.map(() => 0));
    expect(solveSudoku(empty, 1, 5).count).toBe(2); expect(solveSudoku(empty, 1, 5, 1).exhausted).toBe(true);
  });
  it.each([4, 5] as Difficulty[])('★%s는 굵은 상자 선 없이 가로·세로 안내를 쓴다', level => {
    const puzzle = sudokuGenerator.generate(level, seededRng(97)), renderer = PUZZLE_RENDERERS.sudoku!;
    expect(puzzleInstruction(puzzle)).toBe('가로줄과 세로줄에 1~5가 한 번씩'); expect(puzzle.hint).toBe(puzzleInstruction(puzzle));
    const html = renderToStaticMarkup(createElement(renderer.Component, { puzzle, input: renderer.initialInput(puzzle), selected: renderer.firstCell!(puzzle), select() {}, change() {}, disabled: false }));
    expect(html).toContain('repeat(5, minmax(44px, 1fr))'); expect(html).not.toContain('border-right-width:3'); expect(html).not.toContain('border-bottom-width:3');
  });
  it('예전 6×6 진행 판은 복원하지 않고 레벨·기록·보상을 유지한 채 새 5×5를 만든다', () => {
    const base = normalizeState(defaultState()); base.data.kid1.puzzles!.levels.sudoku!.level = 4;
    base.data.kid1.puzzles!.recent = [{ date: '2026-10-08', type: 'sudoku', difficulty: 4, correct: true, hinted: false, activeSec: 100 }];
    const before = structuredClone(base);
    const old = { ...base, data: { ...base.data, kid1: { ...base.data.kid1, puzzles: { ...base.data.kid1.puzzles, current: { type: 'sudoku', view: { size: 6, rows: Array.from({ length: 6 }, () => [0, 0, 0, 0, 0, 0]) } } } } } };
    const next = normalizeState(old); expect(next.data.kid1.puzzles).not.toHaveProperty('current');
    expect(next.data.kid1.puzzles!.levels).toEqual(before.data.kid1.puzzles!.levels);
    expect(next.data.kid1.puzzles!.recent).toEqual(before.data.kid1.puzzles!.recent);
    expect(next.data).toEqual(before.data); expect(next.version).toBe(2);
    expect(importState(exportState(next)).data).toEqual(next.data);
    expect(sudokuGenerator.generate(next.data.kid1.puzzles!.levels.sudoku!.level, seededRng(12)).view.size).toBe(5);
  });
});
describe('T20b 블록 그림', () => {
  it('재현 배치·밀집 배치는 겹침으로 걸러내고 떨어진 기둥·자기 받침은 허용한다', () => {
    expect(hasColumnOverlap([[2, 0], [0, 1]])).toBe(true);
    expect(hasColumnOverlap([[2, 2], [2, 2]])).toBe(true);
    expect(hasColumnOverlap([[0, 2], [1, 0]])).toBe(false);
    expect(hasColumnOverlap([[4, 0], [0, 0]])).toBe(false);
  });
  it('2×2와 3×3의 모든 기둥은 화면 x가 다르고 깊이·자기 높이 순으로 그린다', () => {
    for (const size of [2, 3]) {
      const map = Array.from({ length: size }, () => Array(size).fill(4));
      expect(new Set(map.flatMap((row, y) => row.map((_, x) => blockOrigin(x, y).x))).size).toBe(size * size);
      const { cubes } = blocksGeometry(map);
      for (let i = 1; i < cubes.length; i++) {
        const a = cubes[i - 1].cell, b = cubes[i].cell;
        expect(blockOrigin(a.x, a.y).y).toBeLessThanOrEqual(blockOrigin(b.x, b.y).y);
        if (a.x === b.x && a.y === b.y) expect(a.z).toBeLessThan(b.z);
      }
    }
  });
  it.each([1, 2, 3] as Difficulty[])('★%s 500판은 기둥 겹침 없이 유한 생성하며 재현 배치가 없다', level => {
    for (let seed = 0; seed < 500; seed++) {
      const puzzle = blocksGenerator.generate(level, seededRng(seed));
      expect(hasColumnOverlap(puzzle.view.heights)).toBe(false); expect(puzzle.view.heights).not.toEqual([[2, 0], [0, 1]]);
      expect(puzzle.answer).toBe(puzzle.view.heights.flat().reduce((sum, n) => sum + n, 0));
      expect(blocksGenerator.generate(level, seededRng(seed))).toEqual(puzzle);
    }
  });
  it('항상 겹치는 후보는 16회 뒤 안전한 배치로 끝낸다', () => {
    let calls = 0;
    const puzzle = blocksGenerator.generate(3, () => { if (++calls > 150) throw new Error('재시도 상한 초과'); return 0.999999; });
    expect(calls).toBe(148); expect(hasColumnOverlap(puzzle.view.heights)).toBe(false); expect(puzzle.answer).toBe(6);
  });
  it('SVG 바닥과 지도는 같은 번호·자리 순서를 쓴다', () => {
    const puzzle = blocksGenerator.generate(5, seededRng(72)), renderer = PUZZLE_RENDERERS.blocks!;
    const html = renderToStaticMarkup(createElement(renderer.Component, { puzzle, input: '', selected: { r: 0, c: 0 }, select() {}, change() {}, disabled: false }));
    for (const [index, label] of BLOCK_SLOT_LABELS.entries()) { expect(html).toContain(`바닥 자리 ${index + 1}`); expect(html).toContain(`${label} 자리`); }
  });
});
