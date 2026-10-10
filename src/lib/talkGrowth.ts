import type { TalkGrowth, TalkLog, RetrievalItem } from '../types';
import { CHUNK_MAP } from '../content/talk/chunks';
import { updateRetrieval, validRetrievalDate } from './retrieval';
import { expressionKey } from './talkPreview';
import { weekRange, type WeekRange } from './weeklyReport';
export const englishWordCount = (text: string): number => (text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? []).length;
const ratio = (n: number, d: number) => d > 0 ? n / d : null;
export function practiceTargets(log: TalkLog): RetrievalItem[] {
  const expressions = [...(log.corrections?.items ?? []).map(item => ({ text: item.better, focus: item.focus })), ...(log.previewChunks ?? []).flatMap(id => { const chunk = CHUNK_MAP.get(id); return chunk ? [{ text: chunk.en }] : []; })];
  const seen = new Set<string>();
  return expressions.filter(item => { const key = expressionKey(item.text); if (seen.has(key)) return false; seen.add(key); return true; }).map((item, i) => ({ ...item, id: `metric-${i}`, mode: log.mode === 'coach' ? 'coach' : 'biz', source: 'correction', stage: 0, misses: 0, dueDate: log.date, createdAt: log.date }));
}
/** 저장된 원문에서 수치만 계산한다. 시도가 없으면 성공률 0으로 보지 않는다. */
export function buildTalkGrowth(log: TalkLog): TalkGrowth {
  const user = log.lines.filter(line => line.role === 'kid').map(line => line.text), english = user.filter(text => englishWordCount(text) > 0);
  const sentences = english.flatMap(text => text.split(/[.!?]+/)).filter(text => englishWordCount(text) > 0).length;
  const corrections = log.corrections?.items, tried = corrections?.filter(item => item.selfFixed !== undefined) ?? [];
  const retells = log.retells ?? [], seconds = retells.reduce((n, attempt) => n + attempt.seconds, 0);
  const targets = practiceTargets(log);
  const reused = updateRetrieval([], targets, [...user, ...retells.map(attempt => attempt.text)], log.date, false).result.reused.length;
  return { averageEnglishWords: ratio(english.reduce((n, text) => n + englishWordCount(text), 0), english.length), retellWordsPerMinute: ratio(retells.reduce((n, attempt) => n + englishWordCount(attempt.text), 0) * 60, seconds), correctionRate: corrections ? ratio(corrections.length, sentences) : null, selfFixedRate: ratio(tried.filter(item => item.selfFixed).length, tried.length), englishRatio: log.englishRatio, reuseRate: ratio(reused, targets.length) };
}
export const GROWTH_METRICS = [
  { key: 'averageEnglishWords', label: '발화당 평균 영어 단어', unit: '단어', scale: 20 },
  { key: 'retellWordsPerMinute', label: '다시 말하기의 분당 단어', unit: '단어/분', scale: 60 },
  { key: 'correctionRate', label: '영어 문장당 교정', unit: '개/문장', scale: 1 },
  { key: 'selfFixedRate', label: '먼저 고쳐 보기 성공률', unit: '%', scale: 1 },
  { key: 'englishRatio', label: '영어 비율', unit: '%', scale: 1 },
  { key: 'reuseRate', label: '표현 다시 쓰기 성공률', unit: '%', scale: 1 },
] as const;
const emptyGrowth = (): TalkGrowth => ({ averageEnglishWords: null, retellWordsPerMinute: null, correctionRate: null, selfFixedRate: null, englishRatio: null, reuseRate: null });
export function parentWeeklyGrowth(logs: readonly TalkLog[], range: WeekRange): TalkGrowth {
  const selected = logs.filter(log => validRetrievalDate(log.date) && log.date >= range.start && log.date <= range.end && log.growth);
  const result = emptyGrowth();
  for (const { key } of GROWTH_METRICS) {
    const values = selected.map(log => log.growth![key]).filter((value): value is number => value !== null);
    result[key] = ratio(values.reduce((n, value) => n + value, 0), values.length);
  }
  return result;
}
export function parentGrowthWeeks(logs: readonly TalkLog[], date: string, offset = 0) {
  return Array.from({ length: 4 }, (_, i) => { const range = weekRange(date, offset + i - 3); return { range, stats: parentWeeklyGrowth(logs, range) }; });
}
export function normalizeGrowth(raw: unknown): TalkGrowth | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const row = raw as Record<string, unknown>;
  const limits = { averageEnglishWords: 2000, retellWordsPerMinute: 3600000, correctionRate: 3, selfFixedRate: 1, englishRatio: 1, reuseRate: 1 };
  const result = emptyGrowth();
  for (const { key } of GROWTH_METRICS) {
    const value = row[key];
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > limits[key])) return undefined;
    result[key] = value;
  }
  return result;
}
