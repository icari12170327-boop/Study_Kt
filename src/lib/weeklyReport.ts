import type { AppState, ProfileId } from '../types';
import type { WeekRange, WeeklyAi, WeeklyStats } from '../../shared/weeklyReport';
import { SKILL_MAP } from '../content/math/skills';
import { SCIENCE_QUESTIONS } from '../content/science/questions';
import { badgeLabel } from '../content/science/units';
import { addDays, lastNDays, parseDateKey, toDateKey } from './date';
export type { WeekRange, WeeklyAi, WeeklyStats } from '../../shared/weeklyReport';

export function validReportDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateKey(parseDateKey(value)) === value;
}
/** YYYY-MM-DD와 기존 날짜 유틸만 사용한다. UTC 문자열로 변환하지 않는다. */
export function weekRange(date: string, offset = 0): WeekRange {
  if (!validReportDate(date) || !Number.isInteger(offset)) throw new Error('올바른 날짜와 주 간격이 필요해요.');
  const mondayOffset = (parseDateKey(date).getDay() + 6) % 7;
  const start = addDays(date, -mondayOffset + offset * 7);
  return { start, end: addDays(start, 6) };
}
export function weeklyNoticeDay(date: string): boolean {
  return validReportDate(date) && [0, 1].includes(parseDateKey(date).getDay());
}
const percent = (correct: number, total: number): number | null => total > 0 ? Math.round(correct / total * 100) : null;

/** 기존 보관 기록만 읽는다. 날짜가 없는 누적값을 특정 주의 값으로 추정하지 않는다. */
export function buildWeeklyStats(state: AppState, profileId: ProfileId, range: WeekRange): WeeklyStats {
  if (profileId === 'parent') throw new Error('아이 프로필의 리포트만 만들 수 있어요.');
  if (!validReportDate(range.start) || weekRange(range.start).start !== range.start || range.end !== addDays(range.start, 6)) throw new Error('월요일부터 일요일까지의 범위가 필요해요.');
  const data = state.data[profileId];
  const within = (date: string) => validReportDate(date) && date >= range.start && date <= range.end;
  const days = lastNDays(7, range.end).filter(within).map(date => data.days[date]).filter(Boolean);
  const completedDays = days.filter(day => day.completed).length;
  let streak = 0;
  for (const day of days.filter(day => day.completed)) {
    let count = 0, date = day.date;
    while (data.days[date]?.completed) { count++; date = addDays(date, -1); }
    streak = Math.max(streak, count);
  }
  const attempts = days.flatMap(day => day.mathAttempts ?? []);
  const bySkill: Record<string, { total: number; correct: number }> = {};
  let mathTotal = 0, mathCorrect = 0, mathMeasured = 0;
  for (const day of days) {
    const rows = Object.entries(day.mathBySkill ?? {});
    const recorded = day.mathAttempts ?? [];
    if (rows.length) {
      for (const [skill, row] of rows) {
        mathTotal += row.total; mathMeasured += row.total; mathCorrect += row.correct;
        const stat = bySkill[skill] ??= { total: 0, correct: 0 };
        stat.total += row.total; stat.correct += row.correct;
      }
    } else if (recorded.length) {
      for (const attempt of recorded) {
        mathTotal++; mathMeasured++; mathCorrect += +attempt.correct;
        const stat = bySkill[attempt.skill] ??= { total: 0, correct: 0 };
        stat.total++; stat.correct += +attempt.correct;
      }
    } else mathTotal += day.progress.math ?? 0;
  }
  const history = [...data.math.history].sort((a, b) => a.date.localeCompare(b.date));
  const levelAt = (date: string): number | null => history.filter(row => row.date <= date).at(-1)?.level ?? null;
  const scienceDays = days.flatMap(day => day.science ? [day.science] : []);
  const scienceTotal = scienceDays.reduce((n, day) => n + day.total, 0);
  const newBadges = data.science.badges.filter(id => {
    const [unit, threshold] = id.split(':');
    const group = SCIENCE_QUESTIONS.filter(q => q.unit === unit);
    const dates = group.map(q => data.science.collected[q.id]).filter(validReportDate).sort();
    const count = threshold === 'all' ? group.length : Number(threshold);
    return count > 0 && dates.length >= count && within(dates[count - 1]);
  });
  const talks = data.talks.filter(log => within(log.date));
  const talkDates = new Set([...days.map(day => day.date), ...talks.map(log => log.date)]);
  const talkSeconds = [...talkDates].reduce((sum, date) => sum + Math.max(
    data.days[date]?.talkSeconds ?? (data.days[date]?.progress.talk ?? 0) * 60,
    talks.filter(log => log.date === date).reduce((n, log) => n + log.seconds, 0)), 0);
  const bingo = data.bingo?.recent.filter(row => within(row.date)) ?? [];
  // 오래된 일별 합계가 남아 있으면 최근 100개보다 우선하되 같은 날짜를 중복 세지 않는다.
  const dailyPuzzles = data.puzzles?.daily?.filter(row => within(row.date)) ?? [];
  const dailyDates = new Set(dailyPuzzles.map(row => row.date));
  const recentPuzzles = data.puzzles?.recent.filter(row => within(row.date) && !dailyDates.has(row.date)) ?? [];
  const games = data.games?.filter(row => within(row.date)) ?? [];
  const story = attempts.filter(attempt => attempt.story === true);
  return {
    profileId, range: { ...range },
    attendance: { completedDays, streak, stars: null, coupons: data.coupons.filter(row => within(row.earnedAt)).length },
    math: {
      solved: mathTotal, accuracy: mathMeasured === mathTotal ? percent(mathCorrect, mathMeasured) : null,
      currentLevel: data.math.level, levelStart: levelAt(addDays(range.start, -1)), levelEnd: levelAt(range.end),
      weakSkills: Object.entries(bySkill).filter(([skill, stat]) => SKILL_MAP[skill] && stat.total > 0)
        .map(([skill, stat]) => ({ skill, label: SKILL_MAP[skill].label, accuracy: percent(stat.correct, stat.total)! }))
        .sort((a, b) => a.accuracy - b.accuracy || a.skill.localeCompare(b.skill)).slice(0, 3),
      guesses: attempts.filter(attempt => attempt.story !== true && attempt.guessed).length,
      storyAccuracy: percent(story.filter(attempt => attempt.correct).length, story.length),
    },
    science: {
      solved: scienceTotal, accuracy: percent(scienceDays.reduce((n, day) => n + day.correct, 0), scienceTotal),
      newCards: Object.values(data.science.collected).filter(within).length, newBadges,
    },
    talk: {
      minutes: Math.round(talkSeconds / 60 * 10) / 10, sessions: talks.length,
      highlights: [...talks].sort((a, b) => b.date.localeCompare(a.date)).filter(log => !log.flagged && log.summary?.highlightKo)
        .slice(0, 3).map(log => log.summary!.highlightKo.slice(0, 300)),
    },
    play: {
      bingoGames: bingo.length, ...(bingo.length ? { bingoBest: Math.max(...bingo.map(row => row.found)) } : {}),
      puzzlesSolved: dailyPuzzles.reduce((n, row) => n + row.solved, 0) + recentPuzzles.filter(row => row.correct).length,
      puzzleLevelUps: null, fishing: games.filter(row => row.game === 'fishing').length,
      duels: games.filter(row => row.game === 'duel').length,
      crowns: games.filter(row => row.game === 'duel' && row.won === true).length, storyEpisodes: null,
    },
  };
}

export type ReportTrend = 'up' | 'down' | 'same' | 'none';
export function compareStats(cur: WeeklyStats, prev: WeeklyStats): Record<string, ReportTrend> {
  const metrics = (stats: WeeklyStats): Record<string, number | null> => ({
    completedDays: stats.attendance.completedDays, streak: stats.attendance.streak, stars: stats.attendance.stars, coupons: stats.attendance.coupons,
    mathSolved: stats.math.solved, mathAccuracy: stats.math.accuracy, mathLevel: stats.math.levelEnd, guesses: stats.math.guesses, storyAccuracy: stats.math.storyAccuracy,
    scienceSolved: stats.science.solved, scienceAccuracy: stats.science.accuracy, newCards: stats.science.newCards, newBadges: stats.science.newBadges.length,
    talkMinutes: stats.talk.minutes, talkSessions: stats.talk.sessions, bingoGames: stats.play.bingoGames, bingoBest: stats.play.bingoBest ?? null,
    puzzlesSolved: stats.play.puzzlesSolved, puzzleLevelUps: stats.play.puzzleLevelUps, fishing: stats.play.fishing, duels: stats.play.duels, crowns: stats.play.crowns, storyEpisodes: stats.play.storyEpisodes,
  });
  const before = metrics(prev);
  return Object.fromEntries(Object.entries(metrics(cur)).map(([key, value]) => {
    const previous = before[key];
    return [key, value === null || previous === null || (value === 0 && previous === 0) ? 'none' : value > previous ? 'up' : value < previous ? 'down' : 'same'];
  }));
}
export const reportValue = (value: number | null | undefined, unit = ''): string => value === null || value === undefined ? '기록 없음' : `${value}${unit}`;

export function reportText(stats: WeeklyStats, ai?: WeeklyAi, profileName = stats.profileId === 'kid1' ? '첫째' : '둘째'): string {
  const { attendance: a, math: m, science: s, talk: t, play: p } = stats;
  return [
    `${profileName} · 주간 학습 리포트 (${stats.range.start} ~ ${stats.range.end})`,
    `미션 완료 ${a.completedDays}/7일 · 기간 내 최장 연속 ${a.streak}일 · 받은 별 ${reportValue(a.stars)} · 쿠폰 ${a.coupons}개`,
    `수학 ${m.solved}문제 · 정답률 ${reportValue(m.accuracy, '%')} · 현재 레벨 ${m.currentLevel} · 주 시작/끝 ${reportValue(m.levelStart)} → ${reportValue(m.levelEnd)}`,
    `살펴볼 수학 단원: ${m.weakSkills.length ? m.weakSkills.map(row => `${row.label} ${row.accuracy}%`).join(', ') : '기록 없음'}`,
    `찍기 감지 ${m.guesses}회 · 문장제 정답률 ${reportValue(m.storyAccuracy, '%')}`,
    `과학 ${s.solved}문제 · 정답률 ${reportValue(s.accuracy, '%')} · 새 도감 ${s.newCards}장 · 새 배지 ${s.newBadges.length ? s.newBadges.map(badgeLabel).join(', ') : '기록 없음'}`,
    `영어 대화 ${t.minutes}분 · ${t.sessions}회`, ...t.highlights.map(line => `오늘의 한 줄: ${line}`),
    `자유 놀이: 빙고 ${p.bingoGames}판(최고 ${reportValue(p.bingoBest)}) · 맞힌 퍼즐 ${p.puzzlesSolved}개 · 난이도 변경 ${reportValue(p.puzzleLevelUps)}`,
    `낚시 ${p.fishing}판 · 형제 대결 ${p.duels}판 · 👑 ${p.crowns}회 · 읽은 이야기 ${reportValue(p.storyEpisodes)}`,
    '보관된 기록 기준입니다. 날짜가 없는 별·이야기·퍼즐 난이도 변경은 주간 값으로 추정하지 않습니다.',
    ...(ai ? [`잘한 점: ${ai.goodKo}`, `살펴볼 점: ${ai.watchKo}`, `다음 주 제안: ${ai.nextKo}`] : []),
  ].join('\n');
}

/** 전송 항목을 하나씩 골라 원문·이름·임의의 추가 필드가 섞이지 않게 한다. */
export function weeklyReportRequest(stats: WeeklyStats, level: 'g3' | 'g5') {
  return { profileId: 'parent' as const, level: 'adult' as const, kind: 'weekly-report' as const, input: {
    level, stats: {
      profileId: stats.profileId, range: { start: stats.range.start, end: stats.range.end },
      attendance: { completedDays: stats.attendance.completedDays, streak: stats.attendance.streak, stars: stats.attendance.stars, coupons: stats.attendance.coupons },
      math: { solved: stats.math.solved, accuracy: stats.math.accuracy, currentLevel: stats.math.currentLevel, levelStart: stats.math.levelStart, levelEnd: stats.math.levelEnd,
        weakSkills: stats.math.weakSkills.map(row => ({ skill: row.skill, label: row.label, accuracy: row.accuracy })), guesses: stats.math.guesses, storyAccuracy: stats.math.storyAccuracy },
      science: { solved: stats.science.solved, accuracy: stats.science.accuracy, newCards: stats.science.newCards, newBadges: [...stats.science.newBadges] },
      talk: { minutes: stats.talk.minutes, sessions: stats.talk.sessions, highlights: [] },
      play: { bingoGames: stats.play.bingoGames, ...(stats.play.bingoBest !== undefined ? { bingoBest: stats.play.bingoBest } : {}),
        puzzlesSolved: stats.play.puzzlesSolved, puzzleLevelUps: stats.play.puzzleLevelUps, fishing: stats.play.fishing, duels: stats.play.duels, crowns: stats.play.crowns, storyEpisodes: stats.play.storyEpisodes },
    },
  } };
}
