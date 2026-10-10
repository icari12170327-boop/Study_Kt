import { CORRECTION_PATTERNS, filterCorrections, type Corrections, type CorrectionItem } from '../../shared/corrections';
import type { TalkLog, ReviewResult } from '../types';
import { normalizeWords, scoreSpeech } from './similarity';
import { savePhrase } from './business';
import { addCorrectionTarget, validRetrievalDate } from './retrieval';
export { filterCorrections };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
export function isCorrections(raw: unknown): raw is Corrections {
  const row = object(raw);
  return text(row.praiseKo, 120) && Array.isArray(row.items) && row.items.length <= 3 && row.items.every(value => {
    const item = object(value);
    return text(item.said, 200) && text(item.better, 160) && text(item.focus, 40) && text(item.whyKo, 120) && text(item.hintKo, 80) && CORRECTION_PATTERNS.includes(item.pattern as CorrectionItem['pattern']) && (item.selfFixed === undefined || typeof item.selfFixed === 'boolean');
  });
}
/** 핵심 교정 부분을 빠뜨린 답은 전체 단어가 비슷해도 직접 고침으로 세지 않는다. */
export function selfFixed(item: CorrectionItem, answer: string): boolean {
  const focus = normalizeWords(item.focus).join(' '), words = normalizeWords(answer).join(' ');
  return !!focus && (` ${words} `).includes(` ${focus} `) && scoreSpeech(item.better, answer).score >= 0.8 && scoreSpeech(answer, item.better).score >= 0.8;
}
export function focusParts(better: string, focus: string): [string, string, string] {
  const at = better.indexOf(focus);
  return at < 0 ? [better, '', ''] : [better.slice(0, at), focus, better.slice(at + focus.length)];
}
export function normalizeCorrections(raw: unknown, userLines: string[]): TalkLog['corrections'] {
  if (!isCorrections(raw) || !validRetrievalDate(object(raw).createdAt)) return undefined;
  const result = filterCorrections(raw, userLines);
  return { items: result.items.map(item => ({ said: item.said, better: item.better, focus: item.focus, whyKo: item.whyKo, hintKo: item.hintKo, pattern: item.pattern, ...(item.selfFixed !== undefined ? { selfFixed: item.selfFixed } : {}) })), praiseKo: result.praiseKo, createdAt: object(raw).createdAt as string };
}
export function normalizeReviewResult(raw: unknown): ReviewResult | undefined {
  const row = object(raw);
  if (!Array.isArray(row.targets) || row.targets.length > 2 || !row.targets.every(value => text(value, 160)) || !Array.isArray(row.reused) || row.reused.length > 2 || !row.reused.every(value => text(value, 160) && (row.targets as string[]).includes(value))) return undefined;
  return { targets: [...new Set(row.targets as string[])], reused: [...new Set(row.reused as string[])] };
}
/** 교정 이유를 내 표현의 한국어 설명으로 저장하고, 복습 목록에는 중복 없이 넣는다. */
export function saveCorrection(data: import('../types').ProfileData, item: CorrectionItem, mode: 'coach' | 'biz', today: string, now: number, rng: import('./random').Rng): void {
  if (savePhrase(data, item.better, item.whyKo, '교정', now, rng) === 'invalid') return;
  const card = data.customCards?.find(card => card.en.trim().toLowerCase() === item.better.trim().toLowerCase());
  if (card) data.retrieval = addCorrectionTarget(data.retrieval ?? [], item.better, mode, today, `retr-${card.id}`, item.focus);
}
