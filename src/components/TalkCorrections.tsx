import { buildTalkGrowth } from '../lib/talkGrowth';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoachSettings, TalkLog } from '../types';
import { useStore } from '../store/StoreContext';
import { AiError, generate } from '../lib/ai';
import { aiReady, summaryLines } from '../lib/talk';
import { normalizeCoachSettings } from '../lib/coach';
import { filterCorrections, focusParts, isCorrections, saveCorrection, selfFixed } from '../lib/talkCorrections';
import { toDateKey } from '../lib/date';
import { canRecognize, canSpeak, listenOnce, speak, type ListenHandle } from '../lib/speech';
import { scoreSpeech } from '../lib/similarity';

function Better({ better, focus }: { better: string; focus: string }) {
  const [before, core, after] = focusParts(better, focus);
  return <p lang="en" className="coach-sentence">{before}<strong>{core}</strong>{after}</p>;
}
/** 보호자 완료 화면과 기록 화면이 같은 검증·저장 경로를 사용한다. */
export function TalkCorrections({ log, auto = false, history = false, settings, onComplete }: { log: TalkLog; auto?: boolean; history?: boolean; settings?: CoachSettings; onComplete?: () => void }) {
  const { state, update } = useStore();
  const stored = state.data.parent.talks.find(row => row.id === log.id);
  const corrections = stored?.corrections, review = stored?.reviewResult;
  const cfg = state.ai, coach = settings ?? normalizeCoachSettings(state.settings.parent.coach);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const [index, setIndex] = useState(0), [step, setStep] = useState<'try' | 'answer' | 'practice' | 'save' | 'done'>('try');
  const [answer, setAnswer] = useState(''), [save, setSave] = useState(true), [message, setMessage] = useState(''), [listening, setListening] = useState(false), [playing, setPlaying] = useState(false);
  const alive = useRef(true), busy = useRef(false), requested = useRef(false), advancing = useRef(false);
  const abort = useRef<AbortController | undefined>(undefined), listeningHandle = useRef<ListenHandle | undefined>(undefined), speechEpoch = useRef(0), input = useRef<HTMLTextAreaElement>(null), title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; abort.current?.abort(); listeningHandle.current?.stop(); if (canSpeak()) window.speechSynthesis.cancel(); };
  }, []);
  useEffect(() => { advancing.current = false; title.current?.focus(); }, [index, step]);
  const receive = useCallback(async () => {
    if (busy.current || corrections || !stored) return;
    requested.current = true;
    const lines = summaryLines(log.lines).map(line => ({ role: line.role === 'kid' ? 'user' as const : 'ai' as const, text: line.text }));
    if (!lines.some(line => line.role === 'user')) { setError('저장된 내 말이 없어요. 다음 대화에서 교정을 받아 보세요.'); return; }
    if (!aiReady(cfg)) { setError('보호자 모드에서 AI 연결을 확인해 주세요.'); return; }
    busy.current = true; setPending(true); setError(''); abort.current = new AbortController();
    try {
      const result = await generate(cfg, { profileId: 'parent', level: 'adult', kind: 'talk-corrections', input: { mode: log.mode === 'coach' ? 'coach' : 'biz', level: log.mode === 'coach' ? coach.level : 'biz', lines } }, AbortSignal.any([abort.current.signal, AbortSignal.timeout(25000)]));
      if (!alive.current || abort.current.signal.aborted) return;
      if (!isCorrections(result)) throw new AiError('server');
      const safe = filterCorrections(result, lines.filter(line => line.role === 'user').map(line => line.text));
      // 서버가 보낸 학습 결과만 저장한다. 직접 고침 표시는 사용자가 답한 뒤에만 붙인다.
      const data = { praiseKo: safe.praiseKo, items: safe.items.map(item => ({ said: item.said, better: item.better, focus: item.focus, whyKo: item.whyKo, hintKo: item.hintKo, pattern: item.pattern })), createdAt: toDateKey() };
      update(draft => { const row = draft.data.parent.talks.find(row => row.id === log.id); if (row && !row.corrections) { row.corrections = data; if (row.growth) row.growth = buildTalkGrowth(row); } });
    } catch (error) {
      if (alive.current && !abort.current.signal.aborted) setError(error instanceof AiError && error.kind === 'unauthorized' ? 'AI 연결 권한이 없어요. Worker 설정을 확인해 주세요.' : error instanceof AiError && !['network', 'server'].includes(error.kind) ? error.message : '교정을 받지 못했어요. 다시 받기를 눌러 주세요. 대화 기록은 저장되어 있어요.');
    } finally { busy.current = false; if (alive.current) setPending(false); }
  }, [cfg, coach.level, corrections, log, stored, update]);
  useEffect(() => {
    let cancelled = false;
    // StrictMode의 첫 준비 효과에서는 요청하지 않고 실제로 남아 있는 화면에서 한 번만 시작한다.
    queueMicrotask(() => { if (!cancelled && auto && !requested.current && !corrections) void receive(); });
    return () => { cancelled = true; };
  }, [auto, corrections, receive]);
  useEffect(() => { if (!history && (step === 'done' || corrections?.items.length === 0)) onComplete?.(); }, [history, step, corrections, onComplete]);
  const item = corrections?.items[index];
  const stopListening = () => { speechEpoch.current++; listeningHandle.current?.stop(); listeningHandle.current = undefined; setListening(false); };
  const record = async (repeat: boolean) => {
    if (listeningHandle.current || !canRecognize() || !item) return;
    const epoch = ++speechEpoch.current; setListening(true); setMessage('');
    try {
      const handle = listenOnce('en-US'); listeningHandle.current = handle;
      const values = await handle.promise;
      if (!alive.current || epoch !== speechEpoch.current) return;
      if (repeat) setMessage(values.some(value => scoreSpeech(item.better, value).score >= 0.8) ? '잘 따라 말했어요! 👏' : '괜찮아요. 다시 해도 되고 넘어가도 돼요.');
      else setAnswer(values[0] ?? '');
    } catch { if (alive.current && epoch === speechEpoch.current) setMessage('말을 듣지 못했어요. 입력하거나 넘어가도 돼요.'); }
    finally { if (alive.current && epoch === speechEpoch.current) { listeningHandle.current = undefined; setListening(false); } }
  };
  const reveal = (unknown = false) => {
    if (!item) return;
    stopListening();
    const fixed = !unknown && selfFixed(item, answer);
    update(draft => { const logRow = draft.data.parent.talks.find(row => row.id === log.id), row = logRow?.corrections?.items[index]; if (row && (fixed || logRow?.growth)) row.selfFixed = fixed; if (logRow?.growth) logRow.growth = buildTalkGrowth(logRow); });
    setMessage(''); setStep('answer');
  };
  const next = () => {
    if (!item || advancing.current) return;
    advancing.current = true; stopListening();
    if (save) { const now = Date.now(), random = Math.random(); update(draft => { saveCorrection(draft.data.parent, item, log.mode === 'coach' ? 'coach' : 'biz', toDateKey(new Date(now)), now, () => random); }); }
    setMessage(''); setAnswer(''); setSave(true);
    if (index + 1 >= (corrections?.items.length ?? 0)) setStep('done'); else { setIndex(index + 1); setStep('try'); }
  };
  return <section className="panel form talk-corrections" aria-label="오늘의 교정">
    <h2>오늘의 교정</h2>
    {!!review?.targets.length && <p>지난 표현 다시 쓰기: {review.targets.length}개 중 {review.reused.length}개 성공{review.reused.length > 0 && ' ✅'}</p>}
    {pending && <p role="status">오늘의 표현을 정리하고 있어요…</p>}
    {error && !corrections && <p className="bad-text" role="alert">{error}</p>}
    {!corrections && !pending && <button className="btn btn-primary" onClick={() => { void receive(); }}>다시 받기</button>}
    {corrections && <><p>{corrections.praiseKo}</p>
      {!corrections.items.length && <p>오늘은 고칠 곳이 거의 없었어요 👏</p>}
      {history ? corrections.items.map((row, i) => <article className="business-expression" key={i}><p lang="en">내 말: {row.said}</p><Better better={row.better} focus={row.focus} /><p>{row.whyKo}</p>{row.selfFixed && <p>직접 고쳤어요! 👏</p>}</article>) : item && step !== 'done' && <article className="business-expression form">
        <p className="small muted">{index + 1} / {corrections.items.length}</p>
        <h3 ref={title} tabIndex={-1}>{step === 'try' ? '먼저 고쳐 보기' : step === 'answer' ? '정답' : step === 'practice' ? '듣고 따라 말하기' : '내 표현에 저장'}</h3>
        {step === 'try' ? <><p lang="en">내 말: {item.said}</p><p>{item.hintKo}</p><p>어떻게 고치면 좋을까요?</p>
          <label>내가 고친 문장<textarea ref={input} value={answer} maxLength={300} rows={3} onChange={event => setAnswer(event.target.value)} /></label>
          <div className="row-center">{canRecognize() && <button className="btn btn-soft" disabled={listening} onClick={() => { void record(false); }}>🎤 말하기</button>}<button className="btn btn-soft" onClick={() => input.current?.focus()}>⌨️ 입력</button><button className="btn btn-primary" disabled={!answer.trim()} onClick={() => reveal()}>고친 문장 확인</button><button className="btn btn-ghost" onClick={() => reveal(true)}>모르겠어요</button></div>
        </> : <><Better better={item.better} focus={item.focus} /><p>{item.whyKo}</p>{item.selfFixed && <p className="good-text">직접 고쳤어요! 👏</p>}
          {step === 'answer' && <button className="btn btn-primary" onClick={() => setStep('practice')}>듣고 따라 말하기</button>}
          {step === 'practice' && <><div className="row-center">{canSpeak() && <button className="btn btn-soft" disabled={playing} onClick={() => { setPlaying(true); void speak(item.better, { lang: 'en-US', rate: coach.speed }).finally(() => { if (alive.current) setPlaying(false); }); }}>🔊 듣기</button>}{canRecognize() && <button className="btn btn-soft" disabled={listening} onClick={() => { void record(true); }}>🎤 따라 말하기</button>}</div><p className="small muted">말하기가 어려우면 건너뛰어도 괜찮아요.</p><button className="btn btn-primary" onClick={() => { stopListening(); setStep('save'); }}>저장으로</button></>}
          {step === 'save' && <><label className="check"><input type="checkbox" checked={save} onChange={event => setSave(event.target.checked)} />내 표현에 저장</label><button className="btn btn-primary" onClick={next}>{save ? '저장하고 다음' : '저장 없이 다음'}</button></>}
        </>}
        {listening && <p role="status">듣고 있어요…</p>}{message && <p role="status">{message}</p>}
      </article>}
      {!history && step === 'done' && <p role="status">오늘의 교정을 모두 확인했어요. 저장한 표현은 다음 대화에서 다시 써 봐요.</p>}
    </>}
    {!history && onComplete && step !== 'done' && !!corrections?.items.length && <button className="btn btn-ghost" onClick={() => { stopListening(); setStep('done'); }}>교정 연습 건너뛰기</button>}
    {!history && onComplete && !corrections && !pending && <button className="btn btn-ghost" onClick={() => setStep('done')}>교정 없이 다시 말하기로</button>}
  </section>;
}
