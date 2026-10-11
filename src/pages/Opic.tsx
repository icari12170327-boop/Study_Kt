import { useEffect, useRef, useState } from 'react';
import type { Go } from '../route';
import { useStore } from '../store/StoreContext';
import { TopBar, ProgressBar } from '../components/common';
import { OPIC_TARGETS, filterOpicFeedback, type OpicFeedback } from '../../shared/opic';
import { OPIC_QUESTIONS, QUESTION_MAP, SURVEY_TOPICS, TOPIC_NAMES, TYPE_NAMES } from '../content/opic/questions';
import { OPIC_FRAMES } from '../content/opic/frames';
import { defaultOpicSettings, emptyOpic, isOpicFeedback, modelAnswerParts, opicMetrics, pickOpicQuestion, reserveOpicQuestion, type OpicAttempt, type OpicSettings } from '../lib/opic';
import { toDateKey } from '../lib/date';
import { generate, AiError } from '../lib/ai';
import { transcribe } from '../lib/opicApi';
import { startRecording, type RecorderHandle, type Recording } from '../lib/recorder';
import { speak } from '../lib/speech';

export function Opic({ go }: { go: Go }) {
  const { state, update } = useStore();
  const data = state.data.parent.opic;
  const [tab, setTab] = useState<'home' | 'settings' | 'daily' | 'notes' | 'history'>(data ? 'home' : 'settings');
  const [attemptId, setAttemptId] = useState<string>();
  const today = toDateKey();
  const select = (change = false) => {
    if (!data || (change && (data.skipsByDate?.[today] ?? 0) >= 2)) return;
    const question = pickOpicQuestion(OPIC_QUESTIONS, data.settings, data.attempts, today, { change });
    const next = structuredClone(data), attempt = reserveOpicQuestion(next, question, today, change);
    if (!attempt) return;
    update(draft => { draft.data.parent.opic = next; }); setAttemptId(attempt.id); setTab('daily');
  };
  const attempt = data?.attempts.find(a => a.id === attemptId);
  return <div className="page opic-page">
    <TopBar title="🎯 오픽" onBack={() => tab === 'home' || (!data && tab === 'settings') ? go({ name: 'home', profileId: 'parent' }) : setTab('home')} />
    {tab === 'settings' && <OpicSettingsForm initial={data?.settings} onSave={settings => { update(draft => { draft.data.parent.opic ??= emptyOpic(); draft.data.parent.opic.settings = settings; }); setTab('home'); }} />}
    {data && tab === 'home' && <>
      <p className="panel">목표 {data.settings.targetLevel} · 난이도 {data.settings.difficulty}{data.settings.examDate && ` · 시험 ${data.settings.examDate}`}<br />한 문항씩, 내 경험으로 연습해요.</p>
      <div className="opic-actions"><button className="btn btn-primary" onClick={() => select()}>오늘의 한 문항</button><button className="btn btn-soft" disabled={(data.skipsByDate?.[today] ?? 0) >= 2} onClick={() => select(true)}>다른 문항 · {data.skipsByDate?.[today] ?? 0}/2</button></div>
      <div className="opic-actions"><button className="btn btn-soft" onClick={() => setTab('notes')}>📒 내 답안 노트</button><button className="btn btn-soft" onClick={() => setTab('history')}>📊 기록</button><button className="btn btn-ghost" onClick={() => setTab('settings')}>⚙️ 설정</button></div>
      <h2>유형 진도</h2><div className="opic-progress">{data.settings.survey.map(topic => <div key={topic}><strong>{TOPIC_NAMES[topic]}</strong>{(['description', 'routine', 'past'] as const).map(type => <span key={type}>{TYPE_NAMES[type]} {data.attempts.some(a => a.topic === topic && a.type === type && a.transcript.trim()) ? '✅' : '□'}</span>)}</div>)}</div>
    </>}
    {tab === 'daily' && attempt && <DailyOpic key={attempt.id} attempt={attempt} onDone={() => setTab('home')} />}
    {tab === 'notes' && data && <OpicNotes />}
    {tab === 'history' && data && <><h2>연습 기록</h2><p className="muted">예상 범위는 참고용이며 공식 성적이 아니에요.</p>{[...data.attempts].reverse().filter(a => a.transcript.trim()).map(a => <article className="panel" key={a.id}><h3>{a.date} · {TOPIC_NAMES[a.topic]} · {TYPE_NAMES[a.type]}</h3><p>{a.words}단어 · 분당 {Math.round(a.wpm)}단어 · 한국어 {Math.round(a.koreanRatio * 100)}% · 예상 {a.feedback?.levelBand ?? '피드백 없음'} (참고용)</p><details><summary>내 답변</summary><p className="opic-text">{a.transcript}</p></details>{a.retell && <p>다시 말하기: {a.retell.words}단어 · 분당 {Math.round(a.retell.wpm)}단어</p>}</article>)}</>}
  </div>;
}
function OpicSettingsForm({ initial, onSave }: { initial?: OpicSettings; onSave: (settings: OpicSettings) => void }) {
  const [settings, setSettings] = useState(initial ?? defaultOpicSettings());
  return <form className="panel opic-settings" onSubmit={event => { event.preventDefault(); onSave(settings); }}><h2>내 오픽 설정</h2>
    <label>목표 등급<select value={settings.targetLevel} onChange={e => setSettings({ ...settings, targetLevel: e.target.value as OpicSettings['targetLevel'] })}>{OPIC_TARGETS.map(level => <option key={level}>{level}</option>)}</select></label>
    <label>시험 날짜 (선택)<input type="date" value={settings.examDate ?? ''} onChange={e => setSettings({ ...settings, examDate: e.target.value || undefined })} /></label>
    <label>난이도<select value={settings.difficulty} onChange={e => setSettings({ ...settings, difficulty: Number(e.target.value) as OpicSettings['difficulty'] })}>{[1, 2, 3, 4, 5, 6].map(level => <option key={level}>{level}</option>)}</select></label>
    <fieldset><legend>서베이 주제 · 실제 경험이 있는 것을 골라요</legend>{SURVEY_TOPICS.map(([id, name]) => <label key={id}><input type="checkbox" checked={settings.survey.includes(id)} onChange={e => setSettings({ ...settings, survey: e.target.checked ? [...settings.survey, id] : settings.survey.filter(topic => topic !== id) })} /> {name}</label>)}</fieldset>
    <p className="muted">실제 시험의 서베이 항목과 최소 선택 수는 접수 화면에서 확인해 주세요.</p><button className="btn btn-primary" disabled={!settings.survey.length}>설정 저장</button>
  </form>;
}
function DailyOpic({ attempt, onDone }: { attempt: OpicAttempt; onDone: () => void }) {
  const { state, update } = useStore(), question = QUESTION_MAP.get(attempt.questionId)!;
  const [phase, setPhase] = useState<'idle' | 'listening' | 'prepare' | 'recording' | 'typing' | 'upload' | 'feedback' | 'done'>(attempt.feedback ? 'done' : 'idle');
  const [answer, setAnswer] = useState(attempt.transcript), [remaining, setRemaining] = useState(120), [error, setError] = useState('');
  const [heard, setHeard] = useState(false), [replays, setReplays] = useState(0), [save, setSave] = useState(true), [retelling, setRetelling] = useState(false);
  const pending = useRef<Recording | undefined>(undefined), handle = useRef<RecorderHandle | undefined>(undefined), request = useRef<AbortController | undefined>(undefined), recorderAbort = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true), busy = useRef(false), typingStarted = useRef<number | undefined>(undefined), timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined), epoch = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearInterval(timer.current); request.current?.abort(); recorderAbort.current?.abort(); handle.current?.dispose(); pending.current = undefined; window.speechSynthesis?.cancel(); }; }, []);
  const patch = (fields: Partial<OpicAttempt>) => update(draft => { const row = draft.data.parent.opic?.attempts.find(a => a.id === attempt.id); if (row) Object.assign(row, fields); });
  const errorText = (err: unknown) => err instanceof AiError && err.kind === 'unauthorized' ? 'AI 연결의 가족 토큰과 앱 주소를 확인해 주세요.' : err instanceof AiError && err.kind === 'limit' ? '오늘 AI 사용 한도를 모두 썼어요.' : '연결하지 못했어요. 다시 시도해 주세요.';
  const feedbackFor = async (text: string, durationSec: number) => {
    setPhase('feedback'); setError(''); busy.current = true;
    const controller = new AbortController(); request.current = controller;
    try {
      const result = await generate<unknown>(state.ai, { profileId: 'parent', level: 'adult', kind: 'opic-feedback', input: { type: question.type, topic: TOPIC_NAMES[question.topic], question: question.en, transcript: text, durationSec, targetLevel: state.data.parent.opic!.settings.targetLevel } }, AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]));
      if (!isOpicFeedback(result)) throw new AiError('server');
      if (mounted.current && !controller.signal.aborted) { patch({ feedback: filterOpicFeedback(result, text) }); setPhase('done'); }
    } catch (err) { if (mounted.current && !controller.signal.aborted) { setError(errorText(err)); setPhase('idle'); } }
    finally { busy.current = false; }
  };
  const accept = async (text: string, durationSec: number, retell: boolean) => {
    if (retell) { const metrics = opicMetrics(text, durationSec); patch({ retell: { transcript: text, durationSec, words: metrics.words, wpm: metrics.wpm } }); setPhase('done'); setRetelling(false); }
    else { setAnswer(text); patch({ transcript: text, durationSec, ...opicMetrics(text, durationSec) }); await feedbackFor(text, durationSec); }
  };
  const upload = async (recording: Recording, retell: boolean) => {
    if (busy.current) return; busy.current = true; setPhase('upload'); setError(''); pending.current = recording;
    const controller = new AbortController(); request.current = controller;
    try { const text = await transcribe(state.ai, recording, controller.signal); if (mounted.current && !controller.signal.aborted) { pending.current = undefined; busy.current = false; await accept(text, recording.durationSec, retell); } }
    catch (err) { if (mounted.current && !controller.signal.aborted) { setError(`${errorText(err)} 녹음은 이 화면에 있는 동안만 남아 있어요.`); setPhase('idle'); } }
    finally { busy.current = false; }
  };
  const record = async (retell: boolean) => {
    handle.current = undefined; setPhase('recording'); setRemaining(120); setError('');
    const controller = new AbortController(); recorderAbort.current = controller;
    try {
      const next = await startRecording({ signal: controller.signal, onTick: value => { if (mounted.current) setRemaining(value); } }); handle.current = next;
      const recording = await next.result;
      if (mounted.current && !controller.signal.aborted) await upload(recording, retell);
    } catch { if (mounted.current && !controller.signal.aborted) { setError('마이크를 사용할 수 없어요. 글로 답해도 돼요.'); setPhase('typing'); typingStarted.current = undefined; if (retell) setAnswer(''); } }
  };
  const prepare = async () => {
    if (phase !== 'idle' || busy.current) return;
    const current = ++epoch.current; if (!heard) { setHeard(true); setPhase('listening'); await speak(question.en); }
    if (!mounted.current || current !== epoch.current) return;
    setPhase('prepare'); setRemaining(20); const started = performance.now();
    timer.current = setInterval(() => { if (document.hidden) { clearInterval(timer.current); setPhase('idle'); return; } const rest = Math.max(0, 20 - (performance.now() - started) / 1000); setRemaining(rest); if (!rest) { clearInterval(timer.current); void record(false); } }, 100);
  };
  const typeInstead = (retell = false) => { epoch.current++; clearInterval(timer.current); window.speechSynthesis?.cancel(); setRetelling(retell); setPhase('typing'); setError(''); typingStarted.current = undefined; if (retell) setAnswer(''); };
  const finishTyping = async () => { if (!answer.trim() || busy.current) return; const duration = Math.max(1, Math.min(150, (performance.now() - (typingStarted.current ?? performance.now())) / 1000)); await accept(answer.trim(), duration, retelling); };
  const saveNote = () => {
    if (save && attempt.feedback) update(draft => { const data = draft.data.parent.opic!; const existing = data.scripts.find(s => s.id === attempt.id); if (!existing) data.scripts = [...data.scripts, { id: attempt.id, questionId: attempt.questionId, type: attempt.type, topic: attempt.topic, text: attempt.feedback!.modelAnswer, createdAt: attempt.date, updatedAt: toDateKey() }].slice(-150); });
    onDone();
  };
  const frame = OPIC_FRAMES[question.type], feedback: OpicFeedback | undefined = attempt.feedback;
  return <section aria-label="오늘의 오픽 연습">
    <article className="panel"><h2>{TOPIC_NAMES[question.topic]} · {TYPE_NAMES[question.type]}</h2><p lang="en" className="opic-text">{question.en}</p><p>{question.ko}</p>
      <details><summary>답변 틀 보기</summary><ol>{frame.steps.map((step, i) => <li key={step}>{step}<p lang="en">{frame.skeleton[i]}</p></li>)}</ol><p>연결어: {frame.connectors.join(' / ')}</p><p>시간 벌기: {frame.fillers.join(' / ')}</p></details>
    </article>
    {['idle', 'listening', 'prepare'].includes(phase) && <div className="opic-actions">
      {!attempt.transcript && <button className="btn btn-primary" disabled={phase !== 'idle'} onClick={() => void prepare()}>🔊 질문 듣고 시작</button>}
      <button className="btn btn-soft" disabled={!heard || replays >= 1 || phase !== 'idle'} onClick={() => { setReplays(1); setPhase('listening'); const current = ++epoch.current; void speak(question.en).then(() => { if (mounted.current && current === epoch.current) setPhase('idle'); }); }}>🔊 질문 다시 듣기 · 1회</button>
      <button className="btn btn-soft" disabled={busy.current} onClick={() => typeInstead(retelling)}>⌨️ 글로 답하기</button>
      {pending.current && <button className="btn btn-primary" onClick={() => void upload(pending.current!, retelling)}>다시 보내기</button>}
      {attempt.transcript && !attempt.feedback && !pending.current && <button className="btn btn-primary" onClick={() => void feedbackFor(attempt.transcript, attempt.durationSec)}>피드백 다시 받기</button>}
    </div>}
    {phase === 'listening' && <p role="status">질문을 듣고 있어요…</p>}
    {phase === 'prepare' && <p role="status">준비 시간 {Math.ceil(remaining)}초</p>}
    {phase === 'recording' && <div className="panel"><p role="status">🎤 녹음 중 · {Math.ceil(remaining)}초 남음</p><ProgressBar value={remaining} max={120} /><button className="btn btn-primary" onClick={() => handle.current ? handle.current.stop() : (recorderAbort.current?.abort(), setPhase('idle'))}>녹음 끝내기</button></div>}
    {phase === 'typing' && <div className="panel"><label>내 답변<textarea className="opic-answer" maxLength={6000} value={answer} onChange={e => { typingStarted.current ??= performance.now(); setAnswer(e.target.value); }} /></label><button className="btn btn-primary" disabled={!answer.trim() || busy.current} onClick={() => void finishTyping()}>답변 끝내기</button></div>}
    {phase === 'upload' && <p role="status">받아쓰는 중…</p>}{phase === 'feedback' && <p role="status">피드백을 받는 중…</p>}
    {error && <p role="alert">{error}</p>}
    {phase === 'done' && feedback && <>
      <article className="panel"><h2>오늘의 피드백</h2><p>예상 범위 {feedback.levelBand} · 참고용 (공식 성적이 아니에요)</p><p>{feedback.taskDone ? '✅ 질문에 맞게 답했어요.' : '다음에는 질문이 요구한 일을 더 담아 봐요.'} {feedback.taskNoteKo}</p><p>말의 짜임: {{ words: '단어', sentences: '문장', strings: '여러 문장', paragraph: '문단' }[feedback.textType]}</p><ul>{feedback.strengthsKo.map(s => <li key={s}>{s}</li>)}</ul>{feedback.corrections.map((c, i) => <p key={i}><span lang="en">{c.said} → <strong>{c.better}</strong></span><br />{c.whyKo}</p>)}<p>다음 한 걸음: {feedback.nextStepKo}</p><p>{attempt.words}단어 · 분당 {Math.round(attempt.wpm)}단어 · 한국어 {Math.round(attempt.koreanRatio * 100)}%</p></article>
      <article className="panel"><h2>한 단계 위 모범 답안</h2><p lang="en" className="opic-text">{modelAnswerParts(feedback).map((part, i) => part.changed ? <strong key={i}>{part.text}</strong> : part.text)}</p><button className="btn btn-soft" onClick={() => void speak(feedback.modelAnswer)}>🔊 모범 답안 듣기</button><p lang="en">핵심 표현: {feedback.keyPhrases.join(' / ')}</p></article>
      <article className="panel"><h2>다시 말하기 (선택)</h2><p>모범 답안을 보며 최대 2분 동안 말해요. 받아쓰기만 하고 피드백은 다시 받지 않아요.</p><div className="opic-actions"><button className="btn btn-soft" onClick={() => { setRetelling(true); void record(true); }}>🎤 다시 말하기</button><button className="btn btn-soft" onClick={() => typeInstead(true)}>⌨️ 글로 다시 답하기</button></div>{attempt.retell && <p>처음 {attempt.words}단어 / 분당 {Math.round(attempt.wpm)} → 다시 {attempt.retell.words}단어 / 분당 {Math.round(attempt.retell.wpm)}</p>}</article>
      <label className="opic-check"><input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} /> 내 답안 노트에 저장</label><button className="btn btn-primary" onClick={saveNote}>연습 마치기</button>
    </>}
    {retelling && phase !== 'done' && feedback && <details open><summary>오늘의 모범 답안</summary><p lang="en" className="opic-text">{feedback.modelAnswer}</p></details>}
  </section>;
}
function OpicNotes() {
  const { state, update } = useStore(), data = state.data.parent.opic!;
  const [type, setType] = useState(''), [topic, setTopic] = useState(''), [editing, setEditing] = useState<string>(), [text, setText] = useState('');
  return <><h2>내 답안 노트</h2><div className="opic-actions"><label>유형<select value={type} onChange={e => setType(e.target.value)}><option value="">전체</option>{Object.entries(TYPE_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>주제<select value={topic} onChange={e => setTopic(e.target.value)}><option value="">전체</option>{Object.entries(TOPIC_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
    {!data.scripts.length && <p>아직 저장한 답안이 없어요.</p>}{[...data.scripts].reverse().filter(s => (!type || s.type === type) && (!topic || s.topic === topic)).map(s => <article key={s.id} className="panel"><h3>{TOPIC_NAMES[s.topic]} · {TYPE_NAMES[s.type]}</h3><p className="small">{s.createdAt} · 수정 {s.updatedAt}</p><details><summary>질문 보기</summary><p lang="en">{QUESTION_MAP.get(s.questionId)?.en}</p></details>{editing === s.id ? <><label>답안 고치기<textarea className="opic-answer" maxLength={1600} value={text} onChange={e => setText(e.target.value)} /></label><button className="btn btn-primary" disabled={!text.trim()} onClick={() => { update(draft => { const target = draft.data.parent.opic!.scripts.find(row => row.id === s.id); if (target) { target.text = text.trim(); target.updatedAt = toDateKey(); } }); setEditing(undefined); }}>고친 답안 저장</button></> : <p lang="en" className="opic-text">{s.text}</p>}<div className="opic-actions"><button className="btn btn-soft" onClick={() => void speak(s.text)}>🔊 답안 듣기</button><button className="btn btn-soft" onClick={() => { setEditing(s.id); setText(s.text); }}>고치기</button><button className="btn btn-ghost" onClick={() => { if (window.confirm('이 답안을 삭제할까요?')) update(draft => { draft.data.parent.opic!.scripts = draft.data.parent.opic!.scripts.filter(row => row.id !== s.id); }); }}>삭제</button></div></article>)}
  </>;
}
