import { CHUNK_MAP, TALK_CHUNKS, type TalkChunk } from '../content/talk/chunks';
import type { RetrievalItem } from '../types';
import { addDays } from './date';
import { normalizeRetrievalWords } from './retrievalWords';
import { shuffle, type Rng } from './random';
import { normalizeRetrieval, updateRetrieval, validRetrievalDate } from './retrieval';
export const expressionKey = (text: string) => normalizeRetrievalWords(text).join(' ');
export function normalizePreviewHistory(raw: unknown, today: string): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([id, date]) => CHUNK_MAP.has(id) && validRetrievalDate(date) && date <= today));
}
/** 같은 날은 같은 세 표현을 쓰고, 최근 5일을 제외한 뒤 오래된 표현부터 고른다. */
export function pickPreviewChunks(group: string, items: readonly RetrievalItem[], history: Readonly<Record<string, string>>, today: string, rng: Rng): TalkChunk[] {
  const dates = normalizePreviewHistory(history, today);
  const candidates = shuffle(TALK_CHUNKS.filter(chunk => chunk.group === group), rng);
  const sameDay = candidates.filter(chunk => dates[chunk.id] === today);
  if (sameDay.length === 3) return sameDay.map(chunk => ({ ...chunk }));
  const lastShown = new Map<string, string>();
  for (const [id, date] of Object.entries(dates)) {
    const key = expressionKey(CHUNK_MAP.get(id)!.en);
    if (!lastShown.has(key) || lastShown.get(key)! < date) lastShown.set(key, date);
  }
  const lastDate = (chunk: TalkChunk) => lastShown.get(expressionKey(chunk.en)) ?? '';
  const existing = new Set(items.map(item => expressionKey(item.text)));
  const oldest = (a: TalkChunk, b: TalkChunk) => lastDate(a).localeCompare(lastDate(b));
  const eligible = candidates.filter(chunk => !lastDate(chunk) || lastDate(chunk) <= addDays(today, -5))
    .sort((a, b) => Number(existing.has(expressionKey(a.en))) - Number(existing.has(expressionKey(b.en))) || oldest(a, b));
  const picked = eligible.slice(0, 3);
  // 목록이 부족해도 중복 없이 세 개를 제공한다. 최근 표현은 가장 오래된 것부터 채운다.
  picked.push(...candidates.filter(chunk => !picked.includes(chunk)).sort(oldest).slice(0, 3 - picked.length));
  return picked.map(chunk => ({ ...chunk }));
}
export function previewRetrieval(items: readonly RetrievalItem[], chunks: readonly TalkChunk[], lines: readonly string[], mode: 'coach' | 'biz', today: string, already: readonly string[] = []): { items: RetrievalItem[]; applied: string[] } {
  let result = normalizeRetrieval(items, today);
  const applied = new Set(already.map(expressionKey));
  const success: string[] = [...already];
  for (const chunk of chunks) {
    const existing = result.find(item => expressionKey(item.text) === expressionKey(chunk.en));
    const target: RetrievalItem = existing ?? { id: `preview-${chunk.id}`, text: chunk.en, source: 'preview', mode, stage: 0, misses: 0, dueDate: addDays(today, 1), createdAt: today };
    const used = updateRetrieval([], [target], lines, today, false).result.reused.length > 0;
    if (!existing) result = [...result, target];
    if (used && !applied.has(expressionKey(target.text))) {
      result = updateRetrieval(result, [target], lines, today, false).items;
      applied.add(expressionKey(target.text)); success.push(target.text);
    }
  }
  return { items: normalizeRetrieval(result, today), applied: success };
}
