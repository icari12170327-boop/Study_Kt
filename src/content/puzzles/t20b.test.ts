import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { seededRng } from '../../lib/random';
import { sudokuGenerator, solveSudoku } from './sudoku';
import { blockCells, blockOrigin, hiddenBlockCount, topVisibility, blocksGenerator, blocksGeometry, BLOCKS_LEVELS, BLOCKS_FALLBACKS, BLOCKS_MAX_ATTEMPTS, pointInBlockFace } from './blocks';
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
  it('한 기둥의 꼭대기는 모두 보이고 같은 높이 앞 기둥은 아래 블록만 가린다', () => {
    expect(topVisibility([[4, 0], [0, 0]])).toEqual([[1, 0], [0, 0]]);
    expect(hiddenBlockCount([[4, 0], [0, 0]])).toBe(0);
    expect(topVisibility([[2, 2], [2, 2]])[0][0]).toBeCloseTo(1 / 3);
    expect(hiddenBlockCount([[2, 2], [2, 2]])).toBe(1);
    expect(topVisibility([[1, 2], [2, 0]])[0][0]).toBe(0);
  });
  it('면 내부·경계·바깥 점을 구별한다', () => {
    const face = blocksGeometry([[1, 0], [0, 0]]).cubes[0].top;
    expect(pointInBlockFace(face[0], face)).toBe(true);
    expect(pointInBlockFace({ x: 5, y: -11 }, face)).toBe(true);
    expect(pointInBlockFace({ x: 100, y: 100 }, face)).toBe(false);
  });
  it('가시성은 입력을 바꾸지 않고 빈 바닥은 모두 0으로 계산한다', () => {
    const map = [[2, 2], [2, 2]], before = structuredClone(map);
    map.forEach(Object.freeze); Object.freeze(map);
    topVisibility(map); hiddenBlockCount(map);
    expect(map).toEqual(before);
    expect(topVisibility([[0, 0], [0, 0]])).toEqual([[0, 0], [0, 0]]);
    expect(hiddenBlockCount([[0, 0], [0, 0]])).toBe(0);
  });
  it('별도 3차원 시선 검사로 꼭대기 27점의 보이는 비율을 교차 검증한다', () => {
    function ratioByRays(heights: number[][], x: number, y: number): number {
      const cells = blockCells(heights), z = heights[y][x] - 1, direction = [9 / 14, 1, 7 / 8];
      if (z < 0) return 0;
      let visible = 0;
      for (let face = 0; face < 3; face++) for (const a of [1 / 6, 1 / 2, 5 / 6]) for (const b of [1 / 6, 1 / 2, 5 / 6]) {
        const point = face === 0 ? [x + a, y + b, z + 1] : face === 1 ? [x + 1, y + a, z + b] : [x + a, y + 1, z + b];
        const covered = cells.some(other => {
          if (other.x === x && other.y === y && other.z === z) return false;
          const min = [other.x, other.y, other.z]; let entry = 0, exit = Infinity;
          for (let k = 0; k < 3; k++) {
            entry = Math.max(entry, (min[k] - point[k]) / direction[k]);
            exit = Math.min(exit, (min[k] + 1 - point[k]) / direction[k]);
          }
          return exit > entry + 1e-8;
        });
        if (!covered) visible++;
      }
      return visible / 27;
    }
    for (let seed = 0; seed < 100; seed++) {
      const rng = seededRng(seed), map = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Math.floor(rng() * 4)));
      const top = topVisibility(map);
      map.forEach((row, y) => row.forEach((_, x) => expect(top[y][x]).toBeCloseTo(ratioByRays(map, x, y))));
    }
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
  it.each([1, 2, 3, 4, 5] as Difficulty[])('★%s 200판은 꼭대기 가시성·가려진 수·정답·시드 조건을 만족한다', level => {
    const config = BLOCKS_LEVELS[level - 1], shapes = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const puzzle = blocksGenerator.generate(level, seededRng(seed)), map = puzzle.view.heights;
      const top = topVisibility(map), hidden = hiddenBlockCount(map);
      expect(map.length).toBeGreaterThanOrEqual(config.size); expect(map.length).toBeLessThanOrEqual(config.maxSize);
      for (const [y, row] of map.entries()) for (const [x, height] of row.entries()) {
        expect(height).toBeLessThanOrEqual(config.maxHeight);
        if (height) expect(top[y][x]).toBeGreaterThanOrEqual(0.3); else expect(top[y][x]).toBe(0);
      }
      expect(hidden).toBeGreaterThanOrEqual(config.minHidden); expect(hidden).toBeLessThanOrEqual(config.maxHidden);
      expect(map).not.toEqual([[2, 0], [0, 1]]);
      expect(puzzle.answer).toBe(map.flat().reduce((sum, n) => sum + n, 0));
      expect(blocksGenerator.generate(level, seededRng(seed))).toEqual(puzzle);
      shapes.add(JSON.stringify(map));
    }
    expect(shapes.size).toBeGreaterThan(10);
  });
  it.each([1, 2, 3, 4, 5] as Difficulty[])('★%s는 빈 후보 200회 뒤 난이도에 맞는 독립적인 안전 배치를 반환한다', level => {
    let calls = 0;
    const rng = () => { if (++calls > 2002) throw new Error('재시도 상한 초과'); return 0; };
    const puzzle = blocksGenerator.generate(level, rng), config = BLOCKS_LEVELS[level - 1];
    expect(calls).toBe(1 + (level === 2 ? 1 : 0) + BLOCKS_MAX_ATTEMPTS * config.size ** 2);
    expect(puzzle.view.heights).toEqual(BLOCKS_FALLBACKS[level - 1]);
    expect(puzzle.view.heights.flat().every(h => h <= config.maxHeight)).toBe(true);
    expect(puzzle.answer).toBe(puzzle.view.heights.flat().reduce((sum, h) => sum + h, 0));
    const top = topVisibility(puzzle.view.heights), hidden = hiddenBlockCount(puzzle.view.heights);
    puzzle.view.heights.forEach((row, y) => row.forEach((h, x) => { if (h) expect(top[y][x]).toBeGreaterThanOrEqual(0.3); }));
    expect(hidden).toBeGreaterThanOrEqual(config.minHidden); expect(hidden).toBeLessThanOrEqual(config.maxHidden);
    puzzle.view.heights[0][0] = 99;
    expect(blocksGenerator.generate(level, () => 0).view.heights).toEqual(BLOCKS_FALLBACKS[level - 1]);
  });
  it('최초 재현 배치만 계속 뽑아도 200회 뒤 안전한 배치로 끝낸다', () => {
    let calls = 0; const values = [0.99, 0, 0, 0.4];
    const puzzle = blocksGenerator.generate(1, () => calls++ === 0 ? 0 : values[(calls - 2) % 4]);
    expect(calls).toBe(801); expect(puzzle.view.heights).toEqual(BLOCKS_FALLBACKS[0]);
    expect(puzzle.view.heights).not.toEqual([[2, 0], [0, 1]]);
  });
  it('SVG에는 기둥·바닥 번호가 없고 층 수 지도는 정답 보기에서만 표시한다', () => {
    const puzzle = blocksGenerator.generate(5, seededRng(72)), renderer = PUZZLE_RENDERERS.blocks!;
    const props = { puzzle, input: '', selected: { r: 0, c: 0 }, select() {}, change() {}, disabled: false };
    const html = renderToStaticMarkup(createElement(renderer.Component, props));
    expect(html).not.toContain('<text'); expect(html).not.toContain('<circle'); expect(html).not.toContain('blocks-map');
    const hint = renderToStaticMarkup(createElement(renderer.Component, { ...props, hinted: true }));
    expect(hint).toContain('위에서 본 모양'); expect(hint).not.toContain('층 수'); expect(hint).not.toContain('층"');
    const answer = renderToStaticMarkup(createElement(renderer.Component, { ...props, revealed: true }));
    expect(answer).toContain('위에서 본 층 수'); expect(answer).toContain(`각 자리의 층 수를 더하면 ${puzzle.answer}개`);
  });
});
