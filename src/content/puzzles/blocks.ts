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
// 두 축의 가로 이동량이 달라 2×2·3×3의 모든 기둥은 서로 다른 화면 x에 놓인다.
export function blockOrigin(x: number, y: number): BlockPoint { return { x: x * 28 - y * 18, y: x * 14 + y * 12 }; }
function floorFace(origin: BlockPoint): BlockPoint[] {
  const { x, y } = origin;
  return [{ x, y }, { x: x + 28, y: y + 14 }, { x: x + 10, y: y + 26 }, { x: x - 18, y: y + 12 }];
}
/** 화면 크기와 무관한 도형 좌표와 여백을 먼저 계산해 SVG의 viewBox에 전부 넣는다. */
export function blocksGeometry(heights: number[][]) {
  const cells = blockCells(heights).sort((a, b) => blockOrigin(a.x, a.y).y - blockOrigin(b.x, b.y).y || a.z - b.z);
  const origins = heights.flatMap((row, y) => row.map((_, x) => blockOrigin(x, y)));
  const floor = origins.map(floorFace);
  const labels = origins.map(origin => ({ x: origin.x + 5, y: origin.y + 13 }));
  const columnLabels = labels.flatMap((point, index) => {
    const height = heights[Math.floor(index / heights.length)][index % heights.length];
    return height ? [{ x: point.x, y: point.y - height * 24, index }] : [];
  });
  const cubes = cells.map(cell => {
    const origin = blockOrigin(cell.x, cell.y);
    const top = floorFace({ x: origin.x, y: origin.y - (cell.z + 1) * 24 });
    const side = (a: BlockPoint, b: BlockPoint) => [a, b, { x: b.x, y: b.y + 24 }, { x: a.x, y: a.y + 24 }];
    return { cell, top, left: side(top[3], top[2]), right: side(top[2], top[1]) };
  });
  const points = [...floor.flat(), ...cubes.flatMap(cube => [...cube.top, ...cube.left, ...cube.right]),
    ...labels.flatMap(point => [{ x: point.x - 9, y: point.y - 9 }, { x: point.x + 9, y: point.y + 9 }])];
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
  return { floor, cubes, labels, columnLabels, offsetX: 16 - minX, offsetY: 16 - minY, width: maxX - minX + 32, height: maxY - minY + 32 };
}
const cross = (a: BlockPoint, b: BlockPoint, p: BlockPoint) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
/** 볼록한 면을 변마다 잘라 접하기만 하는 선과 면적이 있는 겹침을 구별한다. */
function overlapArea(subject: BlockPoint[], clip: BlockPoint[]): number {
  let polygon = subject;
  for (let i = 0; i < clip.length && polygon.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], input = polygon;
    polygon = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length], dp = cross(a, b, p), dq = cross(a, b, q);
      if (dp >= -1e-8) polygon.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        polygon.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
  }
  return Math.abs(polygon.reduce((area, p, i) => { const q = polygon[(i + 1) % polygon.length]; return area + p.x * q.y - q.x * p.y; }, 0)) / 2;
}
/** 낮은 단계에서는 일부만 보이는 블록도 세기 어려워 서로 다른 기둥의 면 겹침을 보수적으로 거른다. */
export function hasColumnOverlap(heights: number[][]): boolean {
  const { cubes } = blocksGeometry(heights);
  for (let i = 0; i < cubes.length; i++) for (let j = i + 1; j < cubes.length; j++) {
    const a = cubes[i], b = cubes[j];
    if (a.cell.x === b.cell.x && a.cell.y === b.cell.y) continue;
    for (const face of [a.top, a.left, a.right]) for (const other of [b.top, b.left, b.right])
      if (overlapArea(face, other) > 1e-6) return true;
  }
  return false;
}
export const BLOCK_SLOT_LABELS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'] as const;
export const blocksGenerator: PuzzleGenerator<BlocksView, number> = {
  type: 'blocks',
  generate(difficulty, rng) {
    const seed = randInt(0, 0xffffffff, rng), config = BLOCKS_LEVELS[difficulty - 1];
    let heights = Array.from({ length: config.size }, () => Array.from({ length: config.size }, () => randInt(0, config.maxHeight, rng)));
    // 전부 빈 바닥이어도 재시도하지 않고 한 칸을 채운다. 최대 9기둥, 36블록이다.
    if (heights.flat().reduce((sum, height) => sum + height, 0) === 0) heights[0][0] = 1;
    if (difficulty <= 3) {
      // 최대 16후보로 끝낸다. 높이 상한을 유지하고 실패하면 서로 떨어진 대각선에 놓는다.
      for (let attempt = 1; attempt < 16 && hasColumnOverlap(heights); attempt++) {
        heights = Array.from({ length: config.size }, () => Array.from({ length: config.size }, () => randInt(0, config.maxHeight, rng)));
        if (!heights.flat().some(Boolean)) heights[0][0] = 1;
      }
      if (hasColumnOverlap(heights)) {
        heights = Array.from({ length: config.size }, (_, y) => Array.from({ length: config.size }, (_, x) => x + y === config.size - 1 ? randInt(1, config.maxHeight, rng) : 0));
      }
    }
    return { type: 'blocks', difficulty, seed, view: { heights }, answer: heights.flat().reduce((sum, height) => sum + height, 0),
      hint: '위에서 본 층 수를 한 줄씩 더하고, 가려진 블록도 세어 봐요.' };
  },
  check(puzzle, input) { return input === puzzle.answer; },
};
