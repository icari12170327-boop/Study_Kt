import { useEffect, useRef, useState } from 'react';
import type { AiConfig } from '../lib/ai';
import { aiReady } from '../lib/talk';
import { requestWordProblems } from '../lib/wordProblems';
import { insertWordProblems, planWordProblems, type WordProblemInput } from '../content/math/wordProblem';
import type { QueueItem } from '../content/math/session';
import type { Level, ProfileId } from '../types';

/** 연산은 즉시 시작한다. StrictMode 재실행도 같은 라운드의 요청 한 번을 공유한다. */
export function useWordProblemQueue(base: QueueItem[], index: number, cfg: AiConfig, profileId: ProfileId, level: Level, ratio: unknown, interests: unknown): QueueItem[] {
  const [result, setResult] = useState<{ base: QueueItem[]; queue: QueueItem[] } | null>(null);
  const position = useRef(index); position.current = index;
  const pending = useRef<{ base: QueueItem[]; plan: WordProblemInput[]; promise: Promise<unknown> } | null>(null);
  useEffect(() => {
    if (pending.current?.base !== base) {
      const plan = profileId === 'parent' || level === 'adult' ? [] : planWordProblems(base, ratio, interests, level);
      const online = typeof navigator === 'undefined' || navigator.onLine;
      pending.current = { base, plan, promise: online && aiReady(cfg) && plan.length ? requestWordProblems(cfg, profileId, level, plan) : Promise.resolve(null) };
    }
    const batch = pending.current;
    let active = true;
    void batch.promise.then(response => {
      if (!active || pending.current !== batch || response === null) return;
      setResult(previous => ({ base, queue: insertWordProblems(previous?.base === base ? previous.queue : base, batch.plan, response, position.current) }));
    });
    // 화면을 떠나거나 새 라운드를 시작한 뒤 이전 응답은 쓰지 않는다.
    return () => { active = false; };
  }, [base, cfg, profileId, level, ratio, interests]);
  return result?.base === base ? result.queue : base;
}
