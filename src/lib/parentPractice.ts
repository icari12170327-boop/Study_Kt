import type { ProfileData, RetellAttempt, TalkLog } from '../types';
import { CHUNK_MAP } from '../content/talk/chunks';
import { expressionKey } from './talkPreview';
import { buildTalkGrowth, practiceTargets, normalizeGrowth } from './talkGrowth';
import { updateRetrieval } from './retrieval';
export function normalizePracticeFields(log: TalkLog): Partial<TalkLog> {
  const previewChunks = Array.isArray(log.previewChunks) ? [...new Set(log.previewChunks.filter(id => CHUNK_MAP.has(id)))].slice(0, 3) : undefined;
  const retrievalApplied = Array.isArray(log.retrievalApplied) ? [...new Set(log.retrievalApplied.filter(text => typeof text === 'string' && !!expressionKey(text) && text.length <= 160))].slice(0, 8) : undefined;
  const retells: RetellAttempt[] | undefined = Array.isArray(log.retells) ? [] : undefined;
  for (let i = 0; i < (retells ? Math.min(2, log.retells!.length) : 0); i++) {
    const attempt = log.retells![i];
    if (!attempt || typeof attempt.text !== 'string' || attempt.text.length > 6000 || attempt.limit !== (i === 0 ? 120 : 90) || typeof attempt.seconds !== 'number' || !Number.isFinite(attempt.seconds) || attempt.seconds <= 0 || attempt.seconds > attempt.limit) break;
    retells!.push({ text: attempt.text, seconds: attempt.seconds, limit: attempt.limit });
  }
  const growth = normalizeGrowth(log.growth);
  return { ...(previewChunks ? { previewChunks } : {}), ...(retrievalApplied ? { retrievalApplied } : {}), ...(retells ? { retells } : {}), ...(growth ? { growth } : {}) };
}
/** 같은 대화에서 성공한 표현을 다시 말해도 두 번 올리지 않는다. 저장하지 않은 교정은 자동 등록하지 않는다. */
export function recordRetell(data: ProfileData, logId: string, attempt: RetellAttempt, today: string): void {
  const log = data.talks.find(row => row.id === logId);
  if (!log?.growth || (log.retells?.length ?? 0) >= 2) return;
  const expected = log.retells?.length ? 90 : 120;
  if (!normalizePracticeFields({ ...log, retells: [ ...(log.retells ?? []), attempt ] }).retells?.some((value, i) => i === (log.retells?.length ?? 0) && value.limit === expected)) return;
  const applied = new Set((log.retrievalApplied ?? []).map(expressionKey));
  const keys = new Set([...practiceTargets(log).map(item => expressionKey(item.text)), ...(log.reviewResult?.targets ?? []).map(expressionKey)]);
  const targets = (data.retrieval ?? []).filter(item => keys.has(expressionKey(item.text)) && !applied.has(expressionKey(item.text)));
  const result = updateRetrieval(data.retrieval ?? [], targets, [attempt.text], today, false);
  data.retrieval = result.items;
  log.retrievalApplied = [...(log.retrievalApplied ?? []), ...result.result.reused];
  log.retells = [...(log.retells ?? []), { ...attempt }];
  log.growth = buildTalkGrowth(log);
}
