import { describe, expect, it } from 'vitest';
import { seededRng } from '../../lib/random';
import { balanceGenerator, BALANCE_LEVELS, solveBalance, type BalanceView } from './balance';
import { blocksGenerator, BLOCKS_LEVELS, blockCells, blocksGeometry } from './blocks';
import { patternGenerator, PATTERN_LEVELS, describePatternTile, samePatternTile, patternPredictions, patternChoiceKey } from './pattern';
import type { Difficulty } from './types';

const levels: Difficulty[] = [1, 2, 3, 4, 5];
// 생성기와 별개로 계수 행렬의 행렬식을 계산해 해의 유일성을 확인한다.
function determinant(rows: number[][]): number {
  if (rows.length === 1) return rows[0][0];
  return rows[0].reduce((sum, n, c) => sum + n * (-1) ** c * determinant(rows.slice(1).map(row => row.filter((_, i) => i !== c))), 0);
}
describe('T06b 생성기 검증', () => {
  for (const level of levels) {
    it(`저울 ${level}단계 200판: 식과 일치하는 유일한 정수 해`, () => {
      const config = BALANCE_LEVELS[level - 1];
      for (let seed = 0; seed < 200; seed++) {
        const puzzle = balanceGenerator.generate(level, seededRng(seed)), view = puzzle.view;
        expect(view.equations).toHaveLength(config.symbols);
        expect(determinant(view.equations.map(row => row.counts))).not.toBe(0);
        const values = solveBalance(view)!;
        expect(values).not.toBeNull();
        expect(values.every(n => n >= 1 && n <= config.maxValue)).toBe(true);
        for (const row of view.equations) expect(row.counts.reduce((sum, n, i) => sum + n * values[i], 0)).toBe(row.total);
        expect(values[view.target]).toBe(puzzle.answer);
      }
    });
    it(`도형 ${level}단계 200판: 속성별 규칙과 일치하는 보기가 정확히 하나`, () => {
      for (let seed = 0; seed < 200; seed++) {
        const { view, answer } = patternGenerator.generate(level, seededRng(seed));
        expect(view.layout).toBe(PATTERN_LEVELS[level - 1].layout);
        const expected = patternPredictions(view)!;
        expect(expected).not.toBeNull();
        expect(view.options).toHaveLength(4);
        expect(view.options.filter(tile => samePatternTile(tile, expected))).toHaveLength(1);
        expect(view.options[answer - 1]).toEqual(expected);
        expect(new Set(view.options.map(describePatternTile)).size).toBe(4);
      }
    });
    it(`블록 ${level}단계 200판: 높이 합·받침·SVG 경계`, () => {
      const config = BLOCKS_LEVELS[level - 1];
      for (let seed = 0; seed < 200; seed++) {
        const { view, answer } = blocksGenerator.generate(level, seededRng(seed));
        expect(view.heights.length).toBeGreaterThanOrEqual(config.size); expect(view.heights.length).toBeLessThanOrEqual(config.maxSize);
        expect(view.heights.every(row => row.length === view.heights.length && row.every(n => n >= 0 && n <= config.maxHeight))).toBe(true);
        expect(answer).toBe(view.heights.flat().reduce((sum, n) => sum + n, 0));
        const cells = blockCells(view.heights), set = new Set(cells.map(cell => `${cell.x}:${cell.y}:${cell.z}`));
        expect(cells.length).toBe(answer); expect(answer).toBeGreaterThan(0);
        for (const cell of cells) if (cell.z > 0) expect(set.has(`${cell.x}:${cell.y}:${cell.z - 1}`)).toBe(true);
        const geometry = blocksGeometry(view.heights);
        for (const point of [...geometry.floor.flat(), ...geometry.cubes.flatMap(cube => [...cube.top, ...cube.left, ...cube.right])]) {
          expect(point.x + geometry.offsetX).toBeGreaterThanOrEqual(16);
          expect(point.x + geometry.offsetX).toBeLessThanOrEqual(geometry.width - 16);
          expect(point.y + geometry.offsetY).toBeGreaterThanOrEqual(16);
          expect(point.y + geometry.offsetY).toBeLessThanOrEqual(geometry.height - 16);
        }
      }
    });
    for (const generator of [balanceGenerator, patternGenerator, blocksGenerator]) it(`${generator.type} ${level}단계: 시드와 극단 난수에도 유한 생성`, () => {
      expect(generator.generate(level, seededRng(725))).toEqual(generator.generate(level, seededRng(725)));
      for (const value of [0, 0.999999]) {
        let calls = 0; const limit = generator.type === 'blocks' || generator.type === 'pattern' ? 2002 : 200;
        const puzzle = generator.generate(level, () => { if (++calls > limit) throw new Error('난수 호출 상한 초과'); return value; });
        expect(calls).toBeLessThan(limit);
        expect(generator.check(puzzle as never, puzzle.answer)).toBe(true);
        expect(generator.check(puzzle as never, puzzle.answer + 1)).toBe(false);
        expect(generator.check(puzzle as never, String(puzzle.answer))).toBe(false);
      }
    });
  }
  it('저울은 식이 부족하거나 모순·분수·음수 해이면 거부한다', () => {
    const symbols = [{ emoji: '🍎', label: '사과' }, { emoji: '🍌', label: '바나나' }];
    const view: BalanceView = { symbols, equations: [{ counts: [1, 1], total: 8 }], target: 1 };
    expect(solveBalance(view)).toBeNull();
    expect(solveBalance({ ...view, equations: [{ counts: [1, 1], total: 8 }, { counts: [2, 2], total: 17 }] })).toBeNull();
    for (const total of [1, 0, -3]) expect(solveBalance({ symbols: symbols.slice(0, 1), equations: [{ counts: [2], total }], target: 0 })).toBeNull();
    expect(solveBalance({ ...view, equations: [{ counts: [2, 0], total: 10 }, { counts: [1, 1], total: 8 }] })).toEqual([5, 3]);
  });
  it('최대 블록 36개도 경계 안이고 잘못된 높이는 거부한다', () => {
    const map = Array.from({ length: 3 }, () => [4, 4, 4]);
    expect(blocksGeometry(map).cubes).toHaveLength(36);
    for (const invalid of [[], [[1]], [[1, 2], [3, 5]], [[-1, 1], [1, 1]], [[1.5, 1], [1, 1]]]) expect(() => blockCells(invalid)).toThrow();
  });
  it('보기 키는 1~4만 받는다', () => {
    for (let i = 1; i <= 4; i++) expect(patternChoiceKey(String(i))).toBe(i);
    for (const key of ['0', '5', 'Enter', '01', 'a']) expect(patternChoiceKey(key)).toBeNull();
  });
});
