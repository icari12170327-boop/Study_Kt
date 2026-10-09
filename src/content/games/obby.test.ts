import { describe, expect, it } from 'vitest';
import type { MathProblem } from '../../types';
import { buildFishPool } from './fishing';
import { answerObstacle, checkpointsPassed, needsRefill, normalizeObby, obbyScore, obstacleKind, refillRun, startRun, unlockedHats } from './obby';
import { canPlay, finishGame, normalizeGames, reserveGame } from './limits';
import { defaultState } from '../../store/defaults';
import { exportState, importState, normalizeState } from '../../store/storage';
import { emptyDay } from '../../lib/progress';
import { buildLevelQueue } from '../math/session';
import { seededRng } from '../../lib/random';

const today = '2026-10-09';
const problems: MathProblem[] = Array.from({ length: 12 }, (_, n) => ({ skill: 'g3-add3', question: `${n} + 2 = ?`, answer: { kind: 'int', value: n + 2 } }));
const pool = buildFishPool([], problems, 12);
describe('오비 진행과 점수', () => {
  it('Stage 1에서 시작하고 입력 풀을 바꾸지 않는다', () => {
    const run = startRun(pool); expect(run).toEqual({ queue: pool, stage: 1, cleared: [], falls: 0, lockedUntil: 0 });
    expect(run.queue).not.toBe(pool);
  });
  it('정답이면 맨 앞 장애물만 넘고 새 객체·배열을 반환한다', () => {
    const run = startRun(pool), before = structuredClone(run), next = answerObstacle(run, true, 100);
    expect(next).toMatchObject({ stage: 2, cleared: [pool[0]], queue: pool.slice(1), falls: 0, lockedUntil: 0 });
    expect(run).toEqual(before); expect(next).not.toBe(run); expect(next.queue).not.toBe(run.queue);
  });
  it('오답이면 다른 문제 세 개 뒤로 보내고 3초 잠근다', () => {
    const run = startRun(pool), before = structuredClone(run), next = answerObstacle(run, false, 100);
    expect(next.queue.slice(0, 5)).toEqual([pool[1], pool[2], pool[3], pool[0], pool[4]]);
    expect(next).toMatchObject({ stage: 1, cleared: [], falls: 1, lockedUntil: 3100 }); expect(run).toEqual(before);
    expect(answerObstacle(next, true, 3099)).toEqual(next);
    expect(answerObstacle(next, false, 3099)).toEqual(next);
    expect(answerObstacle(next, true, 3100).stage).toBe(2);
  });
  it.each([1, 2, 3, 4])('풀이 %i개뿐이면 남은 문제 뒤에 재배치한다', count => {
    const run = startRun(pool.slice(0, count));
    expect(answerObstacle(run, false, 0).queue).toEqual([...pool.slice(1, count), pool[0]]);
  });
  it('문제가 없으면 입력을 무시한다', () => expect(answerObstacle(startRun([]), true, 0)).toEqual(startRun([])));
  it('일반 장애물은 네 모양을 순환하고 오늘 틀린 문제는 늘 용암이다', () => {
    expect([1, 2, 3, 4, 5].map(stage => obstacleKind(pool[0], stage))).toEqual(['wall', 'spinner', 'hole', 'ladder', 'wall']);
    for (const stage of [1, 2, 4, 10]) expect(obstacleKind({ ...pool[0], golden: true, points: 30 }, stage)).toBe('lava');
  });
  it.each([[4, 0], [5, 1], [10, 2]])('%i개 넘으면 체크포인트 %i개', (count, expected) => expect(checkpointsPassed(count)).toBe(expected));
  it('일반 10점·용암 30점과 체크포인트 보너스 20점을 합친다', () => {
    let run = startRun(pool.map((fish, index) => index === 0 ? { ...fish, golden: true, points: 30 } : fish));
    for (let i = 0; i < 10; i++) run = answerObstacle(run, true, i);
    expect(run.stage).toBe(11); expect(obbyScore(run)).toBe(160); expect(obbyScore(startRun(pool))).toBe(0);
  });
  it.each([[9, []], [10, ['cap']], [19, ['cap']], [20, ['cap', 'tophat']], [29, ['cap', 'tophat']], [30, ['cap', 'tophat', 'helmet']]])('최고 Stage %i의 모자', (best, hats) => expect(unlockedHats(best as number)).toEqual(hats));
  it('남은 문제가 기본 4개보다 적거나 지정한 최소보다 적으면 보충한다', () => {
    expect(needsRefill(startRun(pool.slice(0, 3)))).toBe(true);
    expect(needsRefill(startRun(pool.slice(0, 4)))).toBe(false);
    expect(needsRefill(startRun(pool.slice(0, 4)), 5)).toBe(true);
  });
});
describe('유한한 보충과 옛 기록', () => {
  it('이미 넘은 문제와 겹치지 않는 레벨 문제부터 보충한다', () => {
    const run = answerObstacle(startRun(pool.slice(0, 2)), true, 0), before = structuredClone(run);
    const next = refillRun(run, [problems]);
    expect(next.queue.map(fish => fish.problem)).toEqual(problems.slice(1, 5));
    expect(next.queue.every(fish => fish.points === 10 && !fish.golden)).toBe(true); expect(run).toEqual(before);
  });
  it('후보가 계속 중복이어도 세 묶음만 확인하고 재사용해 보충한다', () => {
    const run = answerObstacle(startRun(pool.slice(0, 1)), true, 0);
    const next = refillRun(run, [[problems[0]], [problems[0]], [problems[0]], [problems[5]]]);
    expect(next.queue).toHaveLength(4); expect(next.queue.every(fish => fish.problem.question === problems[0].question)).toBe(true);
    expect(new Set([...next.queue, ...next.cleared].map(fish => fish.id)).size).toBe(5);
    expect(refillRun(startRun([]), [])).toEqual(startRun([]));
  });
  it.each(['g3', 'g5'] as const)('%s는 문제 본문 없는 옛 시도로도 열고 빠르게 300개를 넘어도 풀이 마르지 않는다', grade => {
    const rng = seededRng(19), filler = () => buildLevelQueue(grade, 1, [], 64, rng).map(row => row.problem);
    let run = startRun(buildFishPool([{ skill: 'old', correct: false, activeMs: 1000, guessed: false }], filler(), 8));
    for (let i = 0; i < 300; i++) {
      expect(run.queue.length).toBeGreaterThan(0);
      run = answerObstacle(run, true, i * 100);
      if (needsRefill(run)) run = refillRun(run, Array.from({ length: 3 }, filler));
    }
    expect(run.stage).toBe(301);
  });
});
describe('오비 저장·판 수 제한·학습 분리', () => {
  it('obby 행을 허용하고 stage는 0 이상 정수만 남긴다', () => {
    for (const stage of [0, 1, 30]) expect(normalizeGames([{ date: today, game: 'obby', score: 10, stage }])).toEqual([{ date: today, game: 'obby', score: 10, stage }]);
    for (const stage of [-1, 1.5, Infinity, '10', null]) expect(normalizeGames([{ date: today, game: 'obby', score: 0, stage }])).toEqual([{ date: today, game: 'obby', score: 0 }]);
  });
  it.each([undefined, null, [], { best: -1, color: 'pink', hat: 'cap' }, { best: 2.5 }, { best: Infinity }])('잘못된 꾸미기·최고 기록은 기본값: %j', raw => expect(normalizeObby(raw)).toEqual({ best: 0, color: 'blue' }));
  it('열린 모자만 남기고 알 수 없는 값은 지운다', () => {
    expect(normalizeObby({ best: 19, color: 'green', hat: 'tophat' })).toEqual({ best: 19, color: 'green' });
    expect(normalizeObby({ best: 30, color: 'red', hat: 'helmet', coins: 999 })).toEqual({ best: 30, color: 'red', hat: 'helmet' });
    expect(normalizeObby({ best: 100, color: 'yellow', hat: 'unknown' })).toEqual({ best: 100, color: 'yellow' });
  });
  it('이전 version 2 기록을 그대로 유지하고 normalizeState에서 잠긴 모자를 지운다', () => {
    const old = normalizeState(defaultState(), today); delete old.data.kid1.obby;
    const before = structuredClone(old), result = normalizeState(old, today);
    expect(result).toEqual({ ...before, data: { ...before.data, kid1: { ...before.data.kid1, obby: { best: 0, color: 'blue' } } } });
    old.data.kid1.obby = { best: 9, color: 'purple', hat: 'cap' };
    expect(normalizeState(old, today).data.kid1.obby).toEqual({ best: 9, color: 'purple' });
    expect(result.version).toBe(2); expect(old).toMatchObject(before);
  });
  it('꾸미기·최고 Stage와 낚시·대결·오비 기록을 백업으로 왕복한다', () => {
    const state = normalizeState(defaultState(), today);
    state.data.kid1.obby = { best: 30, color: 'purple', hat: 'helmet' };
    state.data.kid1.games = [{ date: today, game: 'fishing', score: 10 }, { date: today, game: 'duel', score: 10 }, { date: today, game: 'obby', score: 200, stage: 30 }];
    expect(importState(exportState(state))).toEqual(state);
  });
  it('수학 완료 전에 잠기고 낚시·대결·오비가 하루 상한을 함께 쓴다', () => {
    const state = defaultState(), data = state.data.kid2, settings = state.settings.kid2;
    expect(reserveGame(settings, data, today, 'obby')).toBeNull();
    const day = emptyDay(today); day.progress.math = 20; data.days[today] = day;
    for (const [index, game] of (['fishing', 'duel', 'obby'] as const).entries()) expect(reserveGame(settings, data, today, game)).toBe(index);
    expect(canPlay(settings, data, today)).toEqual({ ok: false, reason: 'limit' });
  });
  it('정답·오답·완료는 games와 obby 외의 모든 기록을 유지한다', () => {
    const state = normalizeState(defaultState(), today), data = state.data.kid2;
    const day = emptyDay(today); day.progress.math = 20; day.mathAttempts = [{ skill: problems[0].skill, correct: false, activeMs: 8000, guessed: false, problem: problems[0] }];
    day.mathBySkill = { [problems[0].skill]: { correct: 0, total: 1 } }; data.days[today] = day;
    data.stars = 42; data.streak = 5; data.coupons = [{ id: 'coupon', label: '쿠폰', earnedAt: today }];
    data.wrongNotes = [{ id: 'wrong', addedAt: today, given: '0', problem: problems[0] }];
    const before = structuredClone(state), slot = reserveGame(state.settings.kid2, data, today, 'obby')!;
    const run = answerObstacle(answerObstacle(startRun(pool), false, 0), true, 3000);
    finishGame(data, slot, { date: today, game: 'obby', score: obbyScore(run), stage: run.stage });
    data.obby = { best: run.stage, color: 'blue' };
    expect(state).toEqual({ ...before, data: { ...before.data, kid2: { ...before.data.kid2, games: data.games, obby: data.obby } } });
  });
});
