import type { AppState, ProfileData, ProfileId, ScienceData, SrsCard } from '../../types';
import { SCIENCE_QUESTIONS, SCIENCE_QUESTION_MAP, type ScienceQuestion } from './questions';
import { SCIENCE_CARDS, SCIENCE_CARD_MAP } from './experiments';
import { SCIENCE_UNITS, type ScienceUnit } from './units';
import { applyProgress, ensureDay } from '../../lib/progress';
import { aiReady } from '../../lib/talk';
import { BOX_INTERVALS, pickSessionKeys, reviewCard } from '../../lib/srs';
import { addDays, lastNDays, toDateKey, parseDateKey } from '../../lib/date';

export const OTHER_OBSERVATIONS = ['다르게 관찰했어요', '관찰이 어려웠어요'];
export function questionsFor(level: 'g3' | 'g5'): ScienceQuestion[] {
  return SCIENCE_QUESTIONS.filter(q => q.audience === 'both' || q.audience === level);
}
/** reviewCard의 예정일 = 마지막 풀이일 + 현재 상자 간격. 기존 저장 기록에도 적용한다. */
function answeredToday(card: SrsCard | undefined, today: string): boolean {
  return !!card && Number.isInteger(card.box) && card.box >= 1 && card.box <= BOX_INTERVALS.length &&
    card.due === addDays(today, BOX_INTERVALS[card.box - 1]);
}
export function pickScienceSession(level: 'g3' | 'g5', srs: Record<string, SrsCard>, today: string, count: number): ScienceQuestion[] {
  // 예정 복습 → 새 문제 → 낮은 상자의 연습으로 채우되, 오늘 푼 문제와 아직 복습일 전인 오답은 제외한다.
  const available = questionsFor(level).filter(q => {
    const card = srs[`sci:${q.id}`];
    return !answeredToday(card, today) && !(card && card.box === 1 && card.lapses > 0 && card.due > today);
  });
  return pickSessionKeys(available.map(q => `sci:${q.id}`), srs, today, count).map(key => SCIENCE_QUESTION_MAP[key.slice(4)]);
}
export function gradeAnswer(q: ScienceQuestion, chosen: number): boolean {
  return Number.isInteger(chosen) && chosen >= 0 && chosen < q.choices.length && chosen === q.answer;
}
export function newBadges(collected: Record<string, string>, owned: string[]): string[] {
  return (Object.keys(SCIENCE_UNITS) as ScienceUnit[]).flatMap(unit => {
    const group = SCIENCE_QUESTIONS.filter(q => q.unit === unit);
    const count = group.filter(q => Object.hasOwn(collected, q.id)).length;
    return [5, 10, 'all' as const].filter(n => n === 'all' ? group.length > 0 && count === group.length : count >= n)
      .map(n => `${unit}:${n}`).filter(id => !owned.includes(id));
  });
}
export function recordScienceAnswer(state: AppState, profileId: ProfileId, id: string, chosen: number, date: string): boolean {
  const profile = state.profiles.find(p => p.id === profileId), q = SCIENCE_QUESTION_MAP[id];
  if (!q || !profile || profile.level === 'adult' || (q.audience !== 'both' && q.audience !== profile.level) ||
    !Number.isInteger(chosen) || chosen < 0 || chosen >= q.choices.length) return false;
  const data = state.data[profileId], correct = gradeAnswer(q, chosen);
  // 새로고침·중복 요청에도 같은 날 같은 문제로 진행과 별을 중복 지급하지 않는다.
  if (answeredToday(data.srs[`sci:${id}`], date)) return false;
  data.srs[`sci:${id}`] = reviewCard(data.srs[`sci:${id}`], correct, date);
  if (correct) {
    data.science.collected[id] ??= date;
    data.science.badges.push(...newBadges(data.science.collected, data.science.badges));
  } else data.science.recentWrong = [{ id, chosen, date }, ...data.science.recentWrong].slice(0, 30);
  const day = ensureDay(data, date);
  const stat = (day.science ??= { correct: 0, total: 0, units: [] });
  stat.correct += Number(correct);
  stat.total++;
  if (!stat.units.includes(q.unit)) stat.units.push(q.unit);
  applyProgress(data, state.settings[profileId], date, { type: 'science', correct: Number(correct), total: 1 }, { aiReady: aiReady(state.ai), profileId });
  return true;
}
/** 선택 실험은 첫 완료에만 별 1개. 미션·정답률·쿠폰·연속일을 건드리지 않는다. */
export function recordExperiment(state: AppState, profileId: ProfileId, id: string, date: string, predicted: string, observed: string): boolean {
  const card = Object.hasOwn(SCIENCE_CARD_MAP, id) ? SCIENCE_CARD_MAP[id] : undefined, profile = state.profiles.find(p => p.id === profileId);
  if (!card || !profile || profile.level === 'adult' || (card.audience !== 'both' && card.audience !== profile.level) ||
    !card.predictions.includes(predicted) || ![...card.predictions, ...OTHER_OBSERVATIONS].includes(observed)) return false;
  const data = state.data[profileId];
  if (Object.hasOwn(data.science.experiments, id)) return false;
  data.science.experiments[id] = { date, predicted, observed };
  applyProgress(data, state.settings[profileId], date, { type: 'science', stars: 1, rewardOnly: true }, { aiReady: aiReady(state.ai), profileId });
  return true;
}
export function scienceSummary(data: ProfileData, today: string) {
  const week = lastNDays(7, today).map(date => data.days[date]?.science);
  const correct = week.reduce((n, s) => n + (s?.correct ?? 0), 0), total = week.reduce((n, s) => n + (s?.total ?? 0), 0);
  const counts = new Map<string, { id: string; chosen: number; count: number; date: string }>();
  for (const row of data.science.recentWrong) {
    const previous = counts.get(row.id);
    if (previous) {
      previous.count++;
      if (row.date > previous.date) { previous.chosen = row.chosen; previous.date = row.date; }
    } else counts.set(row.id, { ...row, count: 1 });
  }
  return { correct, total, frequentWrong: [...counts.values()].sort((a, b) => b.count - a.count || b.date.localeCompare(a.date)).slice(0, 5) };
}
/** 오늘 풀어 본 단원 이름만 데이터 칩으로 보낸다. 문제·정답·실험 관찰은 보내지 않는다. */
export function scienceTalkTopics(data: ProfileData, date: string): string[] {
  return [...new Set((data.days[date]?.science?.units ?? []).map(unit => SCIENCE_UNITS[unit as ScienceUnit]?.title).filter(Boolean))]
    .map(title => `오늘 과학: ${title}`.slice(0, 40));
}
function object(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}
function validId(id: string): boolean { return !!id.trim() && !['__proto__', 'constructor', 'prototype'].includes(id); }
function validDate(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) && toDateKey(parseDateKey(raw)) === raw;
}
export function normalizeScience(raw: unknown): ScienceData {
  const source = object(raw), collected: ScienceData['collected'] = {}, experiments: ScienceData['experiments'] = {};
  for (const [id, date] of Object.entries(object(source.collected))) if (validId(id) && validDate(date)) collected[id] = date;
  // 혼합 기록에서는 새 형식이 우선이고, 손상된 새 항목으로 유효한 옛 기록을 덮지 않는다.
  for (const [kind, entries] of [['done', source.done], ['experiments', source.experiments]] as const) for (const [id, rawRow] of Object.entries(object(entries))) {
    const row = object(rawRow);
    if (kind === 'done' && (typeof row.predicted !== 'string' || typeof row.observed !== 'string')) continue;
    if (!validId(id) || !validDate(row.date) || (row.predicted !== undefined && typeof row.predicted !== 'string') ||
      (row.observed !== undefined && typeof row.observed !== 'string')) continue;
    experiments[id] = { date: row.date,
      ...(typeof row.predicted === 'string' ? { predicted: row.predicted.slice(0, 300) } : {}),
      ...(typeof row.observed === 'string' ? { observed: row.observed.slice(0, 300) } : {}) };
  }
  const recentWrong: ScienceData['recentWrong'] = [];
  if (Array.isArray(source.recentWrong)) for (const rawRow of source.recentWrong) {
    const row = object(rawRow);
    if (typeof row.id !== 'string' || !validId(row.id) || !validDate(row.date) || typeof row.chosen !== 'number' ||
      !Number.isSafeInteger(row.chosen) || row.chosen < 0 || (SCIENCE_QUESTION_MAP[row.id] && row.chosen >= SCIENCE_QUESTION_MAP[row.id].choices.length)) continue;
    recentWrong.push({ id: row.id, chosen: row.chosen, date: row.date });
  }
  return { collected, experiments, badges: newBadges(collected, []), recentWrong: recentWrong.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30) };
}
export function normalizeScienceDay(raw: unknown): NonNullable<ProfileData['days'][string]['science']> | undefined {
  const row = object(raw);
  if (typeof row.correct !== 'number' || typeof row.total !== 'number' || !Number.isSafeInteger(row.correct) || !Number.isSafeInteger(row.total) ||
    row.correct < 0 || row.total < row.correct) return undefined;
  return { correct: row.correct, total: row.total, units: Array.isArray(row.units) ? [...new Set(row.units.filter((s): s is string => typeof s === 'string'))] : [] };
}
export function experimentsFor(level: 'g3' | 'g5') {
  return SCIENCE_CARDS.filter(card => card.audience === 'both' || card.audience === level);
}
