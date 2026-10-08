import { randInt, shuffle } from '../../lib/random';
import type { PuzzleGenerator } from './types';
export interface BalanceSymbol { emoji: string; label: string }
export interface BalanceEquation { counts: number[]; total: number }
export interface BalanceView { symbols: BalanceSymbol[]; equations: BalanceEquation[]; target: number }
export const BALANCE_LEVELS = [
  { symbols: 1, maxValue: 5, maxCount: 2 },
  { symbols: 1, maxValue: 9, maxCount: 3 },
  { symbols: 2, maxValue: 9, maxCount: 1 },
  { symbols: 2, maxValue: 12, maxCount: 2 },
  { symbols: 3, maxValue: 15, maxCount: 2 },
] as const;
const SYMBOLS: BalanceSymbol[] = [{ emoji: '🍎', label: '사과' }, { emoji: '🍌', label: '바나나' },
  { emoji: '🍐', label: '배' }, { emoji: '🍊', label: '귤' }];

/** 그림을 미지수로 놓고 식을 소거한다. 계수가 완전히 결정된 양의 정수 해만 받는다. */
export function solveBalance(view: BalanceView): number[] | null {
  const size = view.symbols.length;
  if (size < 1 || size > 3 || view.equations.length < 1 || view.equations.length > 3 ||
    view.equations.some(row => row.counts.length !== size || row.counts.some(n => !Number.isInteger(n) || n < 0 || n > 3) ||
      !Number.isSafeInteger(row.total) || row.total <= 0)) return null;
  const rows = view.equations.map(row => [...row.counts, row.total]);
  let rank = 0;
  for (let c = 0; c < size; c++) {
    const pivot = rows.findIndex((row, r) => r >= rank && Math.abs(row[c]) > 1e-8);
    if (pivot < 0) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    const divisor = rows[rank][c];
    rows[rank] = rows[rank].map(n => n / divisor);
    for (let r = 0; r < rows.length; r++) if (r !== rank) {
      const factor = rows[r][c]; rows[r] = rows[r].map((n, i) => n - factor * rows[rank][i]);
    }
    rank++;
  }
  if (rank !== size || rows.some(row => row.slice(0, size).every(n => Math.abs(n) < 1e-8) && Math.abs(row[size]) > 1e-8)) return null;
  const values = rows.slice(0, size).map(row => Math.round(row[size]));
  if (values.some((n, i) => n <= 0 || Math.abs(n - rows[i][size]) > 1e-8)) return null;
  return view.equations.every(row => row.counts.reduce((sum, n, i) => sum + n * values[i], 0) === row.total) ? values : null;
}
export const balanceGenerator: PuzzleGenerator<BalanceView, number> = {
  type: 'balance',
  generate(difficulty, rng) {
    const seed = randInt(0, 0xffffffff, rng), config = BALANCE_LEVELS[difficulty - 1];
    const symbols = shuffle(SYMBOLS, rng).slice(0, config.symbols);
    const values = symbols.map(() => randInt(1, config.maxValue, rng));
    // 계수가 삼각형으로 놓여 재시도 없이 해가 하나로 정해진다. 최대 3식만 만든다.
    const equations = symbols.map((_, index) => {
      const counts = symbols.map(() => 0);
      counts[index] = index === 0 ? randInt(2, Math.max(2, config.maxCount), rng) : randInt(1, config.maxCount, rng);
      if (index > 0) counts[index - 1] = randInt(1, config.maxCount, rng);
      return { counts, total: counts.reduce((sum, n, i) => sum + n * values[i], 0) };
    });
    return { type: 'balance', difficulty, seed, view: { symbols, equations, target: symbols.length - 1 }, answer: values.at(-1)!,
      hint: symbols.length === 1 ? '전체 수를 같은 그림 개수로 나눠 보세요.' : '첫 줄에서 한 그림의 수를 찾고, 다음 줄에서 그 수를 빼 보세요.' };
  },
  check(puzzle, input) { return input === puzzle.answer; },
};
