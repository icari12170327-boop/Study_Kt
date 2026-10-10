import { describe, expect, it } from 'vitest';
import { seededRng } from '../../lib/random';
import { consistentRules, describePatternTile, explainRules, generatePattern, isPatternView, PATTERN_ATTRIBUTES, PATTERN_MAX_ATTEMPTS, patternGenerator, patternPredictions, predictRule, samePatternTile, type PatternTile, type PatternView } from './pattern';
import type { Difficulty } from './types';
import { patternTricks, patternTrickLimits, requiresBothAttributes } from './patternTricks';
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
    expect([1, 2]).toContain(PATTERN_ATTRIBUTES.filter(attr => option[attr] !== expected[attr]).length);
  }
  {
    const changes = view.options.filter(option => !samePatternTile(option, expected)).map(option => PATTERN_ATTRIBUTES.filter(attr => option[attr] !== expected[attr]).length).sort();
    expect(changes).toEqual([1, 1, 2]);
    expect(requiresBothAttributes(view, expected)).toBe(true);
    const changed = PATTERN_ATTRIBUTES.filter(attr => view.options.some(option => option[attr] !== expected[attr]));
    expect(changed).toHaveLength(2);
    for (const attr of changed) expect(view.options.filter(option => option[attr] === expected[attr])).toHaveLength(2);
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
    const complete: (PatternTile | null)[] = grid.cells.map(row => row ?? grid.options[generatePattern(4, seededRng(1), 0).answer - 1]);
    complete[0] = null;
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
  for (const level of [2, 3, 4, 5] as Difficulty[]) it(`★${level}: 보지 못한 값 제거와 과거 타일까지 제거한 찍기는 합의한 상한 이하`, () => {
    let valueHit = 0, combinedHit = 0, pastHit = 0;
    for (let seed = 0; seed < 200; seed++) {
      const puzzle = generatePattern(level, seededRng(seed)), view = puzzle.view, answer = view.options[puzzle.answer - 1];
      const shown = view.cells.filter((tile): tile is PatternTile => !!tile);
      const familiar = view.options.filter(option => PATTERN_ATTRIBUTES.every(attr => shown.some(tile => tile[attr] === option[attr])));
      const unseen = (options: PatternTile[]) => options.filter(option => !shown.some(tile => samePatternTile(tile, option)));
      const remaining = unseen(familiar), pastRemoved = unseen(view.options);
      if (familiar.includes(answer)) valueHit += 1 / familiar.length;
      if (remaining.includes(answer)) combinedHit += 1 / remaining.length;
      if (pastRemoved.includes(answer)) pastHit += 1 / pastRemoved.length;
      for (const option of view.options) for (const attr of PATTERN_ATTRIBUTES) {
        const alternatives = shown.filter(tile => tile[attr] !== answer[attr]);
        if (option[attr] !== answer[attr] && alternatives.length) expect(shown.some(tile => tile[attr] === option[attr])).toBe(true);
      }
    }
    const cap = level === 2 ? 0.5 : 0.4;
    expect(valueHit / 200).toBeLessThanOrEqual(cap); expect(combinedHit / 200).toBeLessThanOrEqual(cap); expect(pastHit / 200).toBeLessThanOrEqual(cap);
  });

  for (const level of levels) it(`★${level}: 보기 중심 요령 35% 이하, 과거 보기 제거 뒤 합의한 상한 이하`, () => {
    const centers = (options: PatternTile[], source = options, least = false) => {
      const scores = options.map(a => source.reduce((sum, b) => sum + PATTERN_ATTRIBUTES.filter(attr => a[attr] === b[attr]).length, 0));
      return options.filter((_, i) => scores[i] === (least ? Math.min(...scores) : Math.max(...scores)));
    };
    let hit = 0, filteredHit = 0, originalFilteredHit = 0, inverseHit = 0, inverseFilteredHit = 0, firstHit = 0, filteredFirstHit = 0;
    for (let seed = 0; seed < 200; seed++) {
      const puzzle = generatePattern(level, seededRng(seed)), view = puzzle.view, answer = view.options[puzzle.answer - 1];
      const all = centers(view.options);
      // 생성기와 독립적으로 유사도와 동점의 첫 보기 선택을 계산한다.
      if (all.includes(answer)) hit += 1 / all.length; firstHit += Number(all[0] === answer);
      const inverse = centers(view.options, view.options, true);
      if (inverse.includes(answer)) inverseHit += 1 / inverse.length;
      const unseen = view.options.filter(option => !view.cells.some(tile => tile && samePatternTile(tile, option)));
      const filtered = centers(unseen);
      if (filtered.includes(answer)) filteredHit += 1 / filtered.length;
      filteredFirstHit += Number(filtered[0] === answer);
      const inverseFiltered = centers(unseen, unseen, true);
      if (inverseFiltered.includes(answer)) inverseFilteredHit += 1 / inverseFiltered.length;
      const originalFiltered = centers(unseen, view.options);
      if (originalFiltered.includes(answer)) originalFilteredHit += 1 / originalFiltered.length;
    }
    expect(hit / 200).toBeLessThanOrEqual(0.35); expect(firstHit / 200).toBeLessThanOrEqual(0.35);
    expect(inverseHit / 200).toBeLessThanOrEqual(0.4); expect(inverseFilteredHit / 200).toBeLessThanOrEqual(level >= 2 && level <= 4 ? 0.5 : 0.4);
    expect(originalFilteredHit / 200).toBeLessThanOrEqual(level === 2 ? 0.5 : 0.4);
    expect(filteredHit / 200).toBeLessThanOrEqual(level === 2 ? 0.5 : 0.4); expect(filteredFirstHit / 200).toBeLessThanOrEqual(level === 2 ? 0.5 : 0.4);
  });
  for (const level of levels) it(`★${level}: 두 속성 필요·엄격한 2×2·공통 요령 목록과 빈도`, () => {
    const totals = Object.fromEntries(Object.keys(patternTrickLimits(level)).map(key => [key, 0])) as Record<keyof ReturnType<typeof patternTrickLimits>, number>;
    for (let seed = 0; seed < 200; seed++) {
      const puzzle = generatePattern(level, seededRng(seed)), view = puzzle.view, answer = view.options[puzzle.answer - 1];
      checkUnique(view, answer);
      const metrics = patternTricks(view, answer);
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += metrics[key];
      // 공통 함수 외에도 빈도를 독립적으로 계산해 정답 위치에 따른 편향을 막는다.
      const shown = view.cells.filter((tile): tile is PatternTile => !!tile);
      const scores = view.options.map(option => PATTERN_ATTRIBUTES.reduce((sum, attr) => sum + shown.filter(tile => tile[attr] === option[attr]).length, 0));
      for (const [key, extreme] of [['leastFrequent', Math.min(...scores)], ['mostFrequent', Math.max(...scores)]] as const) {
        const winners = view.options.filter((_, i) => scores[i] === extreme);
        expect(metrics[key]).toBe(winners.includes(answer) ? 1 / winners.length : 0);
      }
    }
    const limits = patternTrickLimits(level);
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
      if (level === 1 && !['center', 'centerFirst', 'pastCenter', 'pastCenterFirst', 'inverse', 'pastInverse'].includes(key)) continue;
      expect(totals[key] / 200, key).toBeLessThanOrEqual(limits[key]);
    }
  }, 20000);

  for (const level of levels) it(`★${level}: 형태·규칙·유일 해·가까운 오답 보기·같은 시드`, () => {
    const blanks = new Set<number>(), blankCounts = new Map<number, number>(), turns = new Set<string>();
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
        const at = view.cells.indexOf(null);
        blankCounts.set(at, (blankCounts.get(at) ?? 0) + 1);
        if (level === 4) {
          expect(view.rules.shape).toMatchObject({ kind: 'cycle', axis: 'diagonal' }); expect(view.rules.count).toMatchObject({ kind: 'step', axis: 'anti-diagonal' });
          expect(view.rules.color?.kind).toBe('fixed');
        } else { expect(view.rules.color).toMatchObject({ kind: 'cycle', axis: 'diagonal' }); expect(view.rules.count).toMatchObject({ kind: 'step', axis: 'column' }); }
        const blank = view.cells.indexOf(null), attribute = level === 4 ? 'count' : 'color';
        view.cells.forEach((tile, i) => {
          // 같은 행·열의 어느 칸을 복사해도 이 속성의 정답을 얻을 수 없다.
          if (tile && (Math.floor(i / 3) === Math.floor(blank / 3) || i % 3 === blank % 3)) expect(tile[attribute]).not.toBe(expected[attribute]);
        });
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
    if (level >= 4) {
      expect(blanks.size).toBeGreaterThanOrEqual(5);
      for (const count of blankCounts.values()) expect(count / 200).toBeLessThanOrEqual(0.4);
    }
    if (level === 3) expect(turns).toEqual(new Set(['step', 'turn']));
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
    view.cells[0] = { ...tile(1), shape: 'arrow', dir: 0 };
    view.rules = { count: { kind: 'step', delta: 1 }, dir: { kind: 'turn', deg: 90 }, shape: { kind: 'cycle', values: ['circle', 'triangle'] }, color: { kind: 'fixed' } };
    expect(explainRules(view)).toBe('모양: 동그라미 → 세모 반복 · 개수: 1개씩 늘어나요 · 방향: → ↓ ← ↑ 순서로 돌아요');
    view.rules.count = { kind: 'step', delta: -2 }; expect(explainRules(view)).toContain('2개씩 줄어들어요');
    const grid = patternGenerator.generate(4, seededRng(1)).view; expect(explainRules(grid)).toContain('가로줄과 세로줄에 같은 모양은 한 번씩'); expect(explainRules(grid)).toContain('아래로 한 칸 가면');
    view.rules.dir = { kind: 'turn', deg: 180 }; expect(explainRules(view)).toContain('한 칸마다 반대쪽을 봐요'); expect(explainRules(view)).not.toContain('도씩');
  });
  it('이전 sequence·period 형식은 새 화면 데이터로 판정하지 않는다', () => expect(isPatternView({ sequence: [tile(1)], period: 2, options: [] })).toBe(false));
});
