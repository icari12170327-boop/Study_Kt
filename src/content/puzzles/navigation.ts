import { moveCell, type Cell } from '../math/bingo';
const sameCell = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;
/** 같은 줄을 먼저 찾는다. 좌우는 읽는 순서로 순환해 고립된 빈칸도 모두 방문할 수 있다. */
export function movePuzzleCell(rows: number[][], cell: Cell, key: string): Cell {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return cell;
  const cells = rows.flatMap((row, r) => row.flatMap((value, c) => value === 0 ? [{ r, c }] : []));
  const index = cells.findIndex(next => sameCell(next, cell));
  if (index < 0 || cells.length < 2) return cell;
  const size = Math.max(rows.length, ...rows.map(row => row.length));
  let cursor = cell;
  for (let i = 0; i < size; i++) {
    const next = moveCell(cursor, key, size);
    if (sameCell(next, cursor)) break;
    if (rows[next.r]?.[next.c] === 0) return next;
    cursor = next;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const direction = key === 'ArrowUp' ? -1 : 1;
    const candidates = cells.filter(next => (next.r - cell.r) * direction > 0);
    const distance = (next: Cell) => Math.abs(next.r - cell.r) + Math.abs(next.c - cell.c);
    candidates.sort((a, b) => distance(a) - distance(b) || Math.abs(a.r - cell.r) - Math.abs(b.r - cell.r) || a.c - b.c);
    if (candidates.length) return candidates[0];
  }
  const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  return cells[(index + step + cells.length) % cells.length];
}
