import { useCallback, useEffect, useRef, useState } from 'react';
import type { TalkLog } from '../types';
import { useStore } from '../store/StoreContext';
import { AiError, generate } from '../lib/ai';
import { aiReady, summaryLines } from '../lib/talk';
import { businessMemorySummary, isBizFeedback, savePhrase, scenarioTitle } from '../lib/business';

/** 같은 피드백을 대화 종료 화면과 보호자 기록 화면에서 사용한다. */
export function BusinessFeedback({ log, auto = false }: { log: TalkLog; auto?: boolean }) {
  const { state, update } = useStore();
  const feedback = state.data.parent.talks.find(row => row.id === log.id)?.feedback;
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const alive = useRef(true), busy = useRef(false), requested = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const cfg = state.ai, memory = state.data.parent.friendMemory;
  const receive = useCallback(async () => {
    if (busy.current || feedback) return;
    const input = summaryLines(log.lines);
    if (!input.length) { setError('저장된 발화가 없어요. 다음 대화에서 피드백을 받아 보세요.'); return; }
    if (!aiReady(cfg)) { setError('보호자 모드에서 AI 연결을 확인해 주세요.'); return; }
    busy.current = true; setPending(true); setError('');
    try {
      const result = await generate(cfg, { profileId: 'parent', level: 'adult', kind: 'biz-feedback', input: { lines: input } });
      if (!isBizFeedback(result)) throw new AiError('server');
      update(draft => { const stored = draft.data.parent.talks.find(row => row.id === log.id); if (stored) stored.feedback = result; });
      // 기억 생성 실패가 이미 받은 피드백까지 실패로 표시되지 않게 한다.
      try {
        if (!alive.current) return;
        const merged = await generate(cfg, { profileId: 'parent', level: 'adult', kind: 'memory-merge', input: { memory, summary: businessMemorySummary(log, result) } });
        if (typeof merged === 'string' && merged.length <= 1500 && alive.current) update(draft => {
          if (draft.data.parent.talks.some(row => row.id === log.id) && draft.data.parent.friendMemory === memory) draft.data.parent.friendMemory = merged;
        });
      } catch { /* 피드백·원문은 저장했고 기억 갱신만 다음 대화로 미룬다. */ }
    } catch (e) {
      if (alive.current) setError(`${e instanceof AiError ? e.message : '피드백을 받지 못했어요.'} 대화 기록은 저장되어 있어요.`);
    } finally {
      busy.current = false; if (alive.current) setPending(false);
    }
  }, [cfg, feedback, log, memory, update]);
  useEffect(() => {
    if (auto && !feedback && !requested.current) { requested.current = true; void receive(); }
  }, [auto, feedback, receive]);
  const save = (en: string, ko: string) => {
    const now = Date.now(), random = Math.random();
    update(draft => { savePhrase(draft.data.parent, en, ko, scenarioTitle(log.scenarioId), now, () => random); });
    setMessage('내 표현에 저장했어요. 단어와 따라 말하기에서 복습해요.');
  };
  const saved = (en: string) => (state.data.parent.customCards ?? []).some(card => card.en.trim().toLowerCase() === en.trim().toLowerCase());
  const saveButton = (en: string, ko: string) => <button className="btn btn-soft" disabled={saved(en)} onClick={() => save(en, ko)}>{saved(en) ? '✓ 내 표현에 저장됨' : '⭐ 내 표현에 저장'}</button>;
  return <section className="panel form business-feedback" aria-label="비즈니스 대화 피드백">
    <h2>대화 피드백</h2>
    {pending && <p role="status">표현을 정리하고 있어요…</p>}
    {error && !feedback && <p className="bad-text" role="alert">{error}</p>}
    {feedback ? <>
      <p>{feedback.overallKo}</p><h3>더 자연스러운 표현</h3>
      {!feedback.corrections.length && <p className="muted">고칠 표현이 없어요.</p>}
      {feedback.corrections.map((row, index) => <article className="business-expression" key={index}>
        <p lang="en" className="muted">{row.said}</p><p lang="en"><strong>→ {row.better}</strong></p><p>{row.why}</p>{saveButton(row.better, row.why)}
      </article>)}
      <h3>다음에 써 볼 핵심 표현</h3>{feedback.nextExpressions.map((row, index) => <article className="business-expression" key={index}>
        <p lang="en"><strong>{row.en}</strong></p><p>{row.ko}</p>{saveButton(row.en, row.ko)}
      </article>)}
      {message && <p role="status">{message}</p>}
    </> : !pending && <button className="btn btn-primary" disabled={!log.lines.some(line => line.text.trim())} onClick={() => { void receive(); }}>피드백 다시 받기</button>}
  </section>;
}
