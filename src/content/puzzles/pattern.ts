import { pick, randInt, seededRng, shuffle, type Rng } from '../../lib/random';
import type { Difficulty, Puzzle, PuzzleGenerator } from './types';
import { patternTricks, patternTrickLimits, requiresBothAttributes } from './patternTricks';
export type PatternShape = 'circle' | 'triangle' | 'square' | 'star' | 'arrow';
export type PatternColor = 'blue' | 'orange' | 'purple' | 'green';
export type PatternDir = 0 | 90 | 180 | 270;
export type PatternAttribute = 'shape' | 'color' | 'count' | 'dir';
type Value = PatternShape | PatternColor | number | undefined;
export interface PatternTile { shape: PatternShape; color: PatternColor; count: number; dir?: PatternDir }
/** 격자의 규칙은 행·열·두 위치의 합이나 차 중 어느 방향으로 진행하는지도 가진다. */
export type PatternRule = ({ kind: 'fixed' } | { kind: 'cycle'; values: Value[] } | { kind: 'step'; delta: number } | { kind: 'turn'; deg: 90 | 180 }) & { axis?: 'row' | 'column' | 'diagonal' | 'anti-diagonal' };
export interface PatternView {
  layout: 'row' | 'grid'; cells: (PatternTile | null)[]; options: PatternTile[];
  rules: Partial<Record<PatternAttribute, PatternRule>>;
}
type Board = Pick<PatternView, 'layout' | 'cells'>;
type Source = Board | readonly (PatternTile | null)[] | readonly (readonly (PatternTile | null)[])[];
export const SHAPE_LABELS: Record<PatternShape, string> = { circle: '동그라미', triangle: '세모', square: '네모', star: '별', arrow: '화살표' };
export const COLOR_LABELS: Record<PatternColor, string> = { blue: '파랑', orange: '주황', purple: '보라', green: '초록' };
export const DIR_LABELS: Record<PatternDir, string> = { 0: '오른쪽', 90: '아래', 180: '왼쪽', 270: '위' };
export const PATTERN_ATTRIBUTES: readonly PatternAttribute[] = ['shape', 'color', 'count', 'dir'];
export const PATTERN_MAX_ATTEMPTS = 40;
export const PATTERN_MAX_OPTION_ATTEMPTS = 40;
export const PATTERN_LEVELS = [{ layout: 'row' }, { layout: 'row' }, { layout: 'row' }, { layout: 'grid' }, { layout: 'grid' }] as const;
const SHAPES: PatternShape[] = ['circle', 'triangle', 'square', 'star'];
const COLORS: PatternColor[] = ['blue', 'orange', 'purple', 'green'];
const DIRECTIONS: PatternDir[] = [0, 90, 180, 270];
const mod = (value: number, n: number) => (value % n + n) % n;
const valueOf = (tile: PatternTile, attribute: PatternAttribute): Value => attribute === 'dir' && tile.shape !== 'arrow' ? undefined : tile[attribute];
function boardOf(source: Source): Board {
  if (!Array.isArray(source)) return source as Board;
  return Array.isArray(source[0]) ? { layout: 'grid', cells: (source as readonly (readonly (PatternTile | null)[])[]).flat() } : { layout: 'row', cells: [...source] as (PatternTile | null)[] };
}
function coordinate(board: Board, index: number, rule: PatternRule): number {
  if (board.layout === 'row') return index;
  const r = Math.floor(index / 3), c = index % 3;
  return rule.axis === 'row' ? r : rule.axis === 'column' ? c : rule.axis === 'anti-diagonal' ? r - c : r + c;
}
export function samePatternTile(a: PatternTile, b: PatternTile): boolean { return PATTERN_ATTRIBUTES.every(attribute => valueOf(a, attribute) === valueOf(b, attribute)); }
export function describePatternTile(tile: PatternTile): string { return `${COLOR_LABELS[tile.color]} ${SHAPE_LABELS[tile.shape]} ${tile.count}개${tile.shape === 'arrow' ? ` ${DIR_LABELS[tile.dir ?? 0]} 방향` : ''}`; }
export function patternChoiceKey(key: string): number | null { return /^[1-4]$/.test(key) ? Number(key) : null; }
export function predictRule(source: Source, attribute: PatternAttribute, rule: PatternRule, index: number): Value {
  const board = boardOf(source), first = board.cells.findIndex(tile => tile !== null);
  if (first < 0) return undefined;
  const value = valueOf(board.cells[first]!, attribute), at = coordinate(board, index, rule), offset = at - coordinate(board, first, rule);
  if (rule.kind === 'fixed') return value;
  if (rule.kind === 'cycle') return rule.values[mod(at, rule.values.length)];
  if (typeof value !== 'number') return undefined;
  return rule.kind === 'step' ? value + offset * rule.delta : mod(value + offset * rule.deg, 360);
}
/** 생성기는 서로 다른 값을 쓰지만 후보 검사는 값이 겹치는 반복까지 모두 유한하게 열거한다. */
function cycles(values: readonly Value[], size: number, prefix: Value[] = []): Value[][] {
  if (prefix.length === size) return [prefix];
  return values.flatMap(value => cycles(values, size, [...prefix, value]));
}
const DOMAINS: Record<PatternAttribute, Value[]> = { shape: [...SHAPES, 'arrow'], color: COLORS, count: [1, 2, 3, 4, 5, 6], dir: DIRECTIONS };
const CYCLES = Object.fromEntries(PATTERN_ATTRIBUTES.map(attribute => [attribute, [2, 3, 4].flatMap(size => cycles(DOMAINS[attribute], size))])) as Record<PatternAttribute, Value[][]>;
export function consistentRules(source: Source, attribute: PatternAttribute): PatternRule[] {
  const board = boardOf(source), shown = board.cells.flatMap((tile, index) => tile ? [{ index, value: valueOf(tile, attribute) }] : []);
  if (!shown.length) return [];
  const axes: PatternRule['axis'][] = board.layout === 'row' ? [undefined] : ['row', 'column', 'diagonal', 'anti-diagonal'];
  const matches = (rule: PatternRule) => {
    if (!shown.every(row => predictRule(board, attribute, rule, row.index) === row.value)) return false;
    // 격자의 변하는 모양에는 명세의 라틴 방진 조건도 적용한다. 각 줄에 같은 세 모양이 한 번씩 있어야 한다.
    if (board.layout === 'grid' && attribute === 'shape' && new Set(shown.map(row => row.value)).size > 1) {
      const values = board.cells.map((_, i) => predictRule(board, attribute, rule, i));
      const shapes = new Set(values);
      if (shapes.size !== 3) return false;
      for (let i = 0; i < 3; i++) if (new Set(values.slice(i * 3, i * 3 + 3)).size !== 3 || new Set([values[i], values[i + 3], values[i + 6]]).size !== 3) return false;
    }
    return true;
  };
  const result: PatternRule[] = matches({ kind: 'fixed' }) ? [{ kind: 'fixed' }] : [];
  // 화살표가 없는 칸에는 방향 규칙을 만들지 않는다.
  if (attribute === 'dir' && shown.every(row => row.value === undefined)) return result;
  for (const axis of axes) {
    for (const values of CYCLES[attribute]) { const rule: PatternRule = { kind: 'cycle', values: [...values], ...(axis ? { axis } : {}) }; if (matches(rule)) result.push(rule); }
    if (attribute === 'count') for (const delta of [-2, -1, 1, 2]) {
      const rule: PatternRule = { kind: 'step', delta, ...(axis ? { axis } : {}) };
      if (matches(rule) && board.cells.every((_, i) => { const v = predictRule(board, attribute, rule, i); return typeof v === 'number' && v >= 1 && v <= 6; })) result.push(rule);
    }
    if (attribute === 'dir') for (const deg of [90, 180] as const) { const rule: PatternRule = { kind: 'turn', deg, ...(axis ? { axis } : {}) }; if (matches(rule)) result.push(rule); }
  }
  return result;
}
export function patternPredictions(board: Board): PatternTile | null {
  const blank = board.cells.indexOf(null);
  if (blank < 0 || board.cells.filter(tile => tile === null).length !== 1) return null;
  const values: Partial<Record<PatternAttribute, Value>> = {};
  for (const attribute of PATTERN_ATTRIBUTES) {
    const rules = consistentRules(board, attribute), predictions = new Set(rules.map(rule => predictRule(board, attribute, rule, blank)));
    if (!rules.length || predictions.size !== 1) return null;
    values[attribute] = [...predictions][0];
  }
  return { shape: values.shape as PatternShape, color: values.color as PatternColor, count: values.count as number, ...(values.shape === 'arrow' ? { dir: values.dir as PatternDir } : {}) };
}
export function explainRules(view: PatternView): string {
  const labels: Record<PatternAttribute, string> = { shape: '모양', color: '색', count: '개수', dir: '방향' };
  return PATTERN_ATTRIBUTES.flatMap(attribute => {
    const rule = view.rules[attribute]; if (!rule || rule.kind === 'fixed') return [];
    if (view.layout === 'grid' && attribute === 'shape') return ['모양: 가로줄과 세로줄에 같은 모양은 한 번씩 나와요'];
    const axis = view.layout === 'grid' ? rule.axis === 'row' ? '아래로 한 칸씩 가면, ' : rule.axis === 'column' ? '오른쪽으로 한 칸씩 가면, ' : rule.axis === 'anti-diagonal' ? '아래로는 이 순서, 오른쪽으로는 거꾸로, ' : '오른쪽이나 아래로 한 칸씩 가면, ' : '';
    const valueLabel = (value: Value) => attribute === 'shape' ? SHAPE_LABELS[value as PatternShape] : attribute === 'color' ? COLOR_LABELS[value as PatternColor] : attribute === 'dir' ? DIR_LABELS[value as PatternDir] : `${value}개`;
    const arrows: Record<PatternDir, string> = { 0: '→', 90: '↓', 180: '←', 270: '↑' };
    const description = rule.kind === 'cycle' ? `${rule.values.map(valueLabel).join(' → ')} 반복` : rule.kind === 'step' ? rule.axis === 'anti-diagonal' ? `아래로 한 칸 가면 ${Math.abs(rule.delta)}개 ${rule.delta > 0 ? '늘고' : '줄고'}, 오른쪽으로 한 칸 가면 ${Math.abs(rule.delta)}개 ${rule.delta > 0 ? '줄어요' : '늘어요'}` : `${Math.abs(rule.delta)}개씩 ${rule.delta > 0 ? '늘어나요' : '줄어들어요'}` : rule.deg === 180 ? '한 칸마다 반대쪽을 봐요' : `${Array.from({ length: 4 }, (_, i) => arrows[mod(Number(predictRule(view, 'dir', rule, 0)) + i * rule.deg, 360) as PatternDir]).join(' ')} 순서로 돌아요`;
    if (rule.kind === 'step' && rule.axis === 'anti-diagonal') return [`${labels[attribute]}: ${description}`];
    return [`${labels[attribute]}: ${axis}${description}`];
  }).join(' · ');
}
function hintFor(view: PatternView): string {
  const kinds = [...new Set(Object.values(view.rules).filter(rule => rule.kind !== 'fixed').map(rule => rule.kind === 'cycle' ? '반복' : rule.kind === 'step' ? '늘어남·줄어듦' : '돌아감'))];
  return view.layout === 'grid' ? `가로줄과 세로줄에서 ${kinds.join(', ')} 규칙을 찾아봐요.` : Object.values(view.rules).some(rule => rule.kind === 'step') ? '늘어나거나 줄어드는 규칙과 반복 규칙을 따로 찾아봐요.' : Object.values(view.rules).some(rule => rule.kind === 'turn') ? '돌아가는 규칙과 반복 규칙을 따로 찾아봐요.' : Object.values(view.rules).filter(rule => rule.kind === 'cycle').length === 2 ? '서로 다른 박자로 반복되는 규칙을 찾아봐요.' : '한 가지 속성이 반복돼요.';
}
function candidate(level: Difficulty, rng: Rng, stepVariant?: boolean): { view: PatternView; expected: PatternTile } {
  const shapes = shuffle(SHAPES, rng), colors = shuffle(COLORS, rng);
  const base: PatternTile = { shape: shapes[0], color: colors[0], count: 1 };
  const rules: PatternView['rules'] = { shape: { kind: 'fixed' }, color: { kind: 'fixed' }, count: { kind: 'fixed' }, dir: { kind: 'fixed' } };
  let length: number;
  if (level === 1) {
    const attribute = pick(['shape', 'color', 'count'] as const, rng), period = randInt(2, 3, rng);
    rules[attribute] = { kind: 'cycle', values: (attribute === 'shape' ? shapes : attribute === 'color' ? colors : shuffle([1, 2, 3, 4, 5, 6], rng)).slice(0, period) }; length = period * 2 + 1;
  } else if (level === 2) {
    const periods = pick([[2, 3], [2, 4], [3, 4], [4, 3]] as const, rng);
    rules.shape = { kind: 'cycle', values: shapes.slice(0, periods[0]) }; rules.color = { kind: 'cycle', values: colors.slice(0, periods[1]) }; length = Math.max(...periods) * 2;
  } else if (level === 3) {
    if (stepVariant ?? rng() < 0.5) {
      const delta = rng() < 0.5 ? 1 : -1; base.count = delta > 0 ? 1 : 6;
      rules.count = { kind: 'step', delta };
      const attribute = pick(['shape', 'color'] as const, rng); rules[attribute] = { kind: 'cycle', values: (attribute === 'shape' ? shapes : colors).slice(0, randInt(2, 3, rng)) }; length = 5;
    } else {
      base.shape = 'arrow'; base.dir = pick(DIRECTIONS, rng);
      const deg = pick([90, 180] as const, rng); rules.dir = { kind: 'turn', deg }; rules.color = { kind: 'cycle', values: colors.slice(0, 3) }; length = deg === 90 ? 6 : 5;
    }
  } else {
    if (level === 4 || rng() < 0.5) rules.shape = { kind: 'cycle', values: shapes.slice(0, 3), axis: 'diagonal' };
    else { base.shape = 'arrow'; base.dir = pick(DIRECTIONS, rng); rules.dir = { kind: 'turn', deg: pick([90, 180] as const, rng), axis: 'row' }; }
    if (level === 4) {
      const delta = rng() < 0.5 ? 1 : -1; base.count = randInt(3, 4, rng);
      rules.count = { kind: 'step', delta, axis: 'anti-diagonal' };
    }
    else {
      rules.color = { kind: 'cycle', values: colors, axis: 'diagonal' };
      const delta = rng() < 0.5 ? 1 : -1; base.count = delta > 0 ? randInt(1, 4, rng) : randInt(3, 6, rng);
      rules.count = { kind: 'step', delta, axis: 'column' };
    }
    length = 9;
  }
  const layout = level <= 3 ? 'row' : 'grid';
  const reference: Board = { layout, cells: Array.from({ length: layout === 'row' ? length + 1 : length }, () => ({ ...base })) };
  const cells = reference.cells.map((_, i) => {
    const tile = { ...base };
    for (const attribute of PATTERN_ATTRIBUTES) {
      const value = predictRule(reference, attribute, rules[attribute]!, i);
      if (attribute === 'shape') tile.shape = value as PatternShape; else if (attribute === 'color') tile.color = value as PatternColor;
      else if (attribute === 'count') tile.count = value as number; else if (tile.shape === 'arrow') tile.dir = value as PatternDir;
    }
    return tile;
  });
  const blank = layout === 'row' ? length : randInt(0, 8, rng), expected = cells[blank];
  const view: PatternView = { layout, cells, options: [], rules }; view.cells[blank] = null;
  return { view, expected };
}
function distractors(view: PatternView, answer: PatternTile, difficulty: Difficulty, rng: Rng): PatternTile[] | null {
  const blank = view.cells.indexOf(null);
  const attributes: PatternAttribute[] = answer.shape === 'arrow' ? ['color', 'count', 'dir'] : ['shape', 'color', 'count'];
  const shown = view.cells.filter((tile): tile is PatternTile => !!tile);
  const seenValues = Object.fromEntries(PATTERN_ATTRIBUTES.map(attr => [attr, new Set(shown.map(tile => valueOf(tile, attr)))])) as Record<PatternAttribute, Set<Value>>;
  const acceptable = (wrong: PatternTile[]) => {
    const options = [answer, ...wrong], board = { ...view, options };
    if (!requiresBothAttributes(board, answer)) return false;
    const metrics = patternTricks(board, answer), limits = patternTrickLimits(difficulty);
    // ★3의 step은 1~6 범위에서 다음 수가 처음 등장하므로 빈도 최소 요령을 피할 수 없다.
    // 이 유형은 판 생성 전에 10%로 선택하고, 단계 전체 200판의 빈도 적중률을 따로 검사한다.
    if (difficulty === 3 && view.rules.count?.kind === 'step') limits.leastFrequent = 1;
    return Object.entries(metrics).every(([key, value]) => {
      if (key.endsWith('First')) return true;
      if (difficulty === 1 && !['center', 'pastCenter', 'inverse', 'pastInverse'].includes(key)) return true;
      return value <= limits[key as keyof typeof limits];
    });
  };
  const wrongValues = Object.fromEntries(attributes.map(attribute => {
    const rule = view.rules[attribute]!, correct = valueOf(answer, attribute);
    const nearby = rule.kind === 'turn' ? [mod(Number(correct) + 180, 360), mod(Number(correct) - rule.deg, 360)] : rule.kind === 'step' ? [Number(correct) - rule.delta, Number(correct) + rule.delta] : [predictRule(view, attribute, rule, Math.max(0, blank - 1)), predictRule(view, attribute, rule, blank + 1)];
    const domain = attribute === 'shape' ? SHAPES : DOMAINS[attribute];
    const values = [...new Set([...nearby, ...shuffle(domain, rng)])].filter(value => value !== correct && domain.includes(value));
    const familiar = values.filter(value => seenValues[attribute].has(value));
    // 처음 보는 값이 곧 오답의 표식이 되지 않도록, 보인 대체 값이 있으면 반드시 그것을 쓴다.
    return [attribute, familiar.length ? familiar : values];
  })) as Partial<Record<PatternAttribute, Value[]>>;
  const eligible = difficulty === 1 ? attributes : attributes.filter(attr => view.rules[attr]?.kind !== 'fixed');
  const pairs = shuffle(eligible.flatMap((a, i) => eligible.slice(i + 1).map(b => [a, b] as const)), rng);
  // 2×2 조합은 어느 보기도 다른 보기의 중심이 되지 않는다. 가능한 한 움직이는 두 속성을 고른다.
  pairs.sort((a, b) => b.filter(attr => view.rules[attr]?.kind !== 'fixed').length - a.filter(attr => view.rules[attr]?.kind !== 'fixed').length);
  let attempts = 0;
  for (const [x, y] of pairs) for (const wrongX of wrongValues[x]!) for (const wrongY of wrongValues[y]!) {
    if (++attempts > PATTERN_MAX_OPTION_ATTEMPTS) return null;
    const options = [{ ...answer, [x]: wrongX }, { ...answer, [y]: wrongY }, { ...answer, [x]: wrongX, [y]: wrongY }];
    if (acceptable(options)) return options;
  }

  return null;
}
function accept(view: PatternView, expected: PatternTile, level: Difficulty): boolean {
  if (level >= 2 && view.cells.some(tile => tile && samePatternTile(tile, expected))) return false;
  const answer = patternPredictions(view);
  return !!answer && samePatternTile(answer, expected);
}
export function generatePattern(difficulty: Difficulty, rng: Rng, attemptLimit = PATTERN_MAX_ATTEMPTS): Puzzle<PatternView, number> {
  const seed = randInt(0, 0xffffffff, rng), limit = Number.isInteger(attemptLimit) ? Math.max(0, Math.min(PATTERN_MAX_ATTEMPTS, attemptLimit)) : PATTERN_MAX_ATTEMPTS;
  const stepVariant = difficulty === 3 ? rng() < 0.1 : undefined;
  let result: (ReturnType<typeof candidate> & { wrong: PatternTile[] }) | undefined;
  for (let attempt = 0; attempt < limit; attempt++) {
    const next = candidate(difficulty, rng, stepVariant);
    // 가벼운 보기 검사부터 해 규칙 후보 열거를 불필요하게 반복하지 않는다.
    const wrong = distractors(next.view, next.expected, difficulty, rng);
    if (wrong && accept(next.view, next.expected, difficulty)) { result = { ...next, wrong }; break; }
  }
  // 상한 뒤에는 단계별로 검증된 시드의 고정 판을 쓰며, 다음 호출과 배열을 공유하지 않는다.
  const fallback = !result;
  if (!result) {
    const next = candidate(difficulty, seededRng([1, 5, 2, 5, 8][difficulty - 1]), false);
    const wrong = distractors(next.view, next.expected, difficulty, seededRng(21));
    if (!wrong || !accept(next.view, next.expected, difficulty)) throw new Error('검증된 도형 규칙 대체 판의 보기를 만들지 못했어요.');
    result = { ...next, wrong };
  }
  const { view, expected, wrong } = result;
  const optionRng = fallback ? seededRng(21) : rng;
  view.options = shuffle([{ ...expected }, ...wrong], optionRng);
  return { type: 'pattern', difficulty, seed, view, answer: view.options.findIndex(tile => samePatternTile(tile, expected)) + 1, hint: hintFor(view) };
}
export function isPatternView(raw: unknown): raw is PatternView {
  if (!raw || typeof raw !== 'object') return false;
  const view = raw as PatternView;
  return ['row', 'grid'].includes(view.layout) && Array.isArray(view.cells) && (view.layout !== 'grid' || view.cells.length === 9) && view.cells.filter(tile => tile === null).length === 1 && Array.isArray(view.options) && view.options.length === 4 && !!view.rules;
}
export const patternGenerator: PuzzleGenerator<PatternView, number> = { type: 'pattern', generate: generatePattern, check(puzzle, input) { return input === puzzle.answer; } };
