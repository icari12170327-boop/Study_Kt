import { describe, expect, it } from 'vitest';
import { defaultState } from '../../store/defaults';
import { exportState, importState, normalizeState } from '../../store/storage';
import { emptyDay } from '../../lib/progress';
import { toDateKey } from '../../lib/date';
import { defaultPuzzleLevel, normalizePuzzleData, puzzleSummary, recordPuzzle } from './state';
import type { PuzzleRecord } from './types';
const today = toDateKey();
const clean = { correct: true, hinted: false, revealed: false, wrong: 0 };
const row: PuzzleRecord = { date: today, type: 'train', difficulty: 1, correct: true, hinted: false, activeSec: 17 };

describe('자유 놀이 저장 호환', () => {
  it('이전 v2에는 기본값을 더하고 꺼 둔 설정은 유지한다', () => {
    const old = defaultState();
    delete old.data.kid1.puzzles; delete old.data.kid2.puzzles;
    delete old.settings.kid1.puzzles; delete old.settings.kid2.puzzles;
    const migrated = normalizeState(old);
    expect(migrated.version).toBe(2);
    expect(migrated.settings.kid1.puzzles).toEqual({ enabled: true });
    expect(migrated.data.kid1.puzzles?.levels.sudoku).toEqual(defaultPuzzleLevel('g5'));
    expect(migrated.data.kid2.puzzles?.levels.sudoku).toEqual(defaultPuzzleLevel('g3'));
    migrated.settings.kid2.puzzles = { enabled: false };
    expect(normalizeState(migrated).settings.kid2.puzzles?.enabled).toBe(false);
  });
  it('범위 밖 레벨·잘못된 형식은 정규화하고 최근 100개만 남긴다', () => {
    const data = normalizePuzzleData({ levels: { sudoku: { level: 99, streak: -2, fails: Infinity, solved: '3', hinted: 2 }, train: { level: 4, streak: 100, fails: 100 } },
      recent: [null, {}, { ...row, type: 'bad' }, { ...row, activeSec: Infinity }, { ...row, difficulty: 9 },
        ...Array.from({ length: 105 }, (_, i) => ({ ...row, activeSec: i + 0.3 }))] }, 'g5');
    expect(data.levels.sudoku).toEqual({ level: 2, streak: 0, fails: 0, solved: 0, hinted: 2 });
    expect(data.levels.train).toMatchObject({ level: 4, streak: 2, fails: 1 });
    expect(data.recent).toHaveLength(100); expect(data.recent[0].activeSec).toBe(5);
    for (const invalid of [null, [], 'bad', 9]) expect(normalizePuzzleData(invalid, 'g3').recent).toEqual([]);
  });
  it('내보내고 가져와도 난이도와 기록·꺼 둔 설정이 같다', () => {
    const state = defaultState();
    state.settings.kid1.puzzles = { enabled: false };
    for (let i = 0; i < 3; i++) recordPuzzle(state.data.kid1, 'g5', row, clean);
    const restored = importState(exportState(state));
    expect(restored.version).toBe(2);
    expect(restored.data.kid1.puzzles).toEqual(state.data.kid1.puzzles);
    expect(restored.settings.kid1.puzzles).toEqual({ enabled: false });
  });
  it('정답·힌트·정답 보기 120회도 별·쿠폰·연속일·미션·모든 수학 기록을 바꾸지 않는다', () => {
    const state = defaultState();
    const data = state.data.kid1;
    data.stars = 12; data.streak = 7; data.lastCompleted = today;
    data.days[today] = { ...emptyDay(today), completed: true, progress: { math: 20 }, mathAttempts: [], mathBySkill: {} };
    data.coupons = [{ id: 'kept', earnedAt: today, label: '보상' }];
    const before = structuredClone(state);
    for (let i = 0; i < 120; i++) {
      const result = i % 3 === 0 ? clean : i % 3 === 1 ? { ...clean, hinted: true, wrong: 2 } : { ...clean, correct: false, revealed: true, wrong: 3 };
      recordPuzzle(data, 'g5', { ...row, type: i % 2 ? 'sudoku' : 'train', correct: result.correct, hinted: result.hinted }, result);
    }
    const after = structuredClone(state); delete after.data.kid1.puzzles; delete before.data.kid1.puzzles;
    expect(after).toEqual(before);
    expect(data.puzzles?.recent).toHaveLength(100);
    expect(puzzleSummary(data.puzzles, today)).toMatchObject({ total: 120, solved: 80, hinted: 40 });
  });
  it('종류별 난이도를 독립적으로 저장하고 최근 7일만 집계한다', () => {
    const state = defaultState();
    for (let i = 0; i < 3; i++) recordPuzzle(state.data.kid2, 'g3', row, clean);
    expect(state.data.kid2.puzzles?.levels.train?.level).toBe(2);
    expect(state.data.kid2.puzzles?.levels.sudoku?.level).toBe(1);
    const summary = puzzleSummary({ levels: {}, recent: [row, { ...row, correct: false, hinted: true }, { ...row, date: '2000-01-01' }] }, today);
    expect(summary).toEqual({ total: 2, solved: 1, correctRate: 50, hinted: 1, activeSec: 34 });
  });
});
