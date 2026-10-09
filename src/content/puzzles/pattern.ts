import { pick, randInt, seededRng, shuffle, type Rng } from '../../lib/random';
import type { Difficulty, Puzzle, PuzzleGenerator } from './types';
export type PatternShape = 'circle' | 'triangle' | 'square' | 'star' | 'arrow';
export type PatternColor = 'blue' | 'orange' | 'purple' | 'green';
export type PatternDir = 0 | 90 | 180 | 270;
export type PatternAttribute = 'shape' | 'color' | 'count' | 'dir';
type Value = PatternShape | PatternColor | number | undefined;
export interface PatternTile { shape: PatternShape; color: PatternColor; count: number; dir?: PatternDir }
/** 격자의 규칙은 행·열·두 위치를 더한 순서 중 어느 방향으로 진행하는지도 가진다. */
export type PatternRule = ({ kind: 'fixed' } | { kind: 'cycle'; values: Value[] } | { kind: 'step'; delta: number } | { kind: 'turn'; deg: 90 | 180 }) & { axis?: 'row' | 'column' | 'diagonal' };
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
  return rule.axis === 'row' ? r : rule.axis === 'column' ? c : r + c;
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
  const axes: PatternRule['axis'][] = board.layout === 'row' ? [undefined] : ['row', 'column', 'diagonal'];
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
    const axis = view.layout === 'grid' ? rule.axis === 'diagonal' && attribute === 'shape' ? '각 가로줄·세로줄에 세 모양이 한 번씩, ' : rule.axis === 'row' ? '위에서 아래로, ' : rule.axis === 'column' ? '왼쪽에서 오른쪽으로, ' : '오른쪽이나 아래로 한 칸 갈 때, ' : '';
    const valueLabel = (value: Value) => attribute === 'shape' ? SHAPE_LABELS[value as PatternShape] : attribute === 'color' ? COLOR_LABELS[value as PatternColor] : attribute === 'dir' ? DIR_LABELS[value as PatternDir] : `${value}개`;
    const description = rule.kind === 'cycle' ? `${rule.values.map(valueLabel).join(' → ')} 반복` : rule.kind === 'step' ? `${Math.abs(rule.delta)}개씩 ${rule.delta > 0 ? '늘어나요' : '줄어들어요'}` : `시계 방향으로 ${rule.deg}도씩 돌아요`;
    return [`${labels[attribute]}: ${axis}${description}`];
  }).join(' · ');
}
function hintFor(view: PatternView): string {
  const kinds = [...new Set(Object.values(view.rules).filter(rule => rule.kind !== 'fixed').map(rule => rule.kind === 'cycle' ? '반복' : rule.kind === 'step' ? '늘어남·줄어듦' : '돌아감'))];
  return view.layout === 'grid' ? `가로줄과 세로줄에서 ${kinds.join(', ')} 규칙을 찾아봐요.` : Object.values(view.rules).some(rule => rule.kind === 'step') ? '늘어나거나 줄어드는 규칙과 반복 규칙을 따로 찾아봐요.' : Object.values(view.rules).some(rule => rule.kind === 'turn') ? '돌아가는 규칙과 반복 규칙을 따로 찾아봐요.' : Object.values(view.rules).filter(rule => rule.kind === 'cycle').length === 2 ? '서로 다른 박자로 반복되는 규칙을 찾아봐요.' : '한 가지 속성이 반복돼요.';
}
function candidate(level: Difficulty, rng: Rng): { view: PatternView; expected: PatternTile } {
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
    if (rng() < 0.5) {
      const delta = rng() < 0.5 ? 1 : -1; base.count = delta > 0 ? 1 : 6;
      rules.count = { kind: 'step', delta };
      const attribute = pick(['shape', 'color'] as const, rng); rules[attribute] = { kind: 'cycle', values: (attribute === 'shape' ? shapes : colors).slice(0, randInt(2, 3, rng)) }; length = 5;
    } else {
      base.shape = 'arrow'; base.dir = pick(DIRECTIONS, rng);
      const deg = pick([90, 180] as const, rng); rules.dir = { kind: 'turn', deg }; rules.color = { kind: 'cycle', values: colors.slice(0, 3) }; length = deg === 90 ? 5 : 4;
    }
  } else {
    if (level === 4 || rng() < 0.5) rules.shape = { kind: 'cycle', values: shapes.slice(0, 3), axis: 'diagonal' };
    else { base.shape = 'arrow'; base.dir = pick(DIRECTIONS, rng); rules.dir = { kind: 'turn', deg: pick([90, 180] as const, rng), axis: 'diagonal' }; }
    if (level === 4) rules.count = { kind: 'cycle', values: [1, 2, 3], axis: 'column' };
    else {
      rules.color = { kind: 'cycle', values: colors.slice(0, 3), axis: 'column' };
      const delta = rng() < 0.5 ? 1 : -1; base.count = delta > 0 ? randInt(1, 4, rng) : randInt(3, 6, rng);
      rules.count = { kind: 'step', delta, axis: 'row' };
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
function distractors(view: PatternView, answer: PatternTile, rng: Rng): PatternTile[] {
  const blank = view.cells.indexOf(null), choices: PatternTile[] = [];
  const attributes: PatternAttribute[] = answer.shape === 'arrow' ? ['color', 'count', 'dir'] : ['shape', 'color', 'count'];
  for (const attribute of attributes) {
    const rule = view.rules[attribute]!, correct = valueOf(answer, attribute);
    const nearby = rule.kind === 'turn' ? [mod(Number(correct) + 180, 360), mod(Number(correct) - rule.deg, 360)] : rule.kind === 'step' ? [Number(correct) - rule.delta, Number(correct) + rule.delta] : [predictRule(view, attribute, rule, Math.max(0, blank - 1)), predictRule(view, attribute, rule, blank + 1)];
    const domain = attribute === 'shape' ? SHAPES : DOMAINS[attribute];
    const wrong = [...nearby, ...shuffle(domain, rng)].find(value => value !== correct && domain.includes(value));
    choices.push({ ...answer, [attribute]: wrong });
  }
  return choices;
}
function accept(view: PatternView, expected: PatternTile, level: Difficulty): boolean {
  if (level >= 2 && view.cells.some(tile => tile && samePatternTile(tile, expected))) return false;
  const answer = patternPredictions(view);
  return !!answer && samePatternTile(answer, expected);
}
export function generatePattern(difficulty: Difficulty, rng: Rng, attemptLimit = PATTERN_MAX_ATTEMPTS): Puzzle<PatternView, number> {
  const seed = randInt(0, 0xffffffff, rng), limit = Number.isInteger(attemptLimit) ? Math.max(0, Math.min(PATTERN_MAX_ATTEMPTS, attemptLimit)) : PATTERN_MAX_ATTEMPTS;
  let result: ReturnType<typeof candidate> | undefined;
  for (let attempt = 0; attempt < limit; attempt++) { const next = candidate(difficulty, rng); if (accept(next.view, next.expected, difficulty)) { result = next; break; } }
  // 상한 뒤에는 단계별로 검증된 시드의 고정 판을 쓰며, 다음 호출과 배열을 공유하지 않는다.
  const fallback = !result;
  if (!result) result = candidate(difficulty, seededRng([1, 5, 1, 1, 1][difficulty - 1]));
  const { view, expected } = result;
  const optionRng = fallback ? seededRng(21) : rng;
  view.options = shuffle([{ ...expected }, ...distractors(view, expected, optionRng)], optionRng);
  return { type: 'pattern', difficulty, seed, view, answer: view.options.findIndex(tile => samePatternTile(tile, expected)) + 1, hint: hintFor(view) };
}
export function isPatternView(raw: unknown): raw is PatternView {
  if (!raw || typeof raw !== 'object') return false;
  const view = raw as PatternView;
  return ['row', 'grid'].includes(view.layout) && Array.isArray(view.cells) && (view.layout !== 'grid' || view.cells.length === 9) && view.cells.filter(tile => tile === null).length === 1 && Array.isArray(view.options) && view.options.length === 4 && !!view.rules;
}
export const patternGenerator: PuzzleGenerator<PatternView, number> = { type: 'pattern', generate: generatePattern, check(puzzle, input) { return input === puzzle.answer; } };
