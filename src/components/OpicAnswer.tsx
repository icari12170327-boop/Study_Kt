import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { startRecording, type RecorderHandle, type Recording } from '../lib/recorder';
import { transcribe, TranscribeError } from '../lib/opicApi';
import { speak } from '../lib/speech';
import { AiError } from '../lib/ai';
import { ProgressBar } from './common';

/** 서버 받아쓰기 공통 입력. 녹음 파일은 이 컴포넌트의 메모리에만 둔다. */
export function OpicAnswer({ maxSeconds, question, onAnswer }: { maxSeconds: 90 | 150; question?: { en: string; ko: string }; onAnswer: (text: string, seconds: number) => void | Promise<void> }) {
  const { state } = useStore();
  const [phase, setPhase] = useState<'idle' | 'listening' | 'ready' | 'recording' | 'typing' | 'upload'>('idle');
  const [left, setLeft] = useState<number>(maxSeconds), [text, setText] = useState(''), [error, setError] = useState(''), [replayed, setReplayed] = useState(false);
  const live = useRef(true), busy = useRef(false), epoch = useRef(0), pending = useRef<Recording | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined), handle = useRef<RecorderHandle | undefined>(undefined), inputStart = useRef<number | undefined>(undefined), deadline = useRef(0);
  useEffect(() => { live.current = true; return () => { live.current = false; controller.current?.abort(); handle.current?.dispose(); pending.current = undefined; window.speechSynthesis?.cancel(); }; }, []);
  const upload = async (recording: Recording) => {
    if (busy.current) return;
    if (!recording.audio.size) { pending.current = undefined; setError(new TranscribeError('empty-recording').message); setPhase('idle'); return; }
    busy.current = true; pending.current = recording; setPhase('upload'); setError('');
    const cancel = new AbortController(); controller.current = cancel;
    try {
      const answer = await transcribe(state.ai, recording, cancel.signal);
      if (live.current && !cancel.signal.aborted) { pending.current = undefined; await onAnswer(answer, recording.durationSec); }
    } catch (err) {
      if (live.current && !cancel.signal.aborted) {
        if (err instanceof TranscribeError) { pending.current = undefined; setError(err.message); }
        else setError(err instanceof AiError && err.kind === 'limit' ? '오늘 받아쓰기 한도를 모두 썼어요.' : err instanceof AiError && err.kind === 'unauthorized' ? 'AI 연결 설정을 확인해 주세요.' : '받아쓰기를 받지 못했어요. 다시 보내거나 글로 답해 주세요.');
        setPhase('idle');
      }
    } finally { if (controller.current === cancel) busy.current = false; }
  };
  const record = async () => {
    if (busy.current) return;
    busy.current = true; setPhase('recording'); setLeft(maxSeconds); setError('');
    const cancel = new AbortController(); controller.current = cancel;
    try {
      const next = await startRecording({ maxSeconds, signal: cancel.signal, onTick: seconds => { if (live.current && !cancel.signal.aborted) setLeft(seconds); } });
      if (!live.current || cancel.signal.aborted) { next.dispose(); return; }
      handle.current = next;
      const recording = await next.result;
      if (live.current && !cancel.signal.aborted) { busy.current = false; await upload(recording); }
    } catch { if (live.current && !cancel.signal.aborted) { setError('마이크를 사용할 수 없어요. 글로 답해 주세요.'); setPhase('typing'); } }
    finally { if (controller.current === cancel) busy.current = false; }
  };
  // 준비 시간은 없다. 첫 재생을 마친 뒤 5초 안에 한 번만 다시 들을 수 있다.
  const listen = async (again = false) => {
    if (busy.current || !question || (again && (replayed || performance.now() > deadline.current))) return;
    busy.current = true; const current = ++epoch.current; if (again) setReplayed(true); setPhase('listening');
    await speak(question.en);
    if (!live.current || current !== epoch.current) return;
    busy.current = false;
    if (again) void record(); else { deadline.current = performance.now() + 5000; setLeft(5); setPhase('ready'); }
  };
  useEffect(() => {
    if (phase !== 'ready') return;
    const interval = setInterval(() => { const rest = Math.max(0, (deadline.current - performance.now()) / 1000); setLeft(rest); if (!rest) { clearInterval(interval); void record(); } }, 100);
    return () => clearInterval(interval);
  });
  const typing = () => { epoch.current++; controller.current?.abort(); handle.current?.dispose(); busy.current = false; pending.current = undefined; window.speechSynthesis?.cancel(); inputStart.current = undefined; setError(''); setPhase('typing'); };
  const submit = async () => {
    if (busy.current || !text.trim()) return; busy.current = true;
    try { await onAnswer(text.trim(), Math.max(1, Math.min(maxSeconds, (performance.now() - (inputStart.current ?? performance.now())) / 1000))); }
    finally { busy.current = false; }
  };
  return <div className="opic-answer-input">
    {question && <article className="panel"><p lang="en">{question.en}</p><p>{question.ko}</p></article>}
    {phase === 'idle' && <div className="opic-actions">
      <button className="btn btn-primary" onClick={() => question ? void listen() : void record()}>{question ? '🔊 질문 듣기' : '🎤 다시 말하기 시작'}</button>
      {pending.current && <button className="btn btn-soft" onClick={() => void upload(pending.current!)}>다시 보내기</button>}
      <button className="btn btn-soft" onClick={typing}>⌨️ 글로 답하기</button>
    </div>}
    {phase === 'listening' && <><p role="status">질문을 듣고 있어요…</p><button className="btn btn-soft" onClick={typing}>⌨️ 글로 답하기</button></>}
    {phase === 'ready' && <div className="panel"><p role="status">{Math.ceil(left)}초 안에 다시 들을 수 있어요. 곧 답변을 시작해요.</p><div className="opic-actions"><button className="btn btn-soft" disabled={replayed} onClick={() => void listen(true)}>🔊 다시 듣기 · 1회</button><button className="btn btn-primary" onClick={() => void record()}>🎤 답변 시작</button><button className="btn btn-soft" onClick={typing}>⌨️ 글로 답하기</button></div></div>}
    {phase === 'recording' && <div className="panel"><p role="status">🎤 녹음 중 · {Math.ceil(left)}초 남음</p><ProgressBar value={left} max={maxSeconds} /><button className="btn btn-primary" onClick={() => handle.current ? handle.current.stop() : typing()}>녹음 끝내기</button></div>}
    {phase === 'typing' && <div className="panel"><label>내 답변<textarea maxLength={6000} value={text} onChange={e => { inputStart.current ??= performance.now(); setText(e.target.value); }} /></label><button className="btn btn-primary" disabled={!text.trim()} onClick={() => void submit()}>답변 끝내기</button></div>}
    {phase === 'upload' && <p role="status">받아쓰는 중…</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
