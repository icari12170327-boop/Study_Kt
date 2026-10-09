import { describe, expect, it } from 'vitest';
import { seededRng } from '../../lib/random';
import { consistentRules, describePatternTile, explainRules, generatePattern, isPatternView, PATTERN_ATTRIBUTES, PATTERN_MAX_ATTEMPTS, patternGenerator, patternPredictions, predictRule, samePatternTile, type PatternTile, type PatternView } from './pattern';
import type { Difficulty } from './types';
const levels: Difficulty[] = [1, 2, 3, 4, 5];
const tile = (count: number): PatternTile => ({ shape: 'circle', color: 'blue', count });
const board = (cells: (PatternTile | null)[]): PatternView => ({ layout: 'row', cells, rules: {}, options: [] });
function checkUnique(view: PatternView, expected: PatternTile) {
  const blank = view.cells.indexOf(null);
  for (const attr of PATTERN_ATTRIBUTES) {
    const rules = consistentRules(view, attr);
    expect(rules.length).toBeGreaterThan(0);
    expect(new Set(rules.map(rule => predictRule(view, attr, rule, blank))).size).toBe(1);
  }
  expect(patternPredictions(view)).toEqual(expected);
  expect(view.options.filter(option => samePatternTile(option, expected))).toHaveLength(1);
  expect(new Set(view.options.map(describePatternTile)).size).toBe(4);
  for (const option of view.options) if (!samePatternTile(option, expected)) {
    expect(PATTERN_ATTRIBUTES.filter(attr => option[attr] !== expected[attr])).toHaveLength(1);
  }
  for (const entry of [...view.cells.filter((row): row is PatternTile => !!row), ...view.options]) {
    expect(entry.count).toBeGreaterThanOrEqual(1); expect(entry.count).toBeLessThanOrEqual(6);
    if (entry.shape !== 'arrow') expect(entry.dir).toBeUndefined(); else expect([0, 90, 180, 270]).toContain(entry.dir);
  }
}
describe('T21 도형 규칙 후보', () => {
  it('4개만 보인 수열의 step·cycle 해석 충돌을 거부하고 한 칸 늘리면 답을 정한다', () => {
    const ambiguous = board([tile(1), tile(2), tile(3), tile(4), null]);
    expect(consistentRules(ambiguous, 'count').map(rule => rule.kind)).toContain('step');
    expect(consistentRules(ambiguous, 'count').map(rule => rule.kind)).toContain('cycle');
    expect(patternPredictions(ambiguous)).toBeNull();
    const clear = board([tile(1), tile(2), tile(3), tile(4), tile(5), null]);
    expect(patternPredictions(clear)).toEqual(tile(6));
    expect(consistentRules(clear, 'count')).toEqual([{ kind: 'step', delta: 1 }]);
  });
  it.each([[1, 3, 5, 2], [6, 4, 2, -2]])('step ±2와 1~6 범위를 확인한다: %j', (a, b, c, delta) => {
    const cells = board([tile(a), tile(b), tile(c)]);
    expect(consistentRules(cells, 'count')).toContainEqual({ kind: 'step', delta });
    expect(consistentRules(board([...cells.cells, null]), 'count')).not.toContainEqual({ kind: 'step', delta });
  });
  it('방향은 화살표에만 있으며 90도·180도 회전과 같은 예측의 반복 후보를 허용한다', () => {
    for (const deg of [90, 180] as const) {
      const cells = Array.from({ length: 5 }, (_, i) => ({ ...tile(1), shape: 'arrow' as const, dir: ((i * deg) % 360) as 0 | 90 | 180 | 270 }));
      const view = board([...cells, null]);
      expect(consistentRules(view, 'dir')).toContainEqual({ kind: 'turn', deg });
      expect(patternPredictions(view)?.dir).toBe((5 * deg) % 360);
    }
    expect(consistentRules(board([tile(1), tile(1), null]), 'dir')).toEqual([{ kind: 'fixed' }]);
  });
  it('값이 겹치는 반복 후보도 빠뜨리지 않고 격자 모양은 라틴 방진 약속을 함께 검사한다', () => {
    const cells = ['circle', 'circle', 'triangle', 'circle', 'circle', 'triangle'].map(shape => ({ ...tile(1), shape: shape as PatternTile['shape'] }));
    const view = board([...cells, null]);
    expect(consistentRules(view, 'shape')).toContainEqual({ kind: 'cycle', values: ['circle', 'circle', 'triangle'] });
    expect(patternPredictions(view)?.shape).toBe('circle');
    const grid = generatePattern(4, seededRng(1), 0).view;
    const complete = grid.cells.map(row => row ?? grid.options[generatePattern(4, seededRng(1), 0).answer - 1]);
    complete[0] = null as never;
    const source = { layout: 'grid' as const, cells: complete };
    for (const rule of consistentRules(source, 'shape')) {
      const prediction = source.cells.map((_, i) => predictRule(source, 'shape', rule, i));
      for (let i = 0; i < 3; i++) expect(new Set(prediction.slice(i * 3, i * 3 + 3)).size).toBe(3);
    }
  });
  it('보여 준 칸이나 단서가 없으면 유일한 답으로 판정하지 않는다', () => {
    expect(consistentRules(board([null]), 'shape')).toEqual([]); expect(patternPredictions(board([null]))).toBeNull();
    expect(patternPredictions(board([tile(1)]))).toBeNull(); expect(patternPredictions(board([tile(1), null, null]))).toBeNull();
  });
  it('배열·격자 입력과 객체 입력은 같은 규칙을 찾고 원본을 바꾸지 않는다', () => {
    const puzzle = patternGenerator.generate(4, seededRng(1)), before = structuredClone(puzzle);
    const rows = [puzzle.view.cells.slice(0, 3), puzzle.view.cells.slice(3, 6), puzzle.view.cells.slice(6)];
    for (const attr of PATTERN_ATTRIBUTES) expect(consistentRules(rows, attr)).toEqual(consistentRules(puzzle.view, attr));
    const cells = [tile(1), tile(2), tile(3), tile(4), tile(5), null];
    expect(consistentRules(cells, 'count')).toEqual(consistentRules(board(cells), 'count'));
    expect(puzzle).toEqual(before);
  });
});
describe('T21 단계별 200판', () => {
  for (const level of levels) it(`★${level}: 형태·규칙·유일 해·속성 하나만 다른 보기·같은 시드`, () => {
    const blanks = new Set<number>(), turns = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const puzzle = patternGenerator.generate(level, seededRng(seed)), view = puzzle.view, expected = view.options[puzzle.answer - 1];
      expect(puzzle).toEqual(patternGenerator.generate(level, seededRng(seed))); expect(isPatternView(view)).toBe(true);
      checkUnique(view, expected);
      const active = Object.entries(view.rules).filter(([, rule]) => rule.kind !== 'fixed');
      expect(view.layout).toBe(level <= 3 ? 'row' : 'grid');
      const shown = view.cells.filter((row): row is PatternTile => !!row);
      if (level === 1) {
        expect(active).toHaveLength(1); expect(active[0][1].kind).toBe('cycle');
        const rule = active[0][1]; expect(rule.kind === 'cycle' && [2, 3].includes(rule.values.length)).toBe(true);
        if (rule.kind === 'cycle') expect(shown).toHaveLength(rule.values.length * 2 + 1);
      } else if (level === 2) {
        expect(active).toHaveLength(2); expect(active.every(([, rule]) => rule.kind === 'cycle')).toBe(true);
        const periods = active.map(([, rule]) => rule.kind === 'cycle' ? rule.values.length : 0);
        expect(periods[0]).not.toBe(periods[1]); expect(shown.length).toBeGreaterThanOrEqual(Math.max(...periods) * 2);
      } else if (level === 3) {
        expect(active).toHaveLength(2); expect(active.filter(([, rule]) => rule.kind === 'cycle')).toHaveLength(1);
        expect(active.filter(([, rule]) => rule.kind === 'turn' || rule.kind === 'step')).toHaveLength(1); expect(shown.length).toBeGreaterThanOrEqual(4);
        turns.add(active.find(([, rule]) => rule.kind !== 'cycle')![1].kind);
      } else {
        expect(view.cells).toHaveLength(9); expect(shown).toHaveLength(8); blanks.add(view.cells.indexOf(null));
        if (level === 4) {
          expect(view.rules.shape).toMatchObject({ kind: 'cycle', axis: 'diagonal' }); expect(view.rules.count).toEqual({ kind: 'cycle', values: [1, 2, 3], axis: 'column' });
          expect(view.rules.color?.kind).toBe('fixed');
        } else { expect(view.rules.color).toMatchObject({ kind: 'cycle', axis: 'column' }); expect(view.rules.count).toMatchObject({ kind: 'step', axis: 'row' }); }
      }
      if (level === 2 || level === 3) {
        // 어떤 과거 칸을 그대로 복사해도 정답을 얻지 못하는, 명세보다 강한 조건이다.
        expect(shown.some(row => samePatternTile(row, expected))).toBe(false);
        for (let p = 1; p <= shown.length; p++) {
          const matches = shown.slice(p).every((row, i) => samePatternTile(row, shown[i]));
          if (matches) expect(samePatternTile(expected, shown[shown.length - p])).toBe(false);
        }
      }
      expect(explainRules(view)).not.toBe(''); expect(explainRules(view)).not.toContain('undefined');
      expect(patternGenerator.check(puzzle, puzzle.answer)).toBe(true); expect(patternGenerator.check(puzzle, String(puzzle.answer))).toBe(false);
    }
    if (level >= 4) expect(blanks.size).toBe(9); if (level === 3) expect(turns).toEqual(new Set(['step', 'turn']));
  }, 20000);
});
describe('T21 대체 판과 규칙 설명', () => {
  it.each(levels)('★%s 대체 판도 모든 규칙과 보기 조건을 만족하고 반환 배열을 공유하지 않는다', level => {
    const puzzle = generatePattern(level, seededRng(1), 0); checkUnique(puzzle.view, puzzle.view.options[puzzle.answer - 1]);
    const original = structuredClone(puzzle); puzzle.view.cells.length = 0; puzzle.view.options[0].count = 100;
    expect(generatePattern(level, seededRng(1), 0)).toEqual(original);
  });
  it('전체 타일 반복 후보만 계속 나와도 40회 뒤 안전한 판으로 끝난다', () => {
    let calls = 0; const puzzle = patternGenerator.generate(2, () => { if (++calls > 2002) throw new Error('재시도 상한 초과'); return 0; });
    expect(calls).toBeGreaterThan(PATTERN_MAX_ATTEMPTS); expect(calls).toBeLessThan(2002);
    checkUnique(puzzle.view, puzzle.view.options[puzzle.answer - 1]); expect(puzzle.view.cells.filter(Boolean)).toHaveLength(8);
    expect(puzzle).toEqual(generatePattern(2, () => 0, 0));
  });
  it('설명은 실제 속성·반복·증감·회전·행열 규칙을 한국어로 말한다', () => {
    const view = board([tile(1), tile(2), tile(3), tile(4), tile(5), null]);
    view.rules = { count: { kind: 'step', delta: 1 }, dir: { kind: 'turn', deg: 90 }, shape: { kind: 'cycle', values: ['circle', 'triangle'] }, color: { kind: 'fixed' } };
    expect(explainRules(view)).toBe('모양: 동그라미 → 세모 반복 · 개수: 1개씩 늘어나요 · 방향: 시계 방향으로 90도씩 돌아요');
    view.rules.count = { kind: 'step', delta: -2 }; expect(explainRules(view)).toContain('2개씩 줄어들어요');
    const grid = patternGenerator.generate(4, seededRng(1)).view; expect(explainRules(grid)).toContain('각 가로줄·세로줄에 세 모양이 한 번씩'); expect(explainRules(grid)).toContain('왼쪽에서 오른쪽');
  });
  it('이전 sequence·period 형식은 새 화면 데이터로 판정하지 않는다', () => expect(isPatternView({ sequence: [tile(1)], period: 2, options: [] })).toBe(false));
});
