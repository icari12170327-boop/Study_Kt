import { randInt } from '../../lib/random';
import type { PuzzleGenerator } from './types';
export interface BlocksView { heights: number[][] }
export interface BlockCell { x: number; y: number; z: number }
export interface BlockPoint { x: number; y: number }
export const BLOCKS_LEVELS = [
  { size: 2, maxSize: 2, maxHeight: 2, minHidden: 0, maxHidden: 0 },
  { size: 2, maxSize: 3, maxHeight: 2, minHidden: 1, maxHidden: 2 },
  { size: 3, maxSize: 3, maxHeight: 3, minHidden: 2, maxHidden: 4 },
  { size: 3, maxSize: 3, maxHeight: 3, minHidden: 3, maxHidden: Infinity },
  { size: 3, maxSize: 3, maxHeight: 4, minHidden: 3, maxHidden: Infinity },
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
  const cubes = cells.map(cell => {
    const origin = blockOrigin(cell.x, cell.y);
    const top = floorFace({ x: origin.x, y: origin.y - (cell.z + 1) * 24 });
    const side = (a: BlockPoint, b: BlockPoint) => [a, b, { x: b.x, y: b.y + 24 }, { x: a.x, y: a.y + 24 }];
    return { cell, top, left: side(top[3], top[2]), right: side(top[2], top[1]) };
  });
  const points = [...floor.flat(), ...cubes.flatMap(cube => [...cube.top, ...cube.left, ...cube.right])];
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
  return { floor, cubes, offsetX: 16 - minX, offsetY: 16 - minY, width: maxX - minX + 32, height: maxY - minY + 32 };
}
const cross = (a: BlockPoint, b: BlockPoint, p: BlockPoint) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
/** 볼록한 블록 면에 점이 포함되는지 검사한다. 경계도 덮인 것으로 센다. */
export function pointInBlockFace(point: BlockPoint, face: BlockPoint[]): boolean {
  return face.every((a, i) => cross(a, face[(i + 1) % face.length], point) >= -1e-8);
}
/** 각 면 안쪽 3×3 점을 표본으로 삼는다. 경계의 선 두께에는 의존하지 않는다. */
function faceSamples(face: BlockPoint[]): BlockPoint[] {
  return [1 / 6, 1 / 2, 5 / 6].flatMap(u => [1 / 6, 1 / 2, 5 / 6].map(v => ({
    x: face[0].x + u * (face[1].x - face[0].x) + v * (face[3].x - face[0].x),
    y: face[0].y + u * (face[1].y - face[0].y) + v * (face[3].y - face[0].y),
  })));
}
/** 꼭대기 비율과 가려진 아래 블록 수는 같은 가시성 검사에서 계산한다. */
export function blocksVisibility(heights: number[][]): { top: number[][]; hidden: number } {
  const { cubes } = blocksGeometry(heights);
  const faces = cubes.map(cube => [cube.top, cube.left, cube.right].map(face => ({ face,
    minX: Math.min(...face.map(p => p.x)), maxX: Math.max(...face.map(p => p.x)),
    minY: Math.min(...face.map(p => p.y)), maxY: Math.max(...face.map(p => p.y)),
  })));
  const top = heights.map(row => row.map(() => 0));
  let hidden = 0;
  cubes.forEach((cube, index) => {
    const frontFaces = faces.slice(index + 1).flat();
    const visible = faces[index].flatMap(({ face }) => faceSamples(face)).filter(point => !frontFaces.some(cover =>
      point.x >= cover.minX && point.x <= cover.maxX && point.y >= cover.minY && point.y <= cover.maxY && pointInBlockFace(point, cover.face))).length;
    if (cube.cell.z === heights[cube.cell.y][cube.cell.x] - 1) top[cube.cell.y][cube.cell.x] = visible / 27;
    else if (!visible) hidden++;
  });
  return { top, hidden };
}
export function topVisibility(heights: number[][]): number[][] { return blocksVisibility(heights).top; }
export function hiddenBlockCount(heights: number[][]): number { return blocksVisibility(heights).hidden; }

export const BLOCKS_MAX_ATTEMPTS = 200;
// 표시 조건을 만족하는 고정 배치. 반환할 때 복제해 호출 간 변경을 막는다.
export const BLOCKS_FALLBACKS: readonly (readonly (readonly number[])[])[] = [
  [[0, 2], [1, 0]],
  [[2, 2], [2, 2]],
  [[2, 2, 2], [2, 2, 2], [2, 2, 2]],
  [[3, 3, 3], [3, 3, 3], [3, 3, 3]],
  [[4, 4, 4], [4, 4, 4], [4, 4, 4]],
];
export const blocksGenerator: PuzzleGenerator<BlocksView, number> = {
  type: 'blocks',
  generate(difficulty, rng) {
    const seed = randInt(0, 0xffffffff, rng), config = BLOCKS_LEVELS[difficulty - 1];
    const size = config.size === config.maxSize ? config.size : randInt(config.size, config.maxSize, rng);
    let heights: number[][] | undefined;
    for (let attempt = 0; attempt < BLOCKS_MAX_ATTEMPTS; attempt++) {
      const candidate = Array.from({ length: size }, () => Array.from({ length: size }, () => randInt(0, config.maxHeight, rng)));
      if (!candidate.flat().some(Boolean)) continue;
      // 최초 재현 배치는 개정 명세에서도 생성하지 않는다.
      if (size === 2 && candidate[0][0] === 2 && candidate[0][1] === 0 && candidate[1][0] === 0 && candidate[1][1] === 1) continue;
      const { top, hidden } = blocksVisibility(candidate);
      if (candidate.every((row, y) => row.every((height, x) => !height || top[y][x] >= 0.3)) && hidden >= config.minHidden && hidden <= config.maxHidden) {
        heights = candidate; break;
      }
    }
    heights ??= BLOCKS_FALLBACKS[difficulty - 1].map(row => [...row]);
    return { type: 'blocks', difficulty, seed, view: { heights }, answer: heights.flat().reduce((sum, height) => sum + height, 0),
      hint: '색칠한 자리에 기둥이 있어요. 보이는 꼭대기 아래의 블록도 세어 봐요.' };
  },
  check(puzzle, input) { return input === puzzle.answer; },
};
