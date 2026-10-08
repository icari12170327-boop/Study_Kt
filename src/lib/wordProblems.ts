import type { AiConfig, GenerateRequest } from './ai';
import { generate } from './ai';
import type { WordProblemInput } from '../content/math/wordProblem';
import { WORD_PROBLEM_TIMEOUT_MS } from '../content/math/wordProblem';

/** 必要な文を一回だけまとめて頼む。失敗は待たせず元の式に任せる。 */
export async function requestWordProblems(cfg: AiConfig, profileId: GenerateRequest['profileId'], level: GenerateRequest['level'], items: WordProblemInput[]): Promise<unknown> {
  if (!items.length) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(null); }, WORD_PROBLEM_TIMEOUT_MS);
  });
  try {
    // fetch が中止を無視する環境でも10秒後には呼び出し元へ戻る。
    return await Promise.race([generate(cfg, { profileId, level, kind: 'word-problem', input: { items } }, controller.signal).catch(() => null), timeout]);
  } finally { clearTimeout(timer); }
}
