import type { AiConfig } from '../../shared/ai';
import { filterOpicFeedback } from '../../shared/opic';
import { QUESTION_MAP, TOPIC_NAMES } from '../content/opic/questions';
import { generate, AiError } from './ai';
import { isOpicFeedback, type OpicAttempt, type OpicSettings } from './opic';
export async function requestOpicFeedback(cfg: AiConfig, attempt: OpicAttempt, targetLevel: OpicSettings['targetLevel'], signal: AbortSignal) {
  const q = QUESTION_MAP.get(attempt.questionId)!;
  const result = await generate<unknown>(cfg, { profileId: 'parent', level: 'adult', kind: 'opic-feedback', input: { type: q.type, topic: TOPIC_NAMES[q.topic], question: q.en, transcript: attempt.transcript, durationSec: attempt.durationSec, targetLevel } }, AbortSignal.any([signal, AbortSignal.timeout(55000)]));
  if (!isOpicFeedback(result)) throw new AiError('server');
  return filterOpicFeedback(result, attempt.transcript);
}
