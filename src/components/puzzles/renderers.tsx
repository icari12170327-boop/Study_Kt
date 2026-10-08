import type { ComponentType } from 'react';
import type { Cell } from '../../content/math/bingo';
import { movePuzzleCell } from '../../content/puzzles/navigation';
import type { NumberGrid, Puzzle, PuzzleType } from '../../content/puzzles/types';
import type { SudokuView } from '../../content/puzzles/sudoku';
import type { TrainView } from '../../content/puzzles/train';

export interface PuzzleRendererProps {
  puzzle: Puzzle;
  input: unknown;
  selected: Cell;
  select: (cell: Cell) => void;
  change: (input: unknown) => void;
  disabled: boolean;
}
/** 보기형 퍼즐은 키패드 없이 Component에서 change를 호출할 수 있다. */
export interface PuzzleRenderer {
  icon: string;
  example: string;
  instruction: string;
  Component: ComponentType<PuzzleRendererProps>;
  initialInput: (puzzle: Puzzle) => unknown;
  answerInput: (puzzle: Puzzle) => unknown;
  complete: (input: unknown) => boolean;
  toAnswer: (input: unknown) => unknown;
  firstCell?: (puzzle: Puzzle) => Cell;
  move?: (puzzle: Puzzle, selected: Cell, key: string) => Cell;
  padValue?: (input: unknown, selected: Cell) => string;
  setPad?: (input: unknown, selected: Cell, value: string) => unknown;
}
function PuzzleGrid({ puzzle, input, selected, select, disabled }: PuzzleRendererProps) {
  const { rows } = puzzle.view as NumberGrid;
  const sudoku = puzzle.type === 'sudoku' ? puzzle.view as SudokuView : undefined;
  const values = input as string[][];
  const cell = (r: number, c: number) => <button key={`${r}-${c}`} type="button"
    className={`puzzle-cell ${rows[r][c] ? 'given' : ''} ${selected.r === r && selected.c === c ? 'selected' : ''}`}
    style={sudoku ? { borderRightWidth: (c + 1) % sudoku.boxCols === 0 && c < sudoku.size - 1 ? 3 : 1,
      borderBottomWidth: (r + 1) % sudoku.boxRows === 0 && r < sudoku.size - 1 ? 3 : 1 } : undefined}
    aria-label={`${r + 1}행 ${c + 1}열 ${rows[r][c] ? `주어진 수 ${rows[r][c]}` : '빈칸'}`}
    aria-pressed={!rows[r][c] && selected.r === r && selected.c === c}
    disabled={disabled || !!rows[r][c]} onClick={() => select({ r, c })}>
    {values[r][c] || '?'}
  </button>;
  return sudoku ? <div className="puzzle-grid" style={{ gridTemplateColumns: `repeat(${sudoku.size}, minmax(44px, 1fr))` }}
    role="group" aria-label={`${sudoku.size} 곱하기 ${sudoku.size} 스도쿠`}>
    {rows.flatMap((row, r) => row.map((_, c) => cell(r, c)))}
  </div> : <div className="puzzle-pyramid" role="group" aria-label="수 피라미드">
    {rows.map((row, r) => <div key={r} className="puzzle-pyramid-row">{row.map((_, c) => cell(r, c))}</div>)}
  </div>;
}
function Train({ puzzle, input }: PuzzleRendererProps) {
  return <div className="puzzle-train" role="group" aria-label="숫자 기차">
    {(puzzle.view as TrainView).numbers.map((n, i) => <span className="puzzle-car" key={i}>{n}</span>)}
    <span className="puzzle-car selected">{String(input) || '?'}</span>
  </div>;
}
const gridAdapter = {
  Component: PuzzleGrid,
  initialInput: (puzzle: Puzzle) => (puzzle.view as NumberGrid).rows.map(row => row.map(n => n ? String(n) : '')),
  answerInput: (puzzle: Puzzle) => (puzzle.answer as number[][]).map(row => row.map(String)),
  complete: (input: unknown) => (input as string[][]).every(row => row.every(n => /^\d+$/.test(n))),
  toAnswer: (input: unknown) => (input as string[][]).map(row => row.map(Number)),
  firstCell: (puzzle: Puzzle): Cell => {
    const rows = (puzzle.view as NumberGrid).rows;
    const r = rows.findIndex(row => row.includes(0));
    return { r, c: rows[r].indexOf(0) };
  },
  move: (puzzle: Puzzle, selected: Cell, key: string) => movePuzzleCell((puzzle.view as NumberGrid).rows, selected, key),
  padValue: (input: unknown, selected: Cell) => (input as string[][])[selected.r][selected.c],
  setPad: (input: unknown, selected: Cell, value: string) => (input as string[][]).map((row, r) =>
    row.map((n, c) => r === selected.r && c === selected.c ? value : n)),
};
export const PUZZLE_RENDERERS: Partial<Record<PuzzleType, PuzzleRenderer>> = {
  sudoku: { ...gridAdapter, icon: '🔢', example: '1 · □ · 3 · 4', instruction: '빈칸을 골라 숫자를 넣어요. 가로, 세로, 굵은 선 안에 같은 수는 한 번만!' },
  pyramid: { ...gridAdapter, icon: '🔺', example: '3 + 4 → 7', instruction: '위 칸은 바로 아래 두 칸을 더한 수예요.' },
  train: { icon: '🚂', example: '2 → 4 → 6 → ?', instruction: '숫자가 달라지는 규칙을 찾아 다음 수를 넣어요.', Component: Train,
    initialInput: () => '', answerInput: puzzle => String(puzzle.answer), complete: input => /^\d+$/.test(String(input)),
    toAnswer: input => Number(input), padValue: input => String(input), setPad: (_input, _selected, value) => value },
};
