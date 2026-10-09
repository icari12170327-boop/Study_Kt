import { useEffect, useRef, useState } from 'react';
import type { Level, ProfileId, QaCard } from '../types';
import { useStore } from '../store/StoreContext';
import { AiError, generate } from '../lib/ai';
import { aiReady } from '../lib/talk';
import { hasCandidateAdditions, isQuizResponse, quizCount, quizReadiness, toCandidates, type QuizCandidate, type QuizType } from '../lib/readingQuiz';
import { uid } from '../lib/random';

const LABEL: Record<QuizType, string> = { fact: '사실', why: '왜', apply: '적용' };
export function ReadingQuizPanel({ existing, level, profileId, title, author, summary, onAdd }: {
  existing: readonly QaCard[]; level: Level; profileId: ProfileId; title: string; author: string; summary: string;
  onAdd: (candidates: readonly QuizCandidate[]) => void;
}) {
  const { state } = useStore();
  const [candidates, setCandidates] = useState<QuizCandidate[] | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const active = useRef<AbortController | null>(null), latestCards = useRef(existing);
  useEffect(() => { latestCards.current = existing; }, [existing]);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const readiness = quizReadiness({ aiReady: aiReady(state.ai), title, summary });
  const authorTooLong = author.trim().length > 100;
  const ready = readiness.ok && !authorTooLong;
  const reason = !readiness.ok ? readiness.reason : authorTooLong ? '지은이를 100자 이내로 줄여 주세요.' : '';
  const make = async () => {
    if (!ready || active.current) return;
    const controller = new AbortController(); active.current = controller;
    setPending(true); setError('');
    try {
      const count = quizCount(level);
      const response = await generate(state.ai, { profileId, level, kind: 'reading-quiz', input: { title: title.trim(), author: author.trim(), summary: summary.trim(), level, count } }, AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]));
      if (active.current !== controller || controller.signal.aborted) return;
      if (!isQuizResponse(response)) throw new AiError('server');
      setCandidates(toCandidates(latestCards.current, response.cards, count, uid));
    } catch (cause) {
      if (active.current === controller && !controller.signal.aborted) setError(cause instanceof AiError ? cause.message : new AiError('server').message);
    } finally {
      if (active.current === controller) { active.current = null; setPending(false); }
    }
  };
  const close = () => {
    active.current?.abort(); active.current = null;
    setPending(false); setCandidates(null); setError('');
  };
  const edit = (id: string, change: Partial<QuizCandidate>) => setCandidates(rows => rows?.map(row => row.id === id ? { ...row, ...change } : row) ?? null);
  const hasSelection = candidates?.some(row => row.checked && row.q.trim() && row.a.trim());
  const canAdd = candidates !== null && hasCandidateAdditions(existing, candidates);
  return <section className="reading-quiz panel" aria-label="AI 질문 후보">
    <button className="btn btn-soft" disabled={pending || !ready} onClick={() => void make()}>{pending ? '질문을 만들고 있어요…' : error ? '다시 시도' : candidates !== null ? '다시 만들기' : '🤖 질문 만들기'}</button>
    {reason && <p className="small muted">{reason}</p>}
    <p className="small muted">제목·지은이·요약을 AI에 보내요. 개인 정보는 빼고 써 주세요. 고른 질문도 저장을 눌러야 남아요.</p>
    {pending && <p role="status">질문을 만들고 있어요…</p>}
    {error && <p role="alert">{error}</p>}
    {candidates !== null && <>
      <h3>고르고 고쳐 보세요</h3>
      {candidates.length === 0 && <p>이미 있는 질문과 같아서 새 후보가 없어요.</p>}
      {candidates.map((row, index) => <div className="reading-quiz-candidate" key={row.id}>
        <label className="check"><input type="checkbox" checked={row.checked} disabled={pending} onChange={event => edit(row.id, { checked: event.target.checked })} />후보 {index + 1} 선택 · {LABEL[row.type]}</label>
        <label>후보 질문 {index + 1}<input maxLength={500} value={row.q} disabled={pending} onChange={event => edit(row.id, { q: event.target.value })} /></label>
        <label>후보 답 {index + 1}<textarea rows={2} maxLength={500} value={row.a} disabled={pending} onChange={event => edit(row.id, { a: event.target.value })} /></label>
      </div>)}
      {hasSelection && !canAdd && <p role="status" id="reading-quiz-duplicate">이미 있는 질문이에요. 질문을 고치거나 다른 후보를 골라 주세요.</p>}
      <button className="btn btn-primary" disabled={pending || !canAdd} aria-describedby={hasSelection && !canAdd ? 'reading-quiz-duplicate' : undefined} onClick={() => { if (!canAdd) return; onAdd(candidates); close(); }}>고른 질문 추가</button>
    </>}
    {(pending || candidates !== null || error) && <button className="btn btn-ghost" onClick={close}>닫기</button>}
  </section>;
}
