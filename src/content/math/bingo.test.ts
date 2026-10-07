import { describe, expect, it } from 'vitest';
import { actBingo, bingoElapsed, canBingoHint, canBingoPass, defaultBingoSettings, startBingoGame, type BingoGame, adjustClock, checkLine, findLines, generateBingoBoard, isStraightLine, lineFromEnds, MAX_BOARD_ATTEMPTS, moveCell, normalizeBingoData, normalizeBingoSettings, pauseClock, recordBingo, remaining, resumeClock, startClock, toggleCell, updateBest, type BingoBoard, type Cell, type ProductMix } from './bingo';
import { seededRng } from '../../lib/random';
import { emptyProfileData } from '../../store/defaults';
import type { BingoRecord } from '../../types';

const grid: BingoBoard = { size: 3, grid: [[2, 3, 4], [5, 6, 7], [8, 9, 10]], goals: [] };
const rec: BingoRecord = { date: '2026-10-07', level: 'g5', limitSec: 120, found: 8, bingos: 1, hints: 2 };
function verify(board: BingoBoard, level: 'g3' | 'g5', count: number | readonly number[]) {
  expect(board.size).toBe(level === 'g3' ? 5 : 6);
  expect(board.grid).toHaveLength(board.size);
  for (const row of board.grid) {
    expect(row).toHaveLength(board.size);
    for (const n of row) { expect(Number.isInteger(n)).toBe(true); expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(level === 'g3' ? 9 : 20); }
  }
  expect(board.goals).toHaveLength(5);
  expect(new Set(board.goals.map(g => g.target)).size).toBe(5);
  const products = board.goals.filter(g => g.op === 'product');
  if (typeof count === 'number') expect(products).toHaveLength(count); else expect(count).toContain(products.length);
  if (products.length) expect(board.grid.flat().filter(n => n <= 12).length).toBeGreaterThanOrEqual(18);
  const sums = new Set<string>(), prods = new Set<string>();
  for (const goal of board.goals) {
    expect(goal.target).toBeGreaterThanOrEqual(goal.op === 'product' ? 12 : level === 'g3' ? 6 : 10);
    expect(goal.target).toBeLessThanOrEqual(goal.op === 'product' ? 400 : level === 'g3' ? 24 : 50);
    const lines = findLines(board, goal);
    expect(lines.length).toBeGreaterThanOrEqual(1); expect(lines.length).toBeLessThanOrEqual(4);
    for (const line of lines) {
      expect(checkLine(board, goal, line)).toEqual({ ok: true });
      const values = line.map(cell => board.grid[cell.r][cell.c]);
      if (goal.op === 'product') expect(values).not.toContain(1);
      (goal.op === 'sum' ? sums : prods).add(values.sort((a, b) => a - b).join(','));
    }
  }
  expect([...sums].some(key => prods.has(key))).toBe(false);
}

describe('빙고 줄과 채점', () => {
  const lines: Cell[][] = [
    [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }],
    [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
    [{ r: 0, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 2 }],
    [{ r: 0, c: 2 }, { r: 1, c: 1 }, { r: 2, c: 0 }],
  ];
  for (const line of lines) it(`가로·세로·두 대각선과 역순 ${JSON.stringify(line)}`, () => {
    expect(isStraightLine(line)).toBe(true); expect(isStraightLine([...line].reverse())).toBe(true);
    expect(lineFromEnds(line[0], line[2])).toEqual(line); expect(lineFromEnds(line[2], line[0])).toEqual([...line].reverse());
  });
  it('중복·꺾임·떨어짐·가운데 위치·범위 밖·소수 좌표를 검사한다', () => {
    for (const cells of [[], lines[0].slice(0, 2), [lines[0][0], lines[0][0], lines[0][0]],
      [lines[0][0], lines[0][2], lines[0][1]], [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }],
      [{ r: 0, c: 0 }, { r: 0, c: 2 }, { r: 0, c: 4 }], [{ r: -1, c: 0 }, { r: 0, c: 0 }, { r: 1, c: 0 }]]) expect(isStraightLine(cells)).toBe(false);
    for (const end of [{ r: 0, c: 1 }, { r: 1, c: 2 }, { r: 0, c: 4 }, { r: -2, c: 0 }, { r: 0.5, c: 2 }]) expect(lineFromEnds({ r: 0, c: 0 }, end)).toBeNull();
    expect(checkLine(grid, { op: 'sum', target: 18 }, [{ r: 3, c: 0 }, { r: 3, c: 1 }, { r: 3, c: 2 }])).toEqual({ ok: false, reason: 'not-line' });
  });
  it('합·곱 정답과 실제 오답 계산을 돌려준다', () => {
    expect(checkLine(grid, { op: 'sum', target: 9 }, lines[0])).toEqual({ ok: true });
    expect(checkLine(grid, { op: 'product', target: 24 }, lines[0])).toEqual({ ok: true });
    expect(checkLine(grid, { op: 'sum', target: 15 }, lines[0])).toEqual({ ok: false, reason: 'wrong', values: [2, 3, 4], result: 9 });
    expect(checkLine(grid, { op: 'product', target: 15 }, lines[0])).toEqual({ ok: false, reason: 'wrong', values: [2, 3, 4], result: 24 });
  });
  it('정답 줄을 모두 찾고 역순은 하나로 센다', () => {
    expect(findLines(grid, { op: 'sum', target: 18 })).toHaveLength(4);
    expect(findLines(grid, { op: 'product', target: 24 })).toEqual([lines[0]]);
    expect(findLines(grid, { op: 'sum', target: 100 })).toEqual([]);
  });
  it('선택 취소와 판 가장자리 방향 이동을 처리한다', () => {
    expect(toggleCell([lines[0][0]], lines[0][0])).toEqual([]);
    expect(toggleCell([lines[0][0]], lines[0][1])).toEqual(lines[0].slice(0, 2));
    expect(moveCell({ r: 0, c: 0 }, 'ArrowLeft', 5)).toEqual({ r: 0, c: 0 });
    expect(moveCell({ r: 4, c: 4 }, 'ArrowDown', 5)).toEqual({ r: 4, c: 4 });
    expect(moveCell({ r: 2, c: 2 }, 'ArrowUp', 5)).toEqual({ r: 1, c: 2 });
  });
});

describe('유한한 빙고 생성기', () => {
  it('둘째 100개 시드: 범위·목표 고유성·1~4개 정답·덧셈만', () => {
    for (let seed = 0; seed < 100; seed++) verify(generateBingoBoard('g3', seededRng(seed), { productMix: 'many' }), 'g3', 0);
  });
  for (const mix of ['off', 'few', 'normal', 'many'] as ProductMix[]) it(`첫째 ${mix} 100개 시드: 곱 개수·숫자·목표 범위·혼동 없는 묶음`, () => {
    for (let seed = 0; seed < 100; seed++) verify(generateBingoBoard('g5', seededRng(seed), { productMix: mix }), 'g5', mix === 'off' ? 0 : mix === 'few' ? 1 : mix === 'many' ? 4 : [2, 3]);
  });
  it('같은 시드에 결정적이고 기본은 곱 2~3개다', () => {
    expect(generateBingoBoard('g5', seededRng(16))).toEqual(generateBingoBoard('g5', seededRng(16)));
    verify(generateBingoBoard('g5', seededRng(16)), 'g5', [2, 3]);
  });
  it('불운한 고정 난수에서도 재시도 상한 뒤 검증된 예비 판을 내준다', () => {
    for (const n of [0, 0.999999]) for (const level of ['g3', 'g5'] as const) for (const mix of ['off', 'few', 'normal', 'many'] as ProductMix[]) {
      let calls = 0;
      const board = generateBingoBoard(level, () => { calls++; return n; }, { productMix: mix });
      expect(calls).toBeLessThan(MAX_BOARD_ATTEMPTS * 250 + 10);
      verify(board, level, level === 'g3' || mix === 'off' ? 0 : mix === 'few' ? 1 : mix === 'many' ? 4 : [2, 3]);
    }
    const board = generateBingoBoard('g3', () => 0);
    board.grid[0][0] = 100;
    expect(generateBingoBoard('g3', () => 0).grid[0][0]).not.toBe(100);
  });
});

describe('실제 시각 기반 빙고 시계', () => {
  it('늦은 틱·0초·뒤로 간 시계에서 남은 시간을 안전하게 계산', () => {
    const clock = startClock(120, 1000), before = { ...clock };
    expect(remaining(clock, 6000)).toBe(115000);
    expect(remaining(clock, 125000)).toBe(0);
    expect(remaining(clock, 500)).toBe(120000);
    expect(clock).toEqual(before);
  });
  it('멈춘 동안 줄지 않고 재개 시점부터 다시 센다', () => {
    const clock = pauseClock(startClock(120, 0), 10000);
    expect(clock.runningSince).toBeUndefined(); expect(remaining(clock, 100000)).toBe(110000);
    const resumed = resumeClock(clock, 100000);
    expect(remaining(resumed, 105000)).toBe(105000);
    expect(resumeClock(resumed, 102000).runningSince).toBe(100000);
  });
  it('+5초는 상한을 넘지 않고 -3초는 0 미만으로 내려가지 않는다', () => {
    const clock = startClock(60, 0);
    expect(remaining(adjustClock(clock, 1000, 5000), 1000)).toBe(60000);
    expect(remaining(adjustClock(clock, 10000, 5000), 12000)).toBe(53000);
    expect(remaining(adjustClock(clock, 59000, -3000), 59000)).toBe(0);
    const paused = adjustClock(pauseClock(clock, 10000), 50000, -3000);
    expect(paused.runningSince).toBeUndefined(); expect(remaining(paused, 100000)).toBe(47000);
  });
});

describe('기록·설정 순수 로직', () => {
  it('더 많이 찾거나 동점에서 힌트가 적으면 갱신하고 제한 시간은 분리한다', () => {
    const best = { '120': rec }, before = structuredClone(best);
    expect(updateBest(best, { ...rec, found: 9 }).isNew).toBe(true);
    expect(updateBest(best, { ...rec, hints: 1 }).isNew).toBe(true);
    expect(updateBest(best, { ...rec, hints: 3 }).isNew).toBe(false);
    expect(updateBest(best, rec).isNew).toBe(false);
    expect(Object.keys(updateBest(best, { ...rec, limitSec: 180 }).best)).toEqual(['120', '180']);
    expect(best).toEqual(before);
  });
  it('날짜·정수·학년이 손상된 기록을 제외하며 최근 20개와 유효한 시간별 최고를 보존', () => {
    const recent = Array.from({ length: 25 }, (_, i) => ({ ...rec, found: i }));
    expect(normalizeBingoData({ recent }).recent).toHaveLength(20);
    for (const patch of [{ found: NaN }, { hints: -1 }, { bingos: 0.5 }, { limitSec: Infinity }, { date: '2026-02-30' }, { level: 'bad' }]) expect(normalizeBingoData({ recent: [{ ...rec, ...patch }] }).recent).toEqual([]);
    expect(normalizeBingoData({ best: { '120': rec, '180': rec, invalid: rec }, recent: null })).toEqual({ recent: [], best: { '120': rec } });
    expect(normalizeBingoData(null)).toEqual({ recent: [], best: {} });
    expect(normalizeBingoData({ recent: [], best: [] })).toEqual({ recent: [], best: {} });
  });
  it('기본 제한 시간·범위·30초 간격·둘째 곱 금지·켜짐을 정규화', () => {
    expect(normalizeBingoSettings(null, 'g3')).toEqual({ enabled: true, productMix: 'off', limitSec: 180 });
    expect(normalizeBingoSettings({ enabled: false, productMix: 'many', limitSec: 300 }, 'g5')).toEqual({ enabled: false, productMix: 'many', limitSec: 300 });
    expect(normalizeBingoSettings({ productMix: 'many' }, 'g3').productMix).toBe('off');
    for (const limitSec of [0, 59, 301, 121, NaN]) expect(normalizeBingoSettings({ limitSec }, 'g5').limitSec).toBe(120);
  });
  it('빙고 기록만 바꾸며 별·쿠폰·연속일·학습 기록에는 관여하지 않는다', () => {
    const data = emptyProfileData('g5'); data.stars = 41; data.streak = 9;
    const before = structuredClone(data);
    expect(recordBingo(data, rec)).toBe(true);
    const { bingo, ...rest } = data;
    const { bingo: ignored, ...old } = before;
    void ignored;
    expect(rest).toEqual(old); expect(bingo?.best['120']).toEqual(rec);
    for (let n = 0; n < 25; n++) recordBingo(data, { ...rec, found: n });
    expect(data.bingo?.recent).toHaveLength(20);
  });
});


describe('빙고 게임 흐름', () => {
  const rng = () => seededRng(16);
  const start = (mode: 'time' | 'practice' = 'time') => startBingoGame('g3', defaultBingoSettings('g3'), mode, rng(), 1000);
  const act = (game: BingoGame, type: 'tick' | 'pause' | 'resume' | 'hint' | 'pass', now: number) => actBingo(game, { type }, now, rng());
  const solve = (game: BingoGame, now: number) => actBingo(game, { type: 'line', cells: findLines(game.board, game.board.goals[game.goalIndex])[0] }, now, rng());
  it('3초 카운트다운 동안 입력을 막고 늦은 틱도 실제 경과 시간을 반영한다', () => {
    let game = start();
    expect(solve(game, 2000).found).toBe(0);
    game = act(game, 'tick', 9000);
    expect(game.phase).toBe('playing'); expect(remaining(game.clock, 9000)).toBe(175000);
    expect(bingoElapsed(game, 9000)).toBe(5000);
  });
  it('카운트다운도 숨김 중 멈추고 남은 시간부터 재개한다', () => {
    let game = act(start(), 'pause', 2000);
    expect(game.phase).toBe('paused');
    game = act(game, 'resume', 90000);
    expect(game.phase).toBe('countdown');
    game = act(game, 'tick', 92000);
    expect(game.phase).toBe('playing'); expect(remaining(game.clock, 92000)).toBe(180000);
  });
  it('정답 보너스와 선, 다음 목표를 처리하고 같은 칸도 다시 쓸 수 있다', () => {
    const game = solve(act(start(), 'tick', 4000), 14000);
    expect(game.found).toBe(1); expect(game.goalIndex).toBe(1); expect(game.lines).toHaveLength(1);
    expect(game.selected).toEqual([]); expect(remaining(game.clock, 14000)).toBe(175000);
    const next = solve(game, 14000); expect(next.found).toBe(2); expect(next.lines).toHaveLength(2);
  });
  it('0초에 도착한 모든 입력은 결과로만 넘어가며 보너스로 살아나지 않는다', () => {
    const game = act(start(), 'tick', 4000), cells = findLines(game.board, game.board.goals[0])[0];
    for (const action of [{ type: 'line' as const, cells }, { type: 'select' as const, cell: cells[0] }, { type: 'hint' as const }, { type: 'pass' as const }]) {
      const ended = actBingo(game, action, 184000, rng());
      expect(ended.phase).toBe('ended'); expect(ended.found).toBe(0); expect(ended.hints).toBe(0);
      expect(remaining(ended.clock, 184000)).toBe(0);
    }
  });
  it('힌트는 목표별 20초/40초 후 한 번만 가능하고 3초를 차감한다', () => {
    let game = act(start(), 'tick', 4000);
    expect(canBingoHint(game, 23999)).toBe(false); expect(canBingoHint(game, 24000)).toBe(true);
    game = act(game, 'hint', 24000);
    expect(game.hints).toBe(1); expect(game.hintCell).toEqual(findLines(game.board, game.board.goals[0])[0][1]);
    expect(remaining(game.clock, 24000)).toBe(157000); expect(act(game, 'hint', 25000).hints).toBe(1);
    const practice = start('practice');
    expect(canBingoHint(practice, 40999)).toBe(false); expect(canBingoHint(practice, 41000)).toBe(true);
    expect(act(practice, 'hint', 41000).clock).toEqual(practice.clock);
  });
  it('3초 이하에서 힌트를 쓰면 즉시 종료한다', () => {
    const game = act(act(start(), 'tick', 4000), 'hint', 182000);
    expect(game.phase).toBe('ended'); expect(game.hints).toBe(1);
  });
  it('숨김 시간은 타이머, 힌트, 패스 대기에 포함하지 않는다', () => {
    let game = act(act(start(), 'tick', 4000), 'pass', 5000);
    game = act(game, 'pause', 6000);
    expect(remaining(game.clock, 99000)).toBe(178000);
    game = act(game, 'resume', 99000);
    expect(canBingoPass(game, 100000)).toBe(false); expect(canBingoPass(game, 101000)).toBe(true);
    expect(canBingoHint(game, 117999)).toBe(false); expect(canBingoHint(game, 118000)).toBe(true);
  });
  it('패스는 목표에만 포함하고 3초 동안 다시 누르지 못한다', () => {
    const game = act(act(start(), 'tick', 4000), 'pass', 4000);
    expect(game.goalIndex).toBe(1); expect(game.found).toBe(0);
    expect(act(game, 'pass', 6999).goalIndex).toBe(1); expect(act(game, 'pass', 7000).goalIndex).toBe(2);
  });
  it('5개를 모두 맞히면 빙고와 새 판이 생기고 타이머는 이어진다', () => {
    let game = act(start(), 'tick', 4000);
    for (let i = 0; i < 5; i++) game = solve(game, 5000 + i * 6000);
    expect(game.phase).toBe('bingo'); expect(game.bingos).toBe(1); expect(game.found).toBe(5);
    const clock = game.clock, board = game.board;
    game = act(game, 'tick', 30000);
    expect(game.phase).toBe('playing'); expect(game.board).not.toBe(board); expect(game.goalIndex).toBe(0);
    expect(game.lines).toEqual([]); expect(game.clock).toEqual(clock);
  });
  it('패스한 판은 완성 빙고 수에 포함하지 않지만 다음 판으로 넘어간다', () => {
    let game = act(start(), 'tick', 4000);
    for (let i = 0; i < 5; i++) game = act(game, 'pass', 4000 + i * 3000);
    expect(game.phase).toBe('bingo'); expect(game.bingos).toBe(0);
    expect(act(game, 'tick', 17000).phase).toBe('playing');
  });
  it('연습은 한 판 뒤 종료하며 제한 시간을 훨씬 지나도 입력할 수 있다', () => {
    let game = start('practice');
    for (let i = 0; i < 5; i++) game = solve(game, 900000 + i * 1000);
    expect(game.phase).toBe('ended'); expect(game.found).toBe(5); expect(game.bingos).toBe(1);
  });
  it('탭 선택 취소·자동 채점, 뒤로 지우기·전체 취소와 잘못된 줄 안내', () => {
    let game = start('practice');
    const line = findLines(game.board, game.board.goals[0])[0];
    game = actBingo(game, { type: 'select', cell: line[0] }, 2000, rng());
    expect(actBingo(game, { type: 'select', cell: line[0] }, 2000, rng()).selected).toEqual([]);
    expect(actBingo(game, { type: 'undo' }, 2000, rng()).selected).toEqual([]);
    expect(actBingo(game, { type: 'clear' }, 2000, rng()).selected).toEqual([]);
    for (const cell of line.slice(1)) game = actBingo(game, { type: 'select', cell }, 2000, rng());
    expect(game.found).toBe(1);
    game = actBingo(game, { type: 'line', cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }] }, 2000, rng());
    expect(game.feedback?.kind).toBe('not-line'); expect(game.found).toBe(1);
    const wrong = { ...game, board: { ...game.board, goals: [{ op: 'sum' as const, target: 999 }] }, goalIndex: 0 };
    const result = actBingo(wrong, { type: 'line', cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }] }, 2000, rng());
    expect(result.feedback?.kind).toBe('wrong'); expect(result.feedback?.text).toContain('목표는 999야'); expect(result.goalIndex).toBe(0);
  });
});
