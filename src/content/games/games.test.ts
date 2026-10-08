import { describe, expect, it, vi } from 'vitest';
import type { MathAttempt, MathProblem } from '../../types';
import { buildFishPool, fishingScore, normalizeProblem } from './fishing';
import { duelQueue, duelScore, duelWinner } from './duel';
import { canPlay, crownVisible, finishDuel, finishGame, gamesPlayedToday, nextDay, normalizeGameAttempts, normalizeGames, normalizeGamesPerDay, reserveDuel, reserveGame, roundRemaining } from './limits';
import { defaultState } from '../../store/defaults';
import { emptyDay } from '../../lib/progress';
import { evaluateLevel } from '../math/adaptive';
import { normalizeState, exportState, importState, saveState } from '../../store/storage';
import { mathLevelsFor, reviewSkills } from '../math/levels';

const today = '2026-10-08';
const p: MathProblem = { skill: 'g3-add3', question: '10 + 2 = ?', answer: { kind: 'int', value: 12 } };
const attempt = (correct: boolean, problem?: MathProblem): MathAttempt => ({ skill: p.skill, correct, guessed: false, activeMs: 15000, ...(problem ? { problem } : {}) });
const ready = () => {
  const state = defaultState();
  for (const id of ['kid1', 'kid2'] as const) {
    const day = emptyDay(today); day.progress.math = state.settings[id].missions.find(m => m.type === 'math')!.target;
    day.mathAttempts = [attempt(false, p)]; day.mathBySkill = { [p.skill]: { correct: 0, total: 1 } };
    state.data[id].days[today] = day;
    state.data[id].stars = 50; state.data[id].streak = 5; state.data[id].lastCompleted = '2026-10-07';
    state.data[id].wrongNotes = [{ id: 'wrong', problem: p, addedAt: today, given: '13' }];
    state.data[id].coupons = [{ id: 'coupon', label: '기존 쿠폰', earnedAt: '2026-10-07' }];
  }
  return state;
};

describe('낚시 문제와 점수', () => {
  it('오늘 같은 문제를 한 번만 넣고 한 번 틀렸다가 맞힌 문제도 금빛이다', () => {
    const original = [attempt(true, p), attempt(false, p), attempt(true, p)];
    const pool = buildFishPool(original, [], 8);
    expect(pool).toEqual([{ id: 'fish-0', problem: p, golden: true, points: 30 }]);
    expect(original[0].correct).toBe(true); expect(fishingScore(pool)).toBe(30);
  });
  it('오늘 문제부터 담고 부족한 수만 레벨 문제로 채운다', () => {
    const filler = duelQueue('g3', 1, 5);
    const pool = buildFishPool([attempt(true, p), attempt(false)], [p, ...filler], 8);
    expect(pool).toHaveLength(8); expect(pool[0].problem).toEqual(p);
    expect(pool.every(fish => !fish.golden && fish.points === 10)).toBe(true);
    expect(fishingScore(pool)).toBe(80);
    expect(buildFishPool([], [p, p], 8)).toHaveLength(1);
  });
  it('예전 시도에는 본문이 없어도 채우고 8개 넘는 오늘 문제는 버리지 않는다', () => {
    const filler = duelQueue('g5', 3, 8);
    expect(buildFishPool([attempt(false)], filler, 8)).toHaveLength(8);
    const attempts = Array.from({ length: 12 }, (_, i) => attempt(i % 2 === 0, { ...p, question: `${i} + 2 = ?` }));
    const pool = buildFishPool(attempts, [], 8);
    expect(pool).toHaveLength(12); expect(fishingScore(pool)).toBe(240);
  });
  it('백업의 잘못된 본문·정답 형태는 물고기로 쓰지 않는다', () => {
    for (const raw of [null, {}, { ...p, answer: { kind: 'x' } }, { ...p, answer: { kind: 'int', value: Infinity } }, { ...p, answer: { kind: 'fraction', num: 1, den: 0 } }, { ...p, question: 1 }]) expect(normalizeProblem(raw)).toBeUndefined();
  });
});

describe('형제 대결', () => {
  it.each(['g3', 'g5'] as const)('%s 모든 레벨은 같은 시드로 같은 10문제를 만든다', grade => {
    for (const row of mathLevelsFor(grade)) {
      const queue = duelQueue(grade, row.level, 123);
      expect(queue).toHaveLength(10); expect(queue).toEqual(duelQueue(grade, row.level, 123));
      expect(queue.every(p => [...row.mainSkills, ...reviewSkills(grade, row.level)].includes(p.skill))).toBe(true);
    }
    expect(duelQueue(grade, 1, 123)).not.toEqual(duelQueue(grade, 1, 124));
  });
  it('각자 레벨을 사용하고 정답×10에 남은 정수 초를 더한다', () => {
    expect(duelQueue('g5', 6, 10)).not.toEqual(duelQueue('g3', 1, 10));
    expect(duelScore(8, 15399)).toBe(95); expect(duelScore(3, 0)).toBe(30); expect(duelScore(10, -1)).toBe(100);
    expect(duelWinner(100, 99)).toBe('a'); expect(duelWinner(50, 51)).toBe('b'); expect(duelWinner(50, 50)).toBe('tie');
  });
});

describe('하루 제한·왕관과 학습 기록 분리', () => {
  it('수학 미션 완료만으로 열고 꺼진 미션과 목표 미달은 잠근다', () => {
    const state = ready(), data = state.data.kid1, settings = state.settings.kid1;
    expect(canPlay(settings, data, today)).toEqual({ ok: true });
    data.days[today].progress.math!--; expect(canPlay(settings, data, today)).toEqual({ ok: false, reason: 'math-not-done' });
    data.days[today].progress.math!++; settings.missions.find(m => m.type === 'math')!.enabled = false;
    expect(canPlay(settings, data, today).ok).toBe(false);
  });
  it('시작 즉시 판 수를 차감하고 낚시·대결을 합쳐 하루 상한을 적용한다', () => {
    const state = ready(), { kid1: data } = state.data;
    expect(reserveGame(state.settings.kid1, data, today, 'fishing')).toBe(0);
    expect(reserveDuel(state, today)).toEqual({ kid1: 1, kid2: 0 });
    expect(reserveGame(state.settings.kid1, data, today, 'fishing')).toBe(2);
    expect(gamesPlayedToday(data.games!, today)).toBe(3); expect(canPlay(state.settings.kid1, data, today)).toEqual({ ok: false, reason: 'limit' });
    const original = structuredClone(state); expect(reserveDuel(state, today)).toBeNull(); expect(state).toEqual(original);
    const next = emptyDay(nextDay(today)); next.progress.math = 20; data.days[next.date] = next;
    expect(canPlay(state.settings.kid1, data, next.date).ok).toBe(true);
  });
  it('두 아이가 모두 열려야 대결을 시작하고 양쪽에 한 판씩 기록한다', () => {
    const state = ready(); delete state.data.kid2.days[today];
    const before = structuredClone(state); expect(reserveDuel(state, today)).toBeNull(); expect(state).toEqual(before);
  });
  it.each([[180, 90, 'kid1'], [70, 80, 'kid2'], [120, 120, 'tie']] as const)('점수 %i:%i 승자 %s의 왕관을 다음 날 끝까지 둔다', (a, b, winner) => {
    const state = ready(), original = structuredClone(state);
    const slots = reserveDuel(state, today)!; finishDuel(state, slots, today, a, b);
    for (const id of ['kid1', 'kid2'] as const) {
      const won = winner === id || winner === 'tie';
      expect(state.data[id].games![0]).toMatchObject({ game: 'duel', won });
      expect(crownVisible(state.data[id].crownUntil, today)).toBe(won);
      expect(crownVisible(state.data[id].crownUntil, nextDay(today))).toBe(won);
      expect(crownVisible(state.data[id].crownUntil, nextDay(nextDay(today)))).toBe(false);
      const { games: _games, crownUntil: _crown, ...learning } = state.data[id];
      void _games; void _crown;
      const { games: _oldGames, ...before } = original.data[id]; void _oldGames;
      expect(learning).toEqual(before);
    }
  });
  it('낚시 정오답 결과를 저장해도 모든 학습·보상 값과 수학 평가가 같다', () => {
    const state = ready(), original = structuredClone(state), data = state.data.kid1;
    const index = reserveGame(state.settings.kid1, data, today, 'fishing')!;
    finishGame(data, index, { date: today, game: 'fishing', score: 70, caught: 3, golden: 2 });
    expect(state).toEqual({ ...original, data: { ...original.data, kid1: { ...original.data.kid1, games: [{ date: today, game: 'fishing', score: 70, caught: 3, golden: 2 }] } } });
    expect(evaluateLevel(data.math, data.days[today], nextDay(today), 'g5')).toEqual(evaluateLevel(original.data.kid1.math, original.data.kid1.days[today], nextDay(today), 'g5'));
  });
  it('타이머는 경과 시간이며 늦은 프레임과 만료 뒤 제출에 남은 시간을 주지 않는다', () => {
    expect(roundRemaining(100, 100)).toBe(90000); expect(roundRemaining(100, 4250)).toBe(85850);
    expect(roundRemaining(100, 100000)).toBe(0);
  });
  it.each([['2026-10-31', '2026-11-01'], ['2026-12-31', '2027-01-01'], ['2028-02-28', '2028-02-29']])('월말·연말 %s → %s', (date, expected) => expect(nextDay(date)).toBe(expected));
});

describe('게임 저장 정규화·백업', () => {
  it('선택 필드가 없는 v2를 열어도 이전 학습 데이터를 유지한다', () => {
    const state = ready();
    for (const id of ['kid1', 'kid2', 'parent'] as const) { delete state.data[id].games; delete state.settings[id].gamesPerDay; }
    const restored = normalizeState(state, today);
    expect(restored.version).toBe(2); expect(restored.settings.kid1.gamesPerDay).toBe(3); expect(restored.data.kid1.games).toEqual([]);
    expect(restored.data.kid1.days).toEqual(state.data.kid1.days);
  });
  it('지난 날 본문만 지우며 정답률·풀이 시간·추측 값과 레벨 평가를 유지한다', () => {
    const state = ready(); state.data.kid1.days['2026-10-07'] = { ...emptyDay('2026-10-07'), mathAttempts: Array.from({ length: 10 }, () => attempt(true, p)) };
    const old = structuredClone(state), restored = normalizeState(state, today);
    expect(restored.data.kid1.days[today].mathAttempts[0].problem).toEqual(p);
    expect(restored.data.kid1.days['2026-10-07'].mathAttempts).toEqual(old.data.kid1.days['2026-10-07'].mathAttempts.map(({ problem: _problem, ...row }) => { void _problem; return row; }));
    expect(state).toEqual(old);
    expect(evaluateLevel(old.data.kid1.math, old.data.kid1.days['2026-10-07'], today, 'g5')).toEqual(evaluateLevel(restored.data.kid1.math, restored.data.kid1.days['2026-10-07'], today, 'g5'));
    expect(normalizeGameAttempts([{ ...attempt(true), problem: { answer: { kind: 'bad' } } }], today, today)[0].problem).toBeUndefined();
  });
  it('기록은 최근 60개·정상 날짜/점수만, 왕관과 하루 판 수는 허용 범위만 남긴다', () => {
    const state = ready();
    const raw = JSON.parse(JSON.stringify(state));
    raw.data.kid1.games = [...Array.from({ length: 65 }, (_, score) => ({ date: today, game: 'fishing', score })), { date: today, game: 'x', score: 0 }, { date: '2026-02-30', game: 'duel', score: 10 }, { date: today, game: 'duel', score: -1 }];
    raw.data.kid1.crownUntil = '2026-02-30'; raw.settings.kid1.gamesPerDay = 11;
    const restored = normalizeState(raw, today);
    expect(restored.data.kid1.games).toHaveLength(60); expect(restored.data.kid1.games![0].score).toBe(5);
    expect(restored.data.kid1.crownUntil).toBeUndefined(); expect(restored.settings.kid1.gamesPerDay).toBe(3);
    for (const value of [null, NaN, 0, 11, 1.5, '5']) expect(normalizeGamesPerDay(value)).toBe(3);
    for (let value = 1; value <= 10; value++) expect(normalizeGamesPerDay(value)).toBe(value);
    expect(normalizeGames(null)).toEqual([]); expect(crownVisible('2026-02-30', today)).toBe(false);
  });
  it('날짜가 바뀐 채 계속 열어도 저장·백업의 지난 본문을 지우고 상태는 건드리지 않는다', () => {
    const state = ready(); state.data.kid1.days['2000-01-01'] = { ...emptyDay('2000-01-01'), mathAttempts: [attempt(true, p)] };
    const original = structuredClone(state), setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    try {
      saveState(state);
      const saved = JSON.parse(setItem.mock.calls[0][1]);
      expect(saved.data.kid1.days['2000-01-01'].mathAttempts[0].problem).toBeUndefined();
      expect(JSON.parse(exportState(state)).data.kid1.days['2000-01-01'].mathAttempts[0].problem).toBeUndefined();
      expect(state).toEqual(original);
    } finally { vi.unstubAllGlobals(); }
  });
  it('version 2 백업에 게임 기록·왕관·설정을 포함하며 오늘 본문도 보존한다', () => {
    const state = ready(), date = new Date(), actualToday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    state.data.kid1.days[actualToday] = { ...state.data.kid1.days[today], date: actualToday };
    if (actualToday !== today) delete state.data.kid1.days[today];
    state.data.kid1.games = [{ date: actualToday, game: 'duel', score: 125, opponent: 'kid2', won: true }];
    state.data.kid1.crownUntil = nextDay(actualToday); state.settings.kid1.gamesPerDay = 10;
    const restored = importState(exportState(state));
    expect(restored.data.kid1).toEqual(state.data.kid1); expect(restored.settings.kid1).toEqual(state.settings.kid1);
  });
});
