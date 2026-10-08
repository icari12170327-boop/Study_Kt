import { describe, expect, it } from 'vitest';
import { defaultState } from '../store/defaults';
import { SCIENCE_QUESTIONS } from '../content/science/questions';
import { emptyDay } from './progress';
import { toDateKey } from './date';
import { buildWeeklyStats, compareStats, reportText, weekRange, weeklyNoticeDay, weeklyReportRequest } from './weeklyReport';

function fixture() {
  const state = defaultState(), data = state.data.kid2;
  data.stars = 999; data.streak = 99;
  for (const date of ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-08', '2026-10-12']) data.days[date] = { ...emptyDay(date), completed: true };
  data.days['2026-10-05'].mathBySkill = { 'g3-add3': { total: 4, correct: 3 }, 'g3-sub3': { total: 2, correct: 1 } };
  data.days['2026-10-06'].mathBySkill = { 'g3-add3': { total: 2, correct: 2 }, 'g3-div-basic': { total: 2, correct: 0 }, 'g3-mul2x1': { total: 1, correct: 1 } };
  data.days['2026-10-05'].correct = 888; data.days['2026-10-05'].total = 999;
  data.days['2026-10-05'].mathAttempts = [
    { skill: 'g3-add3', correct: true, activeMs: 10000, guessed: false, story: true },
    { skill: 'g3-add3', correct: false, activeMs: 2000, guessed: true, story: true },
    { skill: 'g3-sub3', correct: false, activeMs: 2000, guessed: true },
  ];
  data.math.level = 5;
  data.math.history = ['2026-10-04', '2026-10-06', '2026-10-12'].map((date, i) => ({ date, level: 3 + i, counted: 20, correct: 18, guesses: 0, medianSec: 10 }));
  data.days['2026-10-05'].science = { total: 5, correct: 4, units: ['life'] };
  data.days['2026-10-06'].science = { total: 3, correct: 2, units: ['life'] };
  const cards = SCIENCE_QUESTIONS.filter(q => q.unit === 'life').slice(0, 5);
  cards.forEach((q, i) => data.science.collected[q.id] = i < 3 ? '2026-10-04' : '2026-10-05');
  data.science.badges = ['life:5'];
  data.talks = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-08'].map((date, i) => ({ id: String(i), date, seconds: 90, englishRatio: 80,
    lines: [{ role: 'kid', text: 'PRIVATE-TALK-RAW', at: 1 }],
    summary: { highlightKo: `한 줄 ${i}`, topicsKo: [], newExpressions: [], nextTopics: [] } }));
  data.days['2026-10-06'].talkSeconds = 150;
  data.coupons = ['2026-10-04', '2026-10-05', '2026-10-11', '2026-10-12'].map(date => ({ id: date, label: '쿠폰', earnedAt: date }));
  const record = { level: 'g3' as const, limitSec: 120, found: 7, bingos: 1, hints: 0 };
  data.bingo!.recent = [{ ...record, date: '2026-10-05' }, { ...record, found: 10, date: '2026-10-08' }, { ...record, found: 99, date: '2026-10-04' }];
  data.bingo!.best = { '120': { ...record, found: 99, date: '2026-10-04' } };
  data.puzzles!.daily = [{ date: '2026-10-05', solved: 12, total: 14, hinted: 1, activeSec: 100 }];
  data.puzzles!.recent = [{ date: '2026-10-05', type: 'train', difficulty: 1, correct: true, hinted: false, activeSec: 10 },
    { date: '2026-10-08', type: 'sudoku', difficulty: 2, correct: true, hinted: false, activeSec: 10 }];
  data.games = [{ date: '2026-10-05', game: 'fishing', score: 5 }, { date: '2026-10-08', game: 'duel', score: 2, won: true },
    { date: '2026-10-08', game: 'duel', score: 1, won: false }, { date: '2026-10-04', game: 'duel', score: 2, won: true }];
  data.stories = { 'small-island': { finished: 5, unlocked: 6, lastUnlockDate: '2026-10-08', answers: { '1:0': [true] } } };
  return state;
}
describe('주간 범위와 안내 날짜', () => {
  it.each([
    ['2026-10-11', '2026-10-05', '2026-10-11'], ['2026-10-12', '2026-10-12', '2026-10-18'],
    ['2026-11-01', '2026-10-26', '2026-11-01'], ['2027-01-01', '2026-12-28', '2027-01-03'],
    ['2028-02-29', '2028-02-28', '2028-03-05'],
  ])('%s를 월~일 범위로 계산한다', (date, start, end) => expect(weekRange(date)).toEqual({ start, end }));
  it('일요일 23:59와 월요일 00:00에서 주가 바뀌고 지난 두 주도 계산한다', () => {
    expect(weekRange(toDateKey(new Date(2026, 9, 11, 23, 59)))).toEqual({ start: '2026-10-05', end: '2026-10-11' });
    expect(weekRange(toDateKey(new Date(2026, 9, 12, 0, 0)))).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(weekRange('2026-10-12', -1)).toEqual({ start: '2026-10-05', end: '2026-10-11' });
    expect(weekRange('2026-10-12', -2)).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(weeklyNoticeDay('2026-10-11')).toBe(true); expect(weeklyNoticeDay('2026-10-12')).toBe(true); expect(weeklyNoticeDay('2026-10-09')).toBe(false);
  });
  it('존재하지 않는 날짜와 소수 주 간격을 거부한다', () => {
    for (const date of ['2026-02-30', '2026-13-01', 'bad', '2026-10-08T23:59:00Z']) expect(() => weekRange(date)).toThrow();
    expect(() => weekRange('2026-10-08', 0.5)).toThrow();
  });
});
describe('고정 기록 집계', () => {
  it('출석·쿠폰·수학의 분모·단원·레벨·문장제·찍기가 원기록과 일치한다', () => {
    const stats = buildWeeklyStats(fixture(), 'kid2', weekRange('2026-10-08'));
    expect(stats.attendance).toEqual({ completedDays: 3, streak: 3, stars: null, coupons: 2 });
    expect(stats.math).toMatchObject({ solved: 11, accuracy: 64, currentLevel: 5, levelStart: 3, levelEnd: 4, guesses: 1, storyAccuracy: 50 });
    expect(stats.math.weakSkills.map(row => [row.skill, row.accuracy])).toEqual([['g3-div-basic', 0], ['g3-sub3', 50], ['g3-add3', 83]]);
  });
  it('단원이 한 개뿐이고 모두 맞혔다면 살펴볼 단원과 AI 입력에서 제외한다', () => {
    const state = defaultState(), day = emptyDay('2026-10-05');
    day.mathBySkill = { 'g3-add3': { total: 8, correct: 8 } }; state.data.kid2.days[day.date] = day;
    const stats = buildWeeklyStats(state, 'kid2', weekRange(day.date));
    expect(stats.math).toMatchObject({ solved: 8, accuracy: 100, weakSkills: [] });
    expect(weeklyReportRequest(stats, 'g3').input.stats.math.weakSkills).toEqual([]);
    expect(reportText(stats)).toContain('살펴볼 수학 단원: 기록 없음');
  });
  it('기록된 단원이 세 개 미만이어도 100%는 빼고 나머지 단원만 정답률순으로 남긴다', () => {
    const state = defaultState(), day = emptyDay('2026-10-05');
    day.mathBySkill = { 'g3-add3': { total: 8, correct: 8 }, 'g3-sub3': { total: 4, correct: 3 } }; state.data.kid2.days[day.date] = day;
    const stats = buildWeeklyStats(state, 'kid2', weekRange(day.date));
    expect(stats.math.weakSkills.map(row => row.skill)).toEqual(['g3-sub3']);
    expect(stats.math).toMatchObject({ solved: 12, accuracy: 92 });
  });
  it('과학 정답률은 전체 정답률과 분리하고 배지의 획득일은 첫 정답 날짜로 재구성한다', () => {
    const stats = buildWeeklyStats(fixture(), 'kid2', weekRange('2026-10-08'));
    expect(stats.science).toEqual({ solved: 8, accuracy: 75, newCards: 2, newBadges: ['life:5'] });
  });
  it('대화 시간을 일별 합계와 중복하지 않고 자유 놀이의 날짜 범위를 지킨다', () => {
    const stats = buildWeeklyStats(fixture(), 'kid2', weekRange('2026-10-08'));
    expect(stats.talk).toEqual({ minutes: 5.5, sessions: 3, highlights: ['한 줄 3', '한 줄 2', '한 줄 1'] });
    expect(stats.play).toEqual({ bingoGames: 2, bingoBest: 10, puzzlesSolved: 13, puzzleLevelUps: null, fishing: 1, duels: 2, crowns: 1, storyEpisodes: null });
  });
  it('날짜 없는 누적 값은 주간 값으로 쓰지 않고 기록 없는 주도 모든 항목을 유지한다', () => {
    const stats = buildWeeklyStats(fixture(), 'kid2', weekRange('2026-09-21'));
    expect(stats.attendance).toEqual({ completedDays: 0, streak: 0, stars: null, coupons: 0 });
    expect(stats.math).toMatchObject({ solved: 0, accuracy: null, storyAccuracy: null, levelStart: null, levelEnd: null });
    expect(stats.talk.sessions).toBe(0); expect(stats.play.bingoBest).toBeUndefined();
    expect(reportText(stats)).toContain('기록 없음'); expect(reportText(stats)).toContain('자유 놀이');
  });
  it('지난 날의 문제 본문 없이도 집계하며 옛 기록의 문제 수만 있으면 정답률을 추측하지 않는다', () => {
    const state = defaultState(), day = emptyDay('2026-10-05');
    day.progress.math = 5; state.data.kid1.days[day.date] = day;
    expect(buildWeeklyStats(state, 'kid1', weekRange(day.date)).math).toMatchObject({ solved: 5, accuracy: null, currentLevel: 4 });
    day.mathAttempts = [{ skill: 'g5-mixed', correct: true, guessed: false, activeMs: 10 }];
    expect(buildWeeklyStats(state, 'kid1', weekRange(day.date)).math).toMatchObject({ solved: 1, accuracy: 100 });
  });
  it('대화 요약은 최대 세 개이고 신고 표시가 있는 기록은 제외한다', () => {
    const state = fixture(); state.data.kid2.talks[3].flagged = true;
    expect(buildWeeklyStats(state, 'kid2', weekRange('2026-10-08')).talk.highlights).toEqual(['한 줄 2', '한 줄 1']);
  });
  it('계산·비교·복사·전송 준비가 학습 기록·별·쿠폰·미션을 바꾸지 않는다', () => {
    const state = fixture(), before = structuredClone(state);
    function freeze(value: unknown): void { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } }
    freeze(state);
    const cur = buildWeeklyStats(state, 'kid2', weekRange('2026-10-08')), prev = buildWeeklyStats(state, 'kid2', weekRange('2026-10-08', -1));
    compareStats(cur, prev); reportText(cur); weeklyReportRequest(cur, 'g3');
    expect(state).toEqual(before);
  });
});
describe('비교와 복사·전송 문구', () => {
  it('늘음·줄음·같음·없음을 구분한다', () => {
    const cur = buildWeeklyStats(fixture(), 'kid2', weekRange('2026-10-08')), prev = structuredClone(cur);
    prev.math.solved = 20; prev.talk.sessions = 1; prev.math.accuracy = null;
    expect(compareStats(cur, prev)).toMatchObject({ mathSolved: 'down', talkSessions: 'up', completedDays: 'same', mathAccuracy: 'none', stars: 'none' });
    const empty = buildWeeklyStats(defaultState(), 'kid1', weekRange('2026-10-08'));
    expect(compareStats(empty, empty).mathSolved).toBe('none');
  });
  it('전주 기록이 전혀 없으면 현재 숫자가 있어도 모든 화살표를 숨긴다', () => {
    const state = fixture(), range = weekRange('2026-10-08');
    const cur = buildWeeklyStats(state, 'kid2', range);
    const prev = buildWeeklyStats(defaultState(), 'kid2', weekRange(range.start, -1));
    expect(cur.hasRecords).toBe(true); expect(prev.hasRecords).toBe(false);
    expect(Object.values(compareStats(cur, prev)).every(value => value === 'none')).toBe(true);
    expect(Object.values(compareStats(prev, cur)).every(value => value === 'none')).toBe(true);
  });
  it('전주에 0문제인 학습일 기록이 있으면 0과 기록 없음을 구분해 비교한다', () => {
    const state = defaultState(); state.data.kid2.days['2026-10-04'] = emptyDay('2026-10-04');
    state.data.kid2.days['2026-10-05'] = { ...emptyDay('2026-10-05'), completed: true, mathBySkill: { 'g3-add3': { correct: 4, total: 5 } } };
    const cur = buildWeeklyStats(state, 'kid2', weekRange('2026-10-05'));
    const prev = buildWeeklyStats(state, 'kid2', weekRange('2026-10-05', -1));
    expect(prev.hasRecords).toBe(true); expect(prev.math.solved).toBe(0);
    expect(compareStats(cur, prev)).toMatchObject({ mathSolved: 'up', completedDays: 'up', mathAccuracy: 'none' });
  });
  it.each(['talk', 'bingo', 'game', 'puzzle', 'puzzleDaily', 'science', 'coupon', 'level'])('학습일 없이 %s 기록만 있어도 기록이 있는 주로 처리한다', kind => {
    const state = defaultState(), data = state.data.kid2, date = '2026-10-04';
    if (kind === 'talk') data.talks = [{ id: 't', date, seconds: 0, englishRatio: 0, lines: [] }];
    if (kind === 'bingo') data.bingo!.recent = [{ date, level: 'g3', limitSec: 120, found: 0, bingos: 0, hints: 0 }];
    if (kind === 'game') data.games = [{ date, game: 'fishing', score: 0 }];
    if (kind === 'puzzle') data.puzzles!.recent = [{ date, type: 'train', difficulty: 1, correct: false, hinted: false, activeSec: 0 }];
    if (kind === 'puzzleDaily') data.puzzles!.daily = [{ date, total: 1, solved: 0, hinted: 0, activeSec: 0 }];
    if (kind === 'science') data.science.collected[SCIENCE_QUESTIONS[0].id] = date;
    if (kind === 'coupon') data.coupons = [{ id: 'c', label: '쿠폰', earnedAt: date }];
    if (kind === 'level') data.math.history = [{ date, level: 2, counted: 0, correct: 0, guesses: 0, medianSec: 0 }];
    const prev = buildWeeklyStats(state, 'kid2', weekRange('2026-10-05', -1));
    expect(prev.hasRecords).toBe(true);
    const cur = buildWeeklyStats(fixture(), 'kid2', weekRange('2026-10-05'));
    expect(compareStats(cur, prev).mathSolved).toBe('up');
  });
  it('기간 밖의 레벨·누적 별·이야기 기록은 해당 주의 기록 존재로 추정하지 않는다', () => {
    const state = fixture();
    const stats = buildWeeklyStats(state, 'kid2', weekRange('2026-11-02'));
    expect(stats.math.levelEnd).toBe(5); expect(stats.hasRecords).toBe(false);
  });
  it('프로필 이름과 AI 결과를 복사 텍스트에 넣고 원문은 포함하지 않는다', () => {
    const stats = buildWeeklyStats(fixture(), 'kid2', weekRange('2026-10-08'));
    const text = reportText(stats, { goodKo: '잘한 점', watchKo: '살펴볼 점', nextKo: '다음 제안', createdAt: '2026-10-08T00:00:00Z' }, '토끼 친구');
    expect(text).toContain('토끼 친구 · 주간'); expect(text).toContain('잘한 점: 잘한 점'); expect(text).toContain('기록 없음');
    expect(text).not.toContain('PRIVATE-TALK-RAW');
  });
  it('Worker 요청은 보호자이며 숫자·고정 라벨·학년만 골라 보낸다', () => {
    const stats = buildWeeklyStats(fixture(), 'kid2', weekRange('2026-10-08'));
    Object.assign(stats, { names: 'PRIVATE-NAME', wrongNotes: 'PRIVATE-WRONG', storyAnswers: 'PRIVATE-STORY' });
    Object.assign(stats.math, { problem: 'PRIVATE-PROBLEM' });
    stats.talk.highlights = ['PRIVATE-HIGHLIGHT'];
    const request = weeklyReportRequest(stats, 'g3');
    expect(request).toMatchObject({ profileId: 'parent', level: 'adult', kind: 'weekly-report', input: { level: 'g3', stats: { profileId: 'kid2', talk: { highlights: [] } } } });
    expect(JSON.stringify(request)).not.toContain('PRIVATE');
    expect(request.input.stats).not.toHaveProperty('hasRecords');
  });
});
