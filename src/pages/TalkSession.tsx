import { BusinessFeedback } from '../components/BusinessFeedback';
import { BUSINESS_SCENARIOS, businessRequest, isShortFeedback, rememberSituation, scenarioTitle } from '../lib/business';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '../store/StoreContext';
import type { ProfileId, TalkLine, TalkLog, TalkSettings } from '../types';
import type { Go } from '../route';
import { ProgressBar, TopBar } from '../components/common';
import { AiError, fetchUsage, generate, type AiConfig } from '../lib/ai';
import { startTalk, type TalkHandle, type TalkState } from '../lib/realtime';
import { aiReady, defaultTalkSettings, englishRatio, isTalkSummary, maskSubtitle, recordTalkSeconds, summaryLines, talkRequest, talkSignals, talkTopics } from '../lib/talk';
import { toDateKey } from '../lib/date';
import { scienceTalkTopics } from '../content/science/session';
import { uid } from '../lib/random';

type StreamLine = TalkLine & { itemId: string; done: boolean };
interface Run {
  id: string;
  date: string;
  cfg: AiConfig;
  settings: TalkSettings;
  memory: string;
  business?: { scenarioId: string; situation?: string };
  start?: number;
  cap: number;
  credited: number;
  savedSeconds: number;
  carry: number;
  lines: StreamLine[];
  finished: boolean;
  paused: boolean;
  stuckSent: boolean;
  wrapSent: boolean;
  friendFinishedAt?: number;
  handle?: TalkHandle;
  timer?: ReturnType<typeof setInterval>;
  abort: AbortController;
}
const duration = (seconds: number) => `${Math.floor(seconds / 60)}분 ${Math.floor(seconds % 60)}초`;
const childErrors: Record<AiError['kind'], string> = {
  unauthorized: '보호자에게 AI 연결을 확인해 달라고 부탁하세요.',
  limit: '오늘 대화 시간을 다 썼어요. 내일 다시 친구를 만나요!',
  busy: '다른 기기에서 대화 중이에요. 보호자 모드 → AI 연결에서 끝낼 수 있어요.',
  unsafe: '지금은 이 이야기를 이어 갈 수 없어요. 보호자에게 알려 주세요.',
  'mic-denied': '마이크를 켤 수 없어요. 보호자에게 마이크 권한을 부탁하세요.',
  network: '연결이 끊겼어요. 인터넷을 확인하고 다시 만나요.',
  server: '지금은 친구와 연결하지 못했어요. 조금 뒤 다시 만나요.',
};

function Subtitle({ line, percent, onPeek }: { line: StreamLine; percent: number; onPeek: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const clear = () => clearTimeout(timer.current);
  if (line.role === 'kid') return <p className="talk-kid"><span>나:</span> {line.text}</p>;
  return <button className="talk-subtitle" aria-label="꾹 눌러 자막 보기" lang="en"
    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); clear(); timer.current = setTimeout(onPeek, 500); }}
    onPointerUp={clear} onPointerCancel={clear} onContextMenu={(event) => event.preventDefault()}
    onKeyDown={(event) => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); onPeek(); } }}>
    {line.peeked ? line.text : maskSubtitle(line.text, percent, line.itemId, line.done)}
    {line.peeked && <span className="small muted"> · 자막을 봤어요</span>}
  </button>;
}

export function TalkSession({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const profile = state.profiles.find((p) => p.id === profileId)!;
  const business = profileId === 'parent' && profile.level === 'adult';
  const settings = state.settings[profileId].talk ?? defaultTalkSettings(profile.level, profileId);
  const [phase, setPhase] = useState<'ready' | 'connecting' | 'talking' | 'done' | 'error'>('ready');
  const [talkState, setTalkState] = useState<TalkState>('ended');
  const [remaining, setRemaining] = useState<number>();
  const [topic, setTopic] = useState('');
  const [scenarioId, setScenarioId] = useState<string>('biz-standup'), [situation, setSituation] = useState('');
  const [alternatives, setAlternatives] = useState<{ said: string; values: string[] }>();
  const [shortPending, setShortPending] = useState(false), [shortError, setShortError] = useState('');
  const shortBusy = useRef(false);
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [error, setError] = useState('');
  const [doneLog, setDoneLog] = useState<TalkLog>();
  const [summaryPending, setSummaryPending] = useState(false);
  const alive = useRef(true);
  const runRef = useRef<Run | undefined>(undefined);
  const leave = useRef<(() => void) | undefined>(undefined);
  const transcript = useRef<HTMLDivElement>(null);
  const endpoint = state.ai.endpoint, token = state.ai.token;

  useEffect(() => {
    alive.current = true;
    const hide = () => flushSync(() => leave.current?.());
    window.addEventListener('pagehide', hide);
    return () => {
      alive.current = false;
      window.removeEventListener('pagehide', hide);
      leave.current?.();
    };
  }, [profileId]);
  useEffect(() => {
    let active = true;
    const cfg = { endpoint, token };
    if (aiReady(cfg)) void fetchUsage(cfg).then((usage) => {
      if (active) setRemaining(usage.remainingSeconds?.[profileId] ?? Math.max(0, settings.dailyMinutes * 60 - usage.today[profileId].talkSeconds));
    }).catch((e: unknown) => {
      if (active) setError(business && e instanceof AiError ? e.message : childErrors[e instanceof AiError ? e.kind : 'server']);
    });
    return () => { active = false; };
  }, [endpoint, token, profileId, settings.dailyMinutes, business]);
  useEffect(() => { if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; }, [lines]);

  const elapsed = (run: Run) => run.start === undefined ? 0 : Math.min(run.cap, Math.max(0, Math.floor((performance.now() - run.start) / 1000)));
  const credit = (run: Run, seconds: number, final = false) => {
    const minutes = Math.floor((run.carry + seconds) / 60), amount = seconds - run.savedSeconds;
    if (amount <= 0 || (!final && minutes <= run.credited)) return;
    run.credited = minutes;
    run.savedSeconds = seconds;
    update((draft) => { recordTalkSeconds(draft.data[profileId], draft.settings[profileId], run.date, amount, aiReady(draft.ai)); });
  };
  const summarize = async (run: Run, log: TalkLog) => {
    const input = summaryLines(log.lines);
    if (!input.length) return;
    if (alive.current) setSummaryPending(true);
    try {
      const summary = await generate(run.cfg, { profileId, level: profile.level, kind: 'talk-summary', input: { lines: input } });
      if (!isTalkSummary(summary)) throw new AiError('server');
      update((draft) => {
        const stored = draft.data[profileId].talks.find((talk) => talk.id === log.id);
        if (stored) { stored.summary = summary; stored.flagged = summary.flagged; }
      });
      if (alive.current) setDoneLog((old) => old?.id === log.id ? { ...old, summary, flagged: summary.flagged } : old);
      const memory = await generate(run.cfg, { profileId, level: profile.level, kind: 'memory-merge', input: { memory: run.memory, summary } });
      if (typeof memory !== 'string' || memory.length > 1500) throw new AiError('server');
      update((draft) => {
        const data = draft.data[profileId];
        // 기록 삭제나 보호자의 기억 편집을 늦은 응답으로 되돌리지 않는다.
        if (data.talks.some((talk) => talk.id === log.id) && data.friendMemory === run.memory) data.friendMemory = memory;
      });
    } catch {
      // 요약·기억 갱신 실패와 무관하게 대화 기록과 미션 진행은 이미 저장했다.
    } finally {
      if (alive.current) setSummaryPending(false);
    }
  };
  const finish = (run: Run) => {
    if (run.finished) return;
    run.finished = true;
    clearInterval(run.timer);
    run.abort.abort();
    void run.handle?.stop();
    const seconds = elapsed(run);
    credit(run, seconds, true);
    if (run.start !== undefined) {
      const log: TalkLog = { ...(run.business ?? {}), id: run.id, date: run.date, seconds, lines: run.lines.map(({ role, text, at, peeked }) => ({ role, text, at, ...(peeked ? { peeked } : {}) })), englishRatio: englishRatio(run.lines) };
      update((draft) => {
        const data = draft.data[profileId];
        if (!data.talks.some((talk) => talk.id === log.id)) data.talks = [...data.talks, log].slice(-60);
      });
      if (alive.current) { setDoneLog(log); setPhase('done'); setRemaining(Math.max(0, run.cap - seconds)); }
      if (!run.business) void summarize(run, log);
    } else if (alive.current) setPhase('error');
  };
  const stuck = (run: Run) => {
    if (run.finished || run.stuckSent || run.paused) return;
    run.stuckSent = true;
    run.handle?.sendSystemNote('[STUCK]');
  };
  const start = async () => {
    if (runRef.current && !runRef.current.finished) return;
    if (!aiReady(state.ai) || (profile.level === 'adult' && !business) || (business && scenarioId === 'biz-custom' && !situation.trim())) return;
    const run: Run = { id: uid(), date: toDateKey(), cfg: { ...state.ai }, settings: { ...settings, ...(business ? { pushToTalk: false, subtitleHidePercent: 0 } : {}) }, memory: state.data[profileId].friendMemory,
      cap: 0, credited: 0, savedSeconds: 0, carry: (state.data[profileId].days[toDateKey()]?.talkSeconds ?? 0) % 60,
      ...(business ? { business: { scenarioId, ...(scenarioId === 'biz-custom' ? { situation: situation.trim() } : {}) } } : {}),
      lines: [], finished: false, paused: false, stuckSent: false, wrapSent: false, abort: new AbortController() };
    runRef.current = run;
    leave.current = () => finish(run);
    setPhase('connecting'); setError(''); setAlternatives(undefined); setShortError(''); setLines([]); setPaused(false); setPressing(false);
    const append = (itemId: string, role: TalkLine['role'], text: string, done: boolean) => {
      if (run.finished) return;
      const old = run.lines.find((line) => line.itemId === itemId && line.role === role);
      if (old) { old.text = (done ? text : old.text + text).slice(0, 2000); old.done = done; }
      else run.lines.push({ itemId, role, text: text.slice(0, 2000), at: Date.now(), done });
      if (alive.current) setLines(run.lines.slice(-60).map((line) => ({ ...line })));
    };
    try {
      const request = business ? businessRequest(scenarioId, situation, run.memory) : talkRequest(profileId, profile.level, settings, run.memory, topic);
      const handle = await startTalk(run.cfg, request, {
        onState: (value) => {
          if (alive.current) setTalkState(value);
          if (value === 'ended') finish(run);
        },
        onConnected: (seconds) => {
          if (run.finished) return;
          run.start = performance.now(); run.cap = seconds;
          if (run.business?.situation) update(draft => { rememberSituation(draft.data.parent, run.business!.situation!); });
          if (alive.current) { setPhase('talking'); setRemaining(seconds); }
          run.timer = setInterval(() => {
            if (run.finished) return;
            const seconds = elapsed(run), left = Math.max(0, run.cap - seconds);
            credit(run, seconds);
            if (alive.current) setRemaining(left);
            const signals = talkSignals({ remaining: left, now: performance.now(), friendFinishedAt: run.friendFinishedAt, stuckSent: run.stuckSent, wrapSent: run.wrapSent, paused: run.paused });
            if (signals.wrapUp) { run.wrapSent = true; run.handle?.sendSystemNote('[WRAP_UP]'); }
            if (signals.stuck) stuck(run);
            if (!left) finish(run);
          }, 1000);
        },
        onAssistantText: (id, text, done) => append(id, 'friend', text, done),
        onUserText: (id, text) => append(id, 'kid', text, true),
        onUserSpeaking: () => { run.stuckSent = false; run.friendFinishedAt = undefined; },
        onFriendFinished: () => { run.friendFinishedAt = performance.now(); },
        onCharged: (seconds) => {
          if (run.start === undefined) return;
          finish(run);
          const additional = Math.max(0, seconds - run.savedSeconds);
          run.savedSeconds += additional;
          update((draft) => {
            const data = draft.data[profileId];
            const log = data.talks.find((talk) => talk.id === run.id);
            if (!log) return;
            if (additional) recordTalkSeconds(data, draft.settings[profileId], run.date, additional, aiReady(draft.ai));
            log.seconds = Math.max(log.seconds, seconds);
          });
          if (alive.current) setDoneLog((old) => old?.id === run.id ? { ...old, seconds: Math.max(old.seconds, seconds) } : old);
        },
        onError: (e) => {
          if (alive.current && runRef.current === run) setError(business ? e.message : childErrors[e.kind]);
          if (run.start !== undefined) finish(run);
        },
      }, run.abort.signal);
      run.handle = handle;
      if (run.finished || !alive.current) await handle.stop();
    } catch (e) {
      if (alive.current && !run.finished) { setError(business && e instanceof AiError ? e.message : childErrors[e instanceof AiError ? e.kind : 'server']); setPhase('error'); }
      finish(run);
    }
  };
  const improve = async (run: Run) => {
    const said = [...run.lines].reverse().find(line => line.role === 'kid' && line.done && line.text.trim())?.text;
    if (!run.business || run.finished || shortBusy.current || !said) return;
    shortBusy.current = true; setShortPending(true); setShortError('');
    try {
      const result = await generate(run.cfg, { profileId: 'parent', level: 'adult', kind: 'biz-feedback', input: { mode: 'short', text: said } });
      if (!isShortFeedback(result)) throw new AiError('server');
      if (alive.current && !run.finished && runRef.current === run) setAlternatives({ said, values: result.alternatives });
    } catch (e) {
      if (alive.current && !run.finished) setShortError(e instanceof AiError ? e.message : '대안 표현을 받지 못했어요.');
    } finally {
      shortBusy.current = false; if (alive.current) setShortPending(false);
    }
  };
  const back = () => { leave.current?.(); go({ name: 'home', profileId }); };
  const run = runRef.current;
  const friendName = business ? 'Alex' : run?.settings.friendName ?? settings.friendName;
  const mission = state.settings[profileId].missions.find((m) => m.type === 'talk');
  const completed = (state.data[profileId].days[toDateKey()]?.progress.talk ?? 0) >= (mission?.target ?? settings.dailyMinutes);
  const peek = (itemId: string) => {
    const line = runRef.current?.lines.find((line) => line.itemId === itemId && line.role === 'friend');
    if (line) { line.peeked = true; setLines(runRef.current!.lines.slice(-60).map((line) => ({ ...line }))); }
  };
  return <div className="page talk-page">
    <TopBar title={business ? '💼 비즈니스 프리토킹' : `🗣️ ${friendName}와 대화`} onBack={back} />
    {error && <p className="panel bad-text" role="alert">{error}</p>}
    {error && phase === 'ready' && <button className="btn" onClick={back}>홈으로</button>}
    {phase === 'ready' && <div className="panel talk-ready">
      <div className="talk-avatar" aria-hidden="true">{business ? '💼' : profileId === 'kid1' ? '🤖' : '🐻'}</div>
      <h2>{business ? '어떤 상황을 연습할까요?' : `${settings.friendName}와 무슨 이야기 할까요?`}</h2>
      <p>{remaining === undefined ? '오늘 남은 시간을 확인하고 있어요.' : `오늘 남은 시간 ${duration(remaining)}`}</p>
      {business ? <>
        <div className="business-scenarios" role="group" aria-label="비즈니스 상황">
          {BUSINESS_SCENARIOS.map(row => <button key={row.id} className={`business-scenario ${scenarioId === row.id ? 'on' : ''}`} aria-pressed={scenarioId === row.id} onClick={() => setScenarioId(row.id)}><strong>{row.title}</strong><span className="small muted">상대: {row.role}</span></button>)}
        </div>
        {scenarioId === 'biz-custom' && <div className="form">
          <label><span id="biz-situation">내 상황</span><textarea aria-labelledby="biz-situation" rows={4} maxLength={300} value={situation} onChange={event => setSituation(event.target.value)} placeholder="다음 주 화요일 싱가포르 파트너사와 일정 지연을 설명하는 화상 회의. 상대는 프로젝트 매니저." /></label>
          <p className="small muted">회사 이름, 사람 이름, 숫자 같은 민감한 정보는 빼고 적어 주세요. · {situation.length} / 300자</p>
          {!!state.data.parent.bizSituations?.length && <><h3>최근 입력 상황</h3><div className="chip-wrap">{state.data.parent.bizSituations.map(value => <button className="chip business-situation" key={value} onClick={() => setSituation(value)}>{value}</button>)}</div></>}
        </div>}
      </> : <>
      <div className="chip-wrap">{[...new Set([...scienceTalkTopics(state.data[profileId], toDateKey()), ...talkTopics(settings, state.data[profileId].talks)])].map((value) => <button key={value} className={`chip ${topic === value ? 'on' : ''}`} lang={value.startsWith('오늘 과학:') ? 'ko' : 'en'} onClick={() => setTopic(value)}>{value}</button>)}<button className={`chip ${!topic ? 'on' : ''}`} onClick={() => setTopic('')}>아무 얘기나</button></div>
      </>}
      <p>처음에는 마이크 사용을 허용해 주세요. 헤드셋을 쓰면 더 잘 들려요.</p>
      {!aiReady(state.ai) && <p>{business ? '보호자 모드에서 AI 연결을 설정해 주세요.' : '보호자에게 AI 연결을 부탁하세요.'}</p>}
      {remaining === 0 && <p>{business ? '오늘 대화 시간을 다 썼어요. 내일 다시 연습해 주세요.' : '오늘 대화 시간을 다 썼어요. 내일 다시 친구를 만나요!'}</p>}
      <button className="btn btn-primary btn-lg" disabled={!aiReady(state.ai) || (profile.level === 'adult' && !business) || (business && scenarioId === 'biz-custom' && !situation.trim()) || remaining === undefined || remaining === 0} onClick={() => { void start(); }}>대화 시작</button>
      {business && <p className="small muted">AI는 대화 중 교정하지 않아요. 필요한 순간에 대안 표현을 받고, 끝난 뒤 피드백을 확인해요.</p>}
    </div>}
    {phase === 'connecting' && <div className="panel"><p role="status">{business ? '대화 상대와 연결하고 있어요…' : '친구와 연결하고 있어요…'}</p><button className="btn" onClick={back}>홈으로</button></div>}
    {phase === 'talking' && run && <>
      <div className="panel talk-status">
        <div className={`talk-avatar ${talkState === 'speaking' ? 'talk-speaking' : ''}`} aria-hidden="true">{paused ? '⏸️' : talkState === 'thinking' ? '💭' : talkState === 'speaking' ? '🗨️' : '👂'}</div>
        <p role="status">{paused ? '잠깐 쉬는 중' : talkState === 'thinking' ? '생각 중' : talkState === 'speaking' ? '말하는 중' : '듣는 중'}</p>
        <p>남은 시간 {duration(remaining ?? 0)}</p><ProgressBar value={remaining ?? 0} max={run.cap} />
        {completed && <p className="good-text">오늘 미션 완료! 더 이야기해도 돼</p>}
      </div>
      <p className="small muted">{business ? `${scenarioTitle(run.business?.scenarioId)} · 전체 자막을 보여요. 최근 60줄을 보여 주고 있어요.` : '자막을 꾹 누르면 그 문장이 보여요. 최근 60줄을 보여 주고 있어요.'}</p>
      <div className="talk-lines" ref={transcript} role="log" aria-label="대화 자막">{lines.map((line) => business ? <p className={line.role === 'kid' ? 'talk-kid' : 'talk-subtitle'} key={`${line.role}:${line.itemId}`} lang="en"><span>{line.role === 'kid' ? '나:' : 'Alex:'}</span> {line.text}</p> : <Subtitle key={`${line.role}:${line.itemId}`} line={line} percent={run.settings.subtitleHidePercent} onPeek={() => peek(line.itemId)} />)}</div>
      {!business && run.settings.pushToTalk && <button className={`btn btn-primary talk-ptt ${pressing ? 'on' : ''}`} disabled={paused} aria-pressed={pressing}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); run.handle?.beginPushToTalk(); setPressing(true); }}
        onPointerUp={() => { run.handle?.endPushToTalk(); setPressing(false); }} onPointerCancel={() => { run.handle?.endPushToTalk(); setPressing(false); }}
        onKeyDown={(event) => { if ([' ', 'Enter'].includes(event.key) && !event.repeat) { event.preventDefault(); run.handle?.beginPushToTalk(); setPressing(true); } }}
        onKeyUp={(event) => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); run.handle?.endPushToTalk(); setPressing(false); } }}
        onBlur={() => { run.handle?.endPushToTalk(); setPressing(false); }}>🎤 누르는 동안 말하기</button>}
      <div className="row-center talk-controls">
        <button className="btn btn-soft" disabled={paused} onClick={() => stuck(run)}>{business ? '💡 도움' : '🤔 막혔어요'}</button>
        {business && <button className="btn btn-soft" disabled={shortPending || !lines.some(line => line.role === 'kid' && line.done && line.text.trim())} onClick={() => { void improve(run); }}>방금 내 말 더 자연스럽게</button>}
        <button className="btn" onClick={() => {
          run.paused = !run.paused; run.friendFinishedAt = undefined;
          if (run.settings.pushToTalk) run.handle?.endPushToTalk();
          run.handle?.setMicEnabled(!run.paused && !run.settings.pushToTalk);
          setPressing(false); setPaused(run.paused);
        }}>{paused ? '다시 이야기' : '잠깐 멈춤'}</button>
        <button className="btn" onClick={() => finish(run)}>끝내기</button>
      </div>
      {business && shortPending && <p role="status">대안 표현을 찾고 있어요. 대화는 계속할 수 있어요.</p>}
      {business && shortError && <p className="bad-text" role="alert">{shortError}</p>}
      {business && alternatives && <aside className="panel business-alternatives"><h3>더 자연스러운 표현</h3><p className="small muted" lang="en">내 말: {alternatives.said}</p>{alternatives.values.map(value => <p key={value} lang="en">{value}</p>)}</aside>}
      {paused && <p className="small muted">마이크가 꺼졌어요. 연결 시간은 계속 지나가요.</p>}
    </>}
    {phase === 'done' && doneLog && business && <><div className="panel"><h2>{scenarioTitle(doneLog.scenarioId)} · {duration(doneLog.seconds)} 연습했어요</h2><p>대화 기록과 미션 진행을 저장했어요.</p></div><BusinessFeedback key={doneLog.id} log={doneLog} auto /><button className="btn btn-primary" onClick={back}>홈으로</button></>}
    {phase === 'done' && doneLog && !business && <div className="panel form">
      <div className="talk-avatar" aria-hidden="true">👋</div><h2>{friendName}와 {duration(doneLog.seconds)} 이야기했어요!</h2>
      <p>완성한 1분마다 별을 받았어요. 하루 별은 미션 목표까지만 모을 수 있어요.</p>
      {summaryPending && <p role="status">오늘 이야기를 정리하고 있어요…</p>}
      {doneLog.summary ? <><h3>오늘 {friendName}랑 한 이야기</h3><div className="chip-wrap">{doneLog.summary.topicsKo.map((value) => <span className="chip" key={value}>{value}</span>)}</div><h3>다음에 {friendName}가 물어볼 것</h3><div className="chip-wrap">{doneLog.summary.nextTopics.map((value) => <span className="chip" key={value}>{value}</span>)}</div></> : !summaryPending && <p>대화 기록을 저장했어요.</p>}
      <button className="btn btn-primary" onClick={back}>홈으로</button>
    </div>}
    {phase === 'error' && <div className="panel"><p>{business ? 'AI 연결을 확인하고 다시 시도해 주세요.' : '보호자와 함께 확인하고 다시 만나요.'}</p><button className="btn btn-primary" onClick={back}>홈으로</button></div>}
  </div>;
}
