import type { Level, QaCard } from '../types';

export type QuizType = 'fact' | 'why' | 'apply';
export interface QuizCandidate { id: string; q: string; a: string; type: QuizType; checked: boolean }
export interface QuizResponse { cards: { q: string; a: string; type: QuizType }[] }
export const quizCount = (level: Level): number => level === 'adult' ? 5 : level === 'g5' ? 4 : 3;
export function quizReadiness({ aiReady, title, summary }: { aiReady: boolean; title: string; summary: string }): { ok: true } | { ok: false; reason: string } {
  if (!aiReady) return { ok: false, reason: '보호자 모드에서 AI 연결을 설정해 주세요.' };
  if (!title.trim()) return { ok: false, reason: '제목을 먼저 써 주세요.' };
  if (summary.trim().length < 40) return { ok: false, reason: `요약을 ${40 - summary.trim().length}자 더 쓰면 만들 수 있어요.` };
  if (title.trim().length > 200) return { ok: false, reason: '제목을 200자 이내로 줄여 주세요.' };
  if (summary.trim().length > 8000) return { ok: false, reason: '요약을 8000자 이내로 줄여 주세요.' };
  return { ok: true };
}
const questionKey = (text: string): string => text.trim().replace(/\s+/g, ' ').replace(/[?？.]+$/, '').trim().toLocaleLowerCase('en-US');
export const sameQuestion = (a: string, b: string): boolean => questionKey(a) === questionKey(b);
export function toCandidates(existing: readonly QaCard[], cards: Readonly<QuizResponse['cards']>, count: number, makeId: () => string): QuizCandidate[] {
  const result: QuizCandidate[] = [], seen = new Set(existing.map(card => questionKey(card.q)));
  const max = Math.max(0, Math.min(10, Number.isFinite(count) ? Math.floor(count) : 0));
  for (const card of cards) {
    const q = card.q.trim(), a = card.a.trim(), key = questionKey(q);
    if (!q || !a || !key || seen.has(key) || result.length >= max) continue;
    seen.add(key); result.push({ id: makeId(), q, a, type: card.type, checked: true });
  }
  return result;
}
export function mergeCandidates(cards: readonly QaCard[], candidates: readonly QuizCandidate[]): QaCard[] {
  const base = cards.length === 1 && !cards[0].q.trim() && !cards[0].a.trim() ? [] : [...cards];
  const seen = new Set(base.map(card => questionKey(card.q)));
  const chosen = candidates.filter(card => card.checked).flatMap(card => {
    const q = card.q.trim(), a = card.a.trim(), key = questionKey(q);
    if (!q || !a || !key || seen.has(key)) return [];
    seen.add(key); return [{ id: card.id, q, a }];
  });
  // 추가할 후보가 없으면 빈 수동 입력칸도 그대로 남긴다.
  return chosen.length ? [...base, ...chosen] : [...cards];
}
export function isQuizResponse(raw: unknown): raw is QuizResponse {
  if (!raw || typeof raw !== 'object' || !('cards' in raw) || !Array.isArray(raw.cards) || raw.cards.length < 1 || raw.cards.length > 10) return false;
  return raw.cards.every(card => card && typeof card === 'object' &&
    typeof card.q === 'string' && card.q.length <= 500 && typeof card.a === 'string' && card.a.length <= 500 &&
    ['fact', 'why', 'apply'].includes(card.type));
}
export function normalizeReadingQuiz(raw: unknown): { enabled: boolean } {
  return { enabled: !!raw && typeof raw === 'object' && 'enabled' in raw && typeof raw.enabled === 'boolean' ? raw.enabled : true };
}
