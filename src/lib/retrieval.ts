import type { RetrievalItem, ReviewResult } from '../types';
import { addDays, parseDateKey, toDateKey } from './date';
import { normalizeWords, scoreSpeech } from './similarity';

export const validRetrievalDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateKey(parseDateKey(value)) === value;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
/** 날짜 없는 값이나 손상된 항목은 추정하지 않는다. 익힘 완료 30일 뒤 정리한다. */
export function normalizeRetrieval(raw: unknown, today: string): RetrievalItem[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>(), phrases = new Set<string>(), result: RetrievalItem[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Partial<RetrievalItem>;
    if (typeof row.text !== 'string') continue;
    const key = normalizeWords(row.text).join(' ');
    if (!key || !text(row.id, 100) || !text(row.text, 160) || !['correction', 'preview'].includes(row.source ?? '') || !['coach', 'biz'].includes(row.mode ?? '') ||
      ![0, 1, 2, 3].includes(row.stage ?? -1) || !Number.isSafeInteger(row.misses) || row.misses! < 0 || !validRetrievalDate(row.createdAt) || !validRetrievalDate(row.dueDate) ||
      (row.learnedAt !== undefined && (!validRetrievalDate(row.learnedAt) || row.stage !== 3 || row.learnedAt < row.createdAt)) || ids.has(row.id) || phrases.has(key)) continue;
    if (row.learnedAt && addDays(row.learnedAt, 30) <= today) continue;
    ids.add(row.id); phrases.add(key);
    result.push({ id: row.id, text: row.text.trim(), ...(text(row.focus, 40) && normalizeWords(row.focus).length && row.text.trim().includes(row.focus.trim()) ? { focus: row.focus.trim() } : {}), source: row.source!, mode: row.mode!, stage: row.stage!, dueDate: row.dueDate, misses: row.misses!, createdAt: row.createdAt, ...(row.learnedAt ? { learnedAt: row.learnedAt } : {}) });
  }
  return result.slice(-60);
}
export function pickReviewTargets(items: readonly RetrievalItem[], today: string, mode?: RetrievalItem['mode']): RetrievalItem[] {
  return items.filter(item => !item.learnedAt && item.dueDate <= today)
    .sort((a, b) => Number(b.mode === mode) - Number(a.mode === mode) || a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(0, 2).map(item => ({ ...item }));
}
/** 목표 표현의 단어를 연속해서 직접 말한 경우만 성공으로 기록한다. */
export function reusedExpression(target: string, userLines: readonly string[]): boolean {
  const words = normalizeWords(target);
  if (!words.length) return false;
  return userLines.some(line => {
    const spoken = normalizeWords(line);
    return spoken.some((_, start) => {
      const part = spoken.slice(start, start + words.length);
      return part.length === words.length && scoreSpeech(words.join(' '), part.join(' ')).score === 1;
    });
  });
}

// 관사·전치사 같은 한 단어 기능어는 다른 문장에서도 우연히 나오므로 전체 문장을 확인한다.
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'from', 'with', 'without', 'as', 'about', 'into', 'onto', 'over', 'under', 'between', 'through', 'during', 'before', 'after', 'since', 'until',
  'and', 'or', 'but', 'so', 'if', 'because', 'although', 'while', 'than',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'not',
]);

function retrievalExpression(item: RetrievalItem): string {
  const words = normalizeWords(item.focus ?? '');
  return words.length === 1 && FUNCTION_WORDS.has(words[0]) ? item.text : item.focus ?? item.text;
}

export function updateRetrieval(items: readonly RetrievalItem[], targets: readonly RetrievalItem[], userLines: readonly string[], today: string, countMisses = true): { items: RetrievalItem[]; result: ReviewResult } {
  const reused = targets.filter(item => reusedExpression(retrievalExpression(item), userLines));
  const targetIds = new Set(targets.map(item => item.id)), successIds = new Set(reused.map(item => item.id));
  return { result: { targets: targets.map(item => item.text), reused: reused.map(item => item.text) }, items: items.map(item => {
    if (!targetIds.has(item.id) || item.learnedAt) return { ...item };
    if (successIds.has(item.id)) return item.stage === 3 ? { ...item, misses: 0, learnedAt: today } : { ...item, stage: (item.stage + 1) as RetrievalItem['stage'], misses: 0, dueDate: addDays(today, [1, 3, 7][item.stage]) };
    if (!countMisses) return { ...item };
    const misses = item.misses + 1;
    return { ...item, misses, dueDate: addDays(today, misses >= 3 ? 7 : 1) };
  }) };
}
export function addCorrectionTarget(items: readonly RetrievalItem[], text: string, mode: RetrievalItem['mode'], today: string, id: string, focus?: string): RetrievalItem[] {
  const normalized = normalizeRetrieval(items, today);
  const existing = normalized.find(item => normalizeWords(item.text).join(' ') === normalizeWords(text).join(' '));
  if (existing) return normalizeRetrieval(normalized.map(item => item.id === existing.id && !item.focus ? { ...item, focus } : item), today);
  return normalizeRetrieval([...normalized, { id, text, ...(focus !== undefined ? { focus } : {}), source: 'correction', mode, stage: 0, dueDate: addDays(today, 1), misses: 0, createdAt: today }], today);
}

/** 너무 짧은 대화에서 못 쓴 표현을 실패로 세지 않는다. 직접 사용 성공은 시간과 무관하다. */
export function reviewOpportunity(seconds: number, userLines: readonly string[]): boolean {
  return seconds >= 120 || userLines.filter(line => /[A-Za-z]/.test(line)).length >= 3;
}
