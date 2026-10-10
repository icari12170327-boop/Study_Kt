import { useEffect, useRef, useState } from 'react';
import { CHUNK_MAP } from '../content/talk/chunks';
import type { TalkLog } from '../types';
import { useStore } from '../store/StoreContext';
import { canRecognize, listenOnce, type ListenHandle } from '../lib/speech';
import { toDateKey } from '../lib/date';
import { recordRetell } from '../lib/parentPractice';
import { englishWordCount, practiceTargets } from '../lib/talkGrowth';
import { updateRetrieval } from '../lib/retrieval';
export function TalkRetell({ log }: { log: TalkLog }) {
  const { state, update } = useStore();
  const stored = state.data.parent.talks.find(row => row.id === log.id) ?? log;
  const [phase, setPhase] = useState<'ready' | 'running' | 'result' | 'done'>(stored.retells?.length ? 'result' : 'ready');
  const [text, setText] = useState(''), [remaining, setRemaining] = useState(120), [rounds, setRounds] = useState(stored.retells?.length ?? 0);
  const [listening, setListening] = useState(false), [message, setMessage] = useState('');
  const [result, setResult] = useState<{ text: string; seconds: number } | undefined>(stored.retells?.at(-1));
  const active = useRef<{ start: number; limit: 120 | 90 } | undefined>(undefined), textRef = useRef(''), timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const handle = useRef<ListenHandle | undefined>(undefined), epoch = useRef(0), alive = useRef(true);
  const stopListening = () => { epoch.current++; handle.current?.stop(); handle.current = undefined; setListening(false); };
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current = undefined; clearInterval(timer.current); handle.current?.stop(); }; }, []);
  const finish = () => {
    const run = active.current; if (!run) return;
    active.current = undefined; clearInterval(timer.current); stopListening();
    const seconds = Math.min(run.limit, Math.max(1, (performance.now() - run.start) / 1000)), value = textRef.current.trim();
    update(draft => recordRetell(draft.data.parent, log.id, { text: value, seconds, limit: run.limit }, toDateKey()));
    setResult({ text: value, seconds }); setRounds(n => n + 1); setPhase('result'); setMessage('');
  };
  const start = (limit: 120 | 90) => {
    if (active.current || rounds >= 2) return;
    textRef.current = ''; setText(''); setMessage(''); setRemaining(limit); setPhase('running');
    active.current = { start: performance.now(), limit };
    timer.current = setInterval(() => { const run = active.current; if (!run) return; const left = Math.max(0, run.limit - (performance.now() - run.start) / 1000); setRemaining(Math.ceil(left)); if (!left) finish(); }, 250);
  };
  const listen = async () => {
    if (!active.current || handle.current || !canRecognize()) return;
    const current = ++epoch.current; setListening(true); setMessage('');
    try {
      const request = listenOnce('en-US'); handle.current = request;
      const values = await request.promise;
      if (!alive.current || current !== epoch.current || !active.current) return;
      textRef.current = [textRef.current, values[0] ?? ''].filter(Boolean).join(' ').slice(0, 6000); setText(textRef.current);
    } catch { if (alive.current && current === epoch.current) setMessage('말을 듣지 못했어요. 입력하거나 다시 말해도 돼요.'); }
    finally { if (alive.current && current === epoch.current) { handle.current = undefined; setListening(false); } }
  };
  const corrections = (stored.corrections?.items ?? []).map(item => item.better);
  const targets = practiceTargets(stored).filter(item => corrections.includes(item.text));
  const used = result ? updateRetrieval([], targets, [result.text], log.date, false).result.reused.length : 0;
  return <section className="panel form t22b-retell" aria-label="오늘 이야기 다시 말하기">
    <h2>오늘 이야기를 2분 안에 다시 말해 볼까요?</h2>
    <p className="small muted">AI에 다시 연결하지 않아요. 아래 표현을 보며 말하거나 입력해요.</p>
    <ul className="t22b-expression-list">{[...corrections, ...(stored.previewChunks ?? []).flatMap(id => { const chunk = CHUNK_MAP.get(id); return chunk ? [chunk.en] : []; })].map((value, i) => <li lang="en" key={`${i}-${value}`}>{value}</li>)}</ul>
    {phase === 'ready' && <button className="btn btn-primary" onClick={() => start(120)}>2분 다시 말하기 시작</button>}
    {phase === 'running' && <><p role="timer">남은 시간 {remaining}초</p>
      <label>내 이야기<textarea value={text} maxLength={6000} rows={5} onChange={event => { if (!active.current) return; textRef.current = event.target.value; setText(textRef.current); }} /></label>
      <div className="row-center">{canRecognize() && <button className="btn btn-soft" onClick={() => { if (listening) stopListening(); else void listen(); }}>{listening ? '듣기 멈춤' : '🎤 문장 말하기'}</button>}<button className="btn btn-primary" onClick={finish}>다시 말하기 끝내기</button></div>
      {!canRecognize() && <p className="small muted">음성 인식이 없어서 입력으로 연습해요.</p>}
    </>}
    {phase === 'result' && result && <div role="status">{targets.length > 0 && <p>교정 표현 {used}/{targets.length} 사용{used > 0 && ' ✅'}</p>}<p>영어 단어 {englishWordCount(result.text)}개 · 분당 {Math.round(englishWordCount(result.text) / result.seconds * 60)}개</p><p lang="en" className="t22b-retell-text">{result.text || '말한 내용이 없어요. 다음에 다시 해도 돼요.'}</p>{rounds < 2 && <button className="btn btn-soft" onClick={() => start(90)}>1분 30초로 한 번 더</button>}</div>}
    {phase === 'done' ? <p>다시 말하기를 건너뛰었어요. 대화 기록은 그대로 있어요.</p> : phase !== 'result' && <button className="btn btn-ghost" onClick={() => { active.current = undefined; clearInterval(timer.current); stopListening(); setPhase('done'); }}>다시 말하기 건너뛰기</button>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
