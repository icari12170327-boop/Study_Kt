import { randInt, shuffle } from '../../lib/random';
import type { PuzzleGenerator } from './types';
export type PatternShape = 'circle' | 'triangle' | 'square' | 'star';
export type PatternColor = 'blue' | 'orange' | 'purple' | 'green';
export interface PatternTile { shape: PatternShape; color: PatternColor; count: number }
export interface PatternView { sequence: PatternTile[]; options: PatternTile[]; period: number }
export const SHAPE_LABELS: Record<PatternShape, string> = { circle: '동그라미', triangle: '세모', square: '네모', star: '별' };
export const COLOR_LABELS: Record<PatternColor, string> = { blue: '파랑', orange: '주황', purple: '보라', green: '초록' };
export const PATTERN_LEVELS = [
  { period: 2, color: false, count: false }, { period: 3, color: false, count: false },
  { period: 2, color: false, count: true }, { period: 3, color: true, count: false },
  { period: 4, color: true, count: true },
] as const;
const SHAPES: PatternShape[] = ['circle', 'triangle', 'square', 'star'];
const COLORS: PatternColor[] = ['blue', 'orange', 'purple', 'green'];
export function samePatternTile(a: PatternTile, b: PatternTile): boolean { return a.shape === b.shape && a.color === b.color && a.count === b.count; }
export function describePatternTile(tile: PatternTile): string { return `${COLOR_LABELS[tile.color]} ${SHAPE_LABELS[tile.shape]} ${tile.count}개`; }
export function patternChoiceKey(key: string): number | null { return /^[1-4]$/.test(key) ? Number(key) : null; }
export const patternGenerator: PuzzleGenerator<PatternView, number> = {
  type: 'pattern',
  generate(difficulty, rng) {
    const seed = randInt(0, 0xffffffff, rng), config = PATTERN_LEVELS[difficulty - 1];
    const shapes = shuffle(SHAPES, rng), colors = shuffle(COLORS, rng), countStart = randInt(0, 2, rng);
    const cycle = Array.from({ length: config.period }, (_, i) => ({ shape: shapes[i], color: colors[config.color ? i : 0], count: config.count ? (i + countStart) % 3 + 1 : 1 }));
    const length = config.period * 2 + randInt(0, 1, rng);
    const sequence = Array.from({ length }, (_, i) => ({ ...cycle[i % cycle.length] }));
    const expected = cycle[length % cycle.length];
    // 최대 48개 후보를 한 번만 만들고 정답과 다른 세 개를 고른다.
    const candidates = SHAPES.flatMap(shape => (config.color ? COLORS : [expected.color]).flatMap(color =>
      (config.count ? [1, 2, 3] : [expected.count]).map(count => ({ shape, color, count }))))
      .filter(tile => !samePatternTile(tile, expected));
    const options = shuffle([{ ...expected }, ...shuffle(candidates, rng).slice(0, 3)], rng);
    return { type: 'pattern', difficulty, seed, view: { sequence, options, period: config.period },
      answer: options.findIndex(tile => samePatternTile(tile, expected)) + 1,
      hint: difficulty <= 2 ? '처음 모양부터 같은 순서로 반복되는지 살펴봐요.' : difficulty === 3 ? '모양과 개수가 함께 반복되는 순서를 찾아봐요.' :
        difficulty === 4 ? '모양과 색 이름이 반복되는 순서를 찾아봐요.' : '모양, 색 이름, 개수의 반복되는 순서를 찾아봐요.' };
  },
  check(puzzle, input) { return input === puzzle.answer; },
};
