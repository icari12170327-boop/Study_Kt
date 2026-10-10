import { describe, expect, it } from 'vitest';
import { patternTricks, patternTrickLimits, requiresBothAttributes } from './patternTricks';
import type { PatternTile, PatternView } from './pattern';

const a: PatternTile = { shape: 'circle', color: 'blue', count: 1 };
const b: PatternTile = { ...a, shape: 'triangle' };
const c: PatternTile = { ...a, color: 'orange' };
const d: PatternTile = { ...b, color: 'orange' };
const view = (options: PatternTile[]): PatternView => ({ layout: 'row', cells: [b, c, null], options,
  rules: { shape: { kind: 'cycle', values: ['triangle', 'circle'] }, color: { kind: 'cycle', values: ['blue', 'orange'] } } });

describe('도형 규칙 공통 요령 검사', () => {
  it.each([4, 5] as const)('★%s: 격자 판별 빈도만 50%로 허용하고 평균과 다른 요령 상한은 유지한다', level => {
    const average = patternTrickLimits(level), board = patternTrickLimits(level, 'board');
    expect(average.leastFrequent).toBe(0.4); expect(average.mostFrequent).toBe(0.4);
    expect(board).toEqual({ ...average, leastFrequent: 0.5, mostFrequent: 0.5 });
  });
  it('2×2는 네 보기의 유사도와 빈도가 동점이고 과거 칸 제거 뒤는 절반이다', () => {
    const board = view([a, b, c, d]), frozen = structuredClone(board);
    expect(patternTricks(board, a)).toEqual({ center: 0.25, centerFirst: 1, pastCenter: 0.5, pastCenterFirst: 1,
      originalPastCenter: 0.5, inverse: 0.25, pastInverse: 0.5, past: 0.5, familiar: 0.25, combined: 0.5,
      leastFrequent: 0.25, mostFrequent: 0.25 });
    expect(requiresBothAttributes(board, a)).toBe(true);
    expect(board).toEqual(frozen);
  });
  it('정답의 한 속성만 바꾼 별 모양 보기 구조의 중심 요령을 검출한다', () => {
    const board = view([a, b, c, { ...a, count: 2 }]);
    expect(patternTricks(board, a).center).toBe(1);
    expect(requiresBothAttributes(board, a)).toBe(false);
  });
  it('보기 하나의 값이 고유하거나 움직이는 규칙 대신 고정 속성을 바꾸면 거부한다', () => {
    expect(requiresBothAttributes(view([a, b, d, { ...d, shape: 'square' }]), a)).toBe(false);
    const board = view([a, b, { ...a, count: 2 }, { ...b, count: 2 }]);
    expect(requiresBothAttributes(board, a)).toBe(false);
  });
  it('가장 적게·많이 나온 값과 모든 보기 제거를 정답 위치와 무관하게 계산한다', () => {
    const board = view([a, b, c, d]); board.cells = [b, b, b, c, c, d, null];
    const metrics = patternTricks(board, a);
    expect(metrics.leastFrequent).toBe(0.5);
    expect(metrics.mostFrequent).toBe(0);
    expect(metrics.past).toBe(1);
    board.cells = [a, b, c, d, null];
    expect(patternTricks(board, a).past).toBe(0);
    const shuffled = { ...board, options: [d, c, b, a] };
    expect(patternTricks(shuffled, a).leastFrequent).toBe(0.25);
    expect(patternTricks(shuffled, a).centerFirst).toBe(0);
  });
});
