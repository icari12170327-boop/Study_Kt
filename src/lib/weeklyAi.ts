import type { WeeklyAi, WeeklyAiText } from '../../shared/weeklyReport';
import type { AiConfig } from '../../shared/ai';
import type { ProfileData } from '../types';
import { addDays, toDateKey } from './date';
import { validReportDate, weeklyReportRequest, weekRange, type WeeklyStats } from './weeklyReport';
import { AiError, generate } from './ai';

export function isWeeklyAiText(raw: unknown): raw is WeeklyAiText {
  return !!raw && typeof raw === 'object' && ['goodKo', 'watchKo', 'nextKo'].every(key => {
    const value = (raw as Record<string, unknown>)[key];
    return typeof value === 'string' && !!value.trim() && value.length <= 300;
  });
}
export function normalizeWeeklyAi(raw: unknown, today = toDateKey()): Record<string, WeeklyAi> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const current = weekRange(today).start, oldest = addDays(current, -77);
  return Object.fromEntries(Object.entries(raw).filter(([week, ai]) => validReportDate(week) && weekRange(week).start === week && week >= oldest && week <= current && isWeeklyAiText(ai) &&
    'createdAt' in ai && typeof ai.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(ai.createdAt) && validReportDate(ai.createdAt.slice(0, 10)) && Number.isFinite(Date.parse(ai.createdAt)))
    .sort(([a], [b]) => b.localeCompare(a)).slice(0, 12).map(([week, raw]) => {
      const ai = raw as WeeklyAi;
      return [week, { goodKo: ai.goodKo, watchKo: ai.watchKo, nextKo: ai.nextKo, createdAt: ai.createdAt }];
    }));
}
/** 보고서 계산은 읽기 전용이며, 명시적으로 요청한 AI 결과만 이 필드에 저장한다. */
export function saveWeeklyAi(data: ProfileData, week: string, ai: WeeklyAi, today = toDateKey()): void {
  data.weeklyAi = normalizeWeeklyAi({ ...data.weeklyAi, [week]: ai }, today);
}
export async function requestWeeklyAi(config: AiConfig, stats: WeeklyStats, level: 'g3' | 'g5', signal?: AbortSignal): Promise<WeeklyAi> {
  const result = await generate(config, weeklyReportRequest(stats, level), signal);
  if (!isWeeklyAiText(result)) throw new AiError('server');
  return { goodKo: result.goodKo, watchKo: result.watchKo, nextKo: result.nextKo, createdAt: new Date().toISOString() };
}
