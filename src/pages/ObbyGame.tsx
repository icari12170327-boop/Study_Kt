import { useGamePause } from '../components/useGamePause';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Level, ObbyColor, ObbyHat, ProfileId } from '../types';
import type { Go } from '../route';
import { useStore } from '../store/StoreContext';
import { toDateKey } from '../lib/date';
import { seededRng, type Rng } from '../lib/random';
import { buildLevelQueue } from '../content/math/session';
import { gradeAnswer, type AnswerInput } from '../content/math/grading';
import { buildFishPool } from '../content/games/fishing';
import { canPlay, finishGame, reserveGame, roundRemaining } from '../content/games/limits';
import { answerObstacle, checkpointsPassed, needsRefill, normalizeObby, OBBY_COLORS, OBBY_HATS, obbyScore, refillRun, startRun, unlockedHats } from '../content/games/obby';
import { TopBar } from '../components/common';
import { NumberPad } from '../components/NumberPad';
import { ObbyAvatar, ObbyCourse, OBBY_COLOR_LABELS, OBBY_HAT_LABELS } from '../components/ObbyCourse';

interface RunPlan { date: string; index: number; startedAt: number; grade: Level; level: number; rng: Rng; color: ObbyColor; hat?: ObbyHat }
export function ObbyGame({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const data = state.data[profileId], settings = state.settings[profileId], profile = state.profiles.find(row => row.id === profileId)!;
  const appearance = normalizeObby(data.obby), hats = unlockedHats(appearance.best);
  const [color, setColor] = useState(appearance.color), [hat, setHat] = useState<ObbyHat | undefined>(appearance.hat);
  const [mode, setMode] = useState<'prepare' | 'playing' | 'result'>('prepare');
  const { paused, now: gameNow, isPaused, resume } = useGamePause(mode === 'playing');
  const [run, setRun] = useState(() => startRun([])), runRef = useRef(run);
  const plan = useRef<RunPlan | undefined>(undefined), done = useRef(false);
  const [phase, setPhase] = useState<'idle' | 'jump' | 'fall'>('idle'), phaseRef = useRef(phase), motionUntil = useRef(0);
  const [remaining, setRemaining] = useState(90000), [message, setMessage] = useState('');
  const [input, setInput] = useState<AnswerInput>({}), nextButton = useRef<HTMLButtonElement>(null);
  const gate = canPlay(settings, data, toDateKey()), allowed = profileId !== 'parent' && profile.level !== 'adult';
  const persist = useCallback(() => {
    const current = plan.current;
    if (!current || done.current) return;
    done.current = true;
    const final = runRef.current;
    update(draft => {
      const target = draft.data[profileId];
      finishGame(target, current.index, { date: current.date, game: 'obby', score: obbyScore(final), stage: final.stage, caught: final.cleared.length, golden: final.cleared.filter(fish => fish.golden).length });
      target.obby = normalizeObby({ best: Math.max(normalizeObby(target.obby).best, final.stage), color: current.color, hat: current.hat });
    });
  }, [profileId, update]);
  const end = useCallback(() => { persist(); setMode('result'); }, [persist]);
  const start = useCallback(() => {
    if (plan.current || !allowed) return;
    const date = toDateKey(), snapshot = structuredClone(data), index = reserveGame(settings, snapshot, date, 'obby');
    if (index === null) return;
    const rng = seededRng(Math.floor(Math.random() * 0x100000000));
    const filler = buildLevelQueue(profile.level, data.math.level, [], 64, rng).map(row => row.problem);
    const initial = startRun(buildFishPool(data.days[date]?.mathAttempts ?? [], filler, 8));
    plan.current = { date, index, startedAt: gameNow(), grade: profile.level, level: data.math.level, rng, color, hat };
    runRef.current = initial; setRun(initial);
    update(draft => {
      reserveGame(draft.settings[profileId], draft.data[profileId], date, 'obby');
      draft.data[profileId].obby = normalizeObby({ ...draft.data[profileId].obby, color, hat });
    });
    setMode('playing');
  }, [allowed, color, data, hat, profile.level, profileId, settings, update, gameNow]);
  useEffect(() => {
    if (mode !== 'prepare') return;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229 || document.querySelector('.modal-backdrop, [aria-modal="true"], dialog[open]')) return;
      const target = event.target instanceof Element ? event.target : document.activeElement;
      if ([target, document.activeElement].some(element => element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'))) return;
      if (event.key === 'Enter') {
        if (target?.closest('button, a[href], [role="button"], [role="link"]')) return;
        event.preventDefault(); start();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const next = OBBY_COLORS[(OBBY_COLORS.indexOf(color) + (event.key === 'ArrowRight' ? 1 : -1) + OBBY_COLORS.length) % OBBY_COLORS.length];
        setColor(next);
        if (target?.closest('[data-obby-color]')) document.querySelector<HTMLButtonElement>(`[data-obby-color="${next}"]`)?.focus();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [mode, color, start]);
  useEffect(() => {
    if (mode !== 'playing' || paused) return;
    let frame = 0, lastPaint = 0, stopped = false;
    const tick = () => {
      if (stopped || done.current || isPaused()) return;
      const now = gameNow();
      const left = roundRemaining(plan.current!.startedAt, now);
      if (left === 0) { setRemaining(0); end(); return; }
      if (phaseRef.current !== 'idle' && now >= motionUntil.current) { phaseRef.current = 'idle'; setPhase('idle'); }
      if (now - lastPaint >= 100) { lastPaint = now; setRemaining(left); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [mode, end, paused, isPaused, gameNow]);
  // 일시정지는 판 종료가 아니다. 실제 화면 이탈에서만 예약한 판을 저장한다.
  useEffect(() => () => persist(), [persist]);
  const blocked = () => isPaused() || done.current || !plan.current || gameNow() < runRef.current.lockedUntil;
  const changeInput = (value: AnswerInput) => {
    if (blocked()) return;
    if (!roundRemaining(plan.current!.startedAt, gameNow())) { end(); return; }
    setInput(value);
  };
  const submit = () => {
    if (blocked()) return;
    const now = gameNow(), current = plan.current!;
    if (!roundRemaining(current.startedAt, now)) { end(); return; }
    const fish = runRef.current.queue[0];
    // 이전 문제의 확인 연타가 새 문제에 이전 답을 적용하지 않게 한다.
    if (!fish || fish.id !== run.queue[0]?.id) return;
    const result = gradeAnswer(fish.problem.answer, input);
    if (result.reason) { setMessage(result.reason); return; }
    let next = answerObstacle(runRef.current, result.correct, now);
    if (needsRefill(next)) {
      const batches = Array.from({ length: 3 }, () => buildLevelQueue(current.grade, current.level, [], 64, current.rng).map(row => row.problem));
      next = refillRun(next, batches);
    }
    runRef.current = next; setRun(next); setInput({});
    phaseRef.current = result.correct ? 'jump' : 'fall'; setPhase(phaseRef.current);
    motionUntil.current = result.correct ? now + 600 : next.lockedUntil;
    setMessage(result.correct ? next.cleared.length % 5 === 0 ? `🚩 체크포인트! +${fish.points}점 +20점` : `점프! +${fish.points}점` : '으악, 떨어졌다! 3초 뒤 다시 달려요.');
  };
  const back = () => {
    if (mode === 'playing' && !confirm('지금 끝낼까요? 시작한 판은 오늘 판 수에 포함돼요.')) return;
    if (mode === 'playing') end();
    go({ name: 'home', profileId });
  };
  const fish = run.queue[0];
  return <div className={`page reward-game obby-game ${paused ? 'game-paused' : ''}`}><TopBar title="🏃 오비 달리기" onBack={back} />
    {mode === 'prepare' ? <section className="panel form obby-prepare"><h2>내 캐릭터로 달려요!</h2>
      <div className="obby-preview"><ObbyAvatar color={color} hat={hat} /></div>
      <h3>몸 색 고르기</h3><div className="obby-colors" role="group" aria-label="몸 색">
        {OBBY_COLORS.map(value => <button key={value} className={`btn btn-soft obby-${value}`} data-obby-color={value} aria-pressed={color === value} onClick={() => setColor(value)}><span className="obby-color-swatch" />{OBBY_COLOR_LABELS[value]}</button>)}
      </div>
      <h3>모자 고르기</h3><div className="obby-hats" role="group" aria-label="모자">
        <button className="btn btn-soft" aria-pressed={!hat} onClick={() => setHat(undefined)}>모자 없이</button>
        {OBBY_HATS.map((value, index) => <button key={value} className="btn btn-soft" disabled={!hats.includes(value)} aria-pressed={hat === value} onClick={() => setHat(value)}>{OBBY_HAT_LABELS[value]} {hats.includes(value) ? '열렸어요' : `Stage ${(index + 1) * 10}에서 열려요`}</button>)}
      </div>
      <p>내 최고 Stage {appearance.best}</p><p>90초 동안 문제를 맞혀 장애물을 넘어요. 5개를 넘을 때마다 체크포인트! 틀리면 3초 쉬고 다시 달려요.</p>
      {(!allowed || !gate.ok) && <p role="status">{!allowed || !gate.ok && gate.reason === 'math-not-done' ? '🔒 수학 미션을 끝내면 열려요' : '오늘 판 수를 모두 썼어요. 내일 또 만나요!'}</p>}
      <button className="btn btn-primary wide" disabled={!allowed || !gate.ok} onClick={start}>🏃 달리기 시작</button>
      <p className="small muted">← → 색 고르기 · Enter 시작. 시작하면 오늘 판 수에 포함돼요. 별과 쿠폰에 더하지 않아요.</p>
    </section> : mode === 'result' ? <section className="panel done"><div className="done-emoji">🏁</div><h2>달리기 끝!</h2>
      <h3>도달 Stage {run.stage}</h3><p>넘은 장애물 {run.cleared.length}개 · 🔥 용암 {run.cleared.filter(row => row.golden).length}개</p>
      <strong className="game-score">{obbyScore(run)}점</strong><p>🚩 체크포인트 {checkpointsPassed(run.cleared.length)}개 · 내 최고 Stage {Math.max(appearance.best, run.stage)}</p>
      {unlockedHats(run.stage).length > 0 && <p>열린 모자: {unlockedHats(Math.max(appearance.best, run.stage)).map(value => OBBY_HAT_LABELS[value]).join(' ')}</p>}
      <p className="small muted">게임 점수는 별과 학습 기록에 더하지 않아요.</p><button className="btn btn-primary" onClick={() => go({ name: 'home', profileId })}>홈으로</button>
    </section> : <>
      <div className="game-status"><strong role="timer" aria-label="남은 시간">⏱ {Math.ceil(remaining / 1000)}초</strong><strong>Stage {run.stage}</strong><span>{obbyScore(run)}점</span></div>
      {paused && <section className="panel game-pause" role="dialog" aria-modal="true" aria-label="게임 일시정지" onKeyDown={event => { if (event.key === 'Tab') { event.preventDefault(); event.currentTarget.querySelector('button')?.focus(); } }}><h2>잠깐 쉬고 있어요</h2><p>남은 시간은 그대로예요.</p><button className="btn btn-primary" autoFocus onClick={resume}>계속하기</button></section>}
      <ObbyCourse run={run} color={color} hat={hat} phase={phase} />
      {fish && <section className="question-card"><span className={`badge ${fish.golden ? 'badge-warn' : ''}`}>{fish.golden ? '🔥 용암 · 30점' : '장애물 · 10점'}</span>
        {fish.problem.answer.kind === 'fraction' && <p className="small muted">기약분수로 답해요. 대분수는 자연수 칸도 채워요.</p>}
        <NumberPad key={`${run.stage}-${run.falls}`} kind={fish.problem.answer.kind} value={input} onChange={changeInput} onSubmit={submit} onNext={() => {}} nextButtonRef={nextButton} onActivity={() => {}} disabled={paused || phase === 'fall'} />
      </section>}
      {message && <p className={`feedback ${phase === 'fall' ? 'bad' : 'ok'}`} role="status">{message}{phase === 'fall' && ` (${Math.max(0, Math.ceil((run.lockedUntil - gameNow()) / 1000))}초)`}</p>}
    </>}
  </div>;
}
