import type { AiConfig, GenerateRequest } from './ai';
import { generate } from './ai';
import type { WordProblemInput } from '../content/math/wordProblem';
import { WORD_PROBLEM_TIMEOUT_MS } from '../content/math/wordProblem';

/** 필요한 문장제를 한 번에 요청하고 실패하면 원래 식으로 진행한다. */
export async function requestWordProblems(cfg: AiConfig, profileId: GenerateRequest['profileId'], level: GenerateRequest['level'], items: WordProblemInput[]): Promise<unknown> {
  if (!items.length) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(null); }, WORD_PROBLEM_TIMEOUT_MS);
  });
  try {
    // fetch가 중지를 무시해도 10초 후에는 호출한 곳으로 돌아간다.
    return await Promise.race([generate(cfg, { profileId, level, kind: 'word-problem', input: { items } }, controller.signal).catch(() => null), timeout]);
  } finally { clearTimeout(timer); }
}
