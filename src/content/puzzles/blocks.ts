import { randInt } from '../../lib/random';
import type { PuzzleGenerator } from './types';
export interface BlocksView { heights: number[][] }
export interface BlockCell { x: number; y: number; z: number }
export interface BlockPoint { x: number; y: number }
export const BLOCKS_LEVELS = [
  { size: 2, maxHeight: 1 }, { size: 2, maxHeight: 2 }, { size: 3, maxHeight: 2 },
  { size: 3, maxHeight: 3 }, { size: 3, maxHeight: 4 },
] as const;
/** 정해진 높이 아래를 모두 채운다. 받침 없는 블록은 만들지 않는다. */
export function blockCells(heights: number[][]): BlockCell[] {
  const size = heights.length;
  if (![2, 3].includes(size) || heights.some(row => row.length !== size || row.some(n => !Number.isInteger(n) || n < 0 || n > 4))) throw new Error('블록 높이가 올바르지 않아요.');
  return heights.flatMap((row, y) => row.flatMap((height, x) => Array.from({ length: height }, (_, z) => ({ x, y, z }))));
}
function diamond(x: number, y: number): BlockPoint[] {
  return [{ x, y }, { x: x + 24, y: y + 12 }, { x, y: y + 24 }, { x: x - 24, y: y + 12 }];
}
/** 화면 크기와 무관한 도형 좌표와 여백을 먼저 계산해 SVG의 viewBox에 전부 넣는다. */
export function blocksGeometry(heights: number[][]) {
  const cells = blockCells(heights).sort((a, b) => a.x + a.y - b.x - b.y || a.y - b.y || a.z - b.z);
  const floor = heights.flatMap((row, y) => row.map((_, x) => diamond((x - y) * 24, (x + y) * 12)));
  const cubes = cells.map(cell => {
    const x = (cell.x - cell.y) * 24, y = (cell.x + cell.y) * 12 - (cell.z + 1) * 24;
    const top = diamond(x, y);
    const left = [{ x: x - 24, y: y + 12 }, { x, y: y + 24 }, { x, y: y + 48 }, { x: x - 24, y: y + 36 }];
    const right = [{ x: x + 24, y: y + 12 }, { x, y: y + 24 }, { x, y: y + 48 }, { x: x + 24, y: y + 36 }];
    return { cell, top, left, right };
  });
  const points = [...floor.flat(), ...cubes.flatMap(cube => [...cube.top, ...cube.left, ...cube.right])];
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
  return { floor, cubes, offsetX: 16 - minX, offsetY: 16 - minY, width: maxX - minX + 32, height: maxY - minY + 32 };
}
export const blocksGenerator: PuzzleGenerator<BlocksView, number> = {
  type: 'blocks',
  generate(difficulty, rng) {
    const seed = randInt(0, 0xffffffff, rng), config = BLOCKS_LEVELS[difficulty - 1];
    const heights = Array.from({ length: config.size }, () => Array.from({ length: config.size }, () => randInt(0, config.maxHeight, rng)));
    // 전부 빈 바닥이어도 재시도하지 않고 한 칸을 채운다. 최대 9기둥, 36블록이다.
    if (heights.flat().reduce((sum, height) => sum + height, 0) === 0) heights[0][0] = 1;
    return { type: 'blocks', difficulty, seed, view: { heights }, answer: heights.flat().reduce((sum, height) => sum + height, 0),
      hint: '위에서 본 층 수를 한 줄씩 더하고, 가려진 블록도 세어 봐요.' };
  },
  check(puzzle, input) { return input === puzzle.answer; },
};
