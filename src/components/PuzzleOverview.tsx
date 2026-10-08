import type { Level, ProfileData } from '../types';
import { PUZZLE_LABELS, registeredPuzzleTypes } from '../content/puzzles/registry';
import { defaultPuzzleLevel, puzzleSummary } from '../content/puzzles/state';
import { toDateKey } from '../lib/date';

export function PuzzleOverview({ data, grade, today = toDateKey() }: { data: ProfileData; grade: Level; today?: string }) {
  const summary = puzzleSummary(data.puzzles, today);
  return <section className="puzzle-overview">
    <h3>🧩 두뇌 퍼즐 · 자유 놀이</h3>
    <div className="chip-wrap">{registeredPuzzleTypes().map(type => <span className="chip" key={type}>
      {PUZZLE_LABELS[type]} ★{data.puzzles?.levels[type]?.level ?? defaultPuzzleLevel(grade).level}
    </span>)}</div>
    <p className="small">최근 7일 {summary.total}개 · 맞힌 퍼즐 {summary.solved}개 · 정답률 {summary.correctRate}% · 힌트 {summary.hinted}회</p>
  </section>;
}
