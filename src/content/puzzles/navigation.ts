import { moveCell, type Cell } from '../math/bingo';
/** 정해진 숫자는 건너뛰고 같은 방향의 빈칸으로 간다. 이동은 빙고의 경계 규칙을 쓴다. */
export function movePuzzleCell(rows: number[][], cell: Cell, key: string): Cell {
  const size = Math.max(rows.length, ...rows.map(row => row.length));
  let cursor = cell;
  for (let i = 0; i < size; i++) {
    const next = moveCell(cursor, key, size);
    if (next.r === cursor.r && next.c === cursor.c) break;
    if (rows[next.r]?.[next.c] === 0) return next;
    cursor = next;
  }
  return cell;
}
