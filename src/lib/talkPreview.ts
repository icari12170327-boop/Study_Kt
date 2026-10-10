import { CHUNK_MAP, TALK_CHUNKS, type TalkChunk } from '../content/talk/chunks';
import type { RetrievalItem } from '../types';
import { addDays } from './date';
import { normalizeWords } from './similarity';
import { shuffle, type Rng } from './random';
import { normalizeRetrieval, updateRetrieval, validRetrievalDate } from './retrieval';
export const expressionKey = (text: string) => normalizeWords(text).join(' ');
export function normalizePreviewHistory(raw: unknown, today: string): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([id, date]) => CHUNK_MAP.has(id) && validRetrievalDate(date) && date <= today && date > addDays(today, -14)));
}
/** 2주 안에 다시 보여 주지 않고 복습 목록에 없는 표현을 우선한다. */
export function pickPreviewChunks(group: string, items: readonly RetrievalItem[], history: Readonly<Record<string, string>>, today: string, rng: Rng): TalkChunk[] {
  const recent = new Set(Object.entries(normalizePreviewHistory(history, today)).map(([id]) => expressionKey(CHUNK_MAP.get(id)!.en)));
  const existing = new Set(items.map(item => expressionKey(item.text)));
  const candidates = shuffle(TALK_CHUNKS.filter(chunk => chunk.group === group && !recent.has(expressionKey(chunk.en))), rng);
  return [...candidates.filter(chunk => !existing.has(expressionKey(chunk.en))), ...candidates.filter(chunk => existing.has(expressionKey(chunk.en)))].slice(0, 3).map(chunk => ({ ...chunk }));
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
