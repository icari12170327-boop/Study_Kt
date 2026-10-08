import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProfileId } from '../types';
import type { Go } from '../route';
import type { Fish } from '../content/games/fishing';
import { availableFish, fishingKeyAction, fishingScore, refillFishPool } from '../content/games/fishing';
import { finishGame, roundRemaining } from '../content/games/limits';
import { gradeAnswer, type AnswerInput } from '../content/math/grading';
import { seededRng } from '../lib/random';
import { buildLevelQueue } from '../content/math/session';
import { formatAnswer } from '../content/math/skills';
import { useStore } from '../store/StoreContext';
import { TopBar } from '../components/common';
import { NumberPad } from '../components/NumberPad';
import { FishPond } from '../components/FishPond';
import { useGameClock } from '../components/GameClock';

export interface FishingPlan { pool: Fish[]; index: number; date: string; seed: number }
export function FishingGame({ profileId, go, plan }: { profileId: ProfileId; go: Go; plan: FishingPlan }) {
  const { state, update } = useStore();
  const [pool, setPool] = useState(plan.pool), poolRef = useRef(plan.pool);
  const [fillerSource] = useState(() => ({ rng: seededRng(plan.seed), grade: state.profiles.find(p => p.id === profileId)!.level, level: state.data[profileId].math.level }));
  const visibleRef = useRef<Fish[]>([]), cursorRef = useRef(0);
  const [startedAt] = useState(() => performance.now());
  const [ended, setEnded] = useState(false), done = useRef(false);
  const caught = useRef<Fish[]>([]), cooldown = useRef(new Map<string, number>());
  const [cursor, setCursor] = useState(0), [selected, setSelected] = useState<Fish>();
  const active = useRef<Fish | undefined>(undefined), answered = useRef(false);
  const [input, setInput] = useState<AnswerInput>({}), [feedback, setFeedback] = useState<{ counted: boolean; correct: boolean; message: string }>();
  const nextButton = useRef<HTMLButtonElement>(null);
  const end = useCallback(() => {
    if (done.current) return;
    done.current = true; active.current = undefined; setSelected(undefined); setEnded(true);
    const record = { date: plan.date, game: 'fishing' as const, score: fishingScore(caught.current), caught: caught.current.length, golden: caught.current.filter(fish => fish.golden).length };
    update(draft => { finishGame(draft.data[profileId], plan.index, record); });
  }, [plan, profileId, update]);
  const remaining = useGameClock(startedAt, !ended, end);
  const visible = availableFish(pool, caught.current, cooldown.current, performance.now());
  useEffect(() => { visibleRef.current = visible; }, [visible]);
  const moveCursor = useCallback((index: number) => { cursorRef.current = index; setCursor(index); }, []);
  const choose = useCallback((fish: Fish) => {
    if (done.current || active.current || !availableFish(poolRef.current, caught.current, cooldown.current, performance.now()).some(row => row.id === fish.id)) return;
    if (!roundRemaining(startedAt, performance.now())) { end(); return; }
    active.current = fish; answered.current = false; setSelected(fish); setInput({}); setFeedback(undefined);
  }, [startedAt, end]);
  const close = useCallback(() => {
    active.current = undefined; answered.current = false; setSelected(undefined); setFeedback(undefined); setInput({});
  }, []);
  useEffect(() => {
    if (ended) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229 || document.querySelector('.modal-backdrop, [aria-modal="true"], dialog[open]')) return;
      if (active.current) { if (event.key === 'Escape' && !event.repeat) { event.preventDefault(); close(); } return; }
      const target = event.target instanceof Element ? event.target : document.activeElement;
      if ([target, document.activeElement].some(element => element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return;
      if (event.key === 'Enter' && target?.closest('button, a[href], [role="button"], [role="link"]') && !target.closest('.fish-pond')) return;
      const rows = visibleRef.current, focused = target?.closest<HTMLElement>('[data-fish-id]');
      const focusedIndex = focused ? rows.findIndex(fish => fish.id === focused.dataset.fishId) : undefined;
      const action = fishingKeyAction(event.key, rows.length, cursorRef.current, focusedIndex);
      if (!action) return;
      event.preventDefault(); if (event.repeat) return;
      if (action.type === 'choose') choose(rows[action.index]);
      else {
        moveCursor(action.index);
        if (focused) document.querySelector<HTMLButtonElement>(`[data-fish-id="${rows[action.index].id}"]`)?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [ended, choose, close, moveCursor]);
  const submit = () => {
    const fish = active.current;
    if (!fish || answered.current || done.current) return;
    if (!roundRemaining(startedAt, performance.now())) { end(); return; }
    const result = gradeAnswer(fish.problem.answer, input);
    if (result.reason) { setFeedback({ counted: false, correct: false, message: result.reason }); return; }
    answered.current = true;
    if (result.correct) {
      caught.current.push(fish);
      if (poolRef.current.length - caught.current.length < 8) {
        const filler = buildLevelQueue(fillerSource.grade, fillerSource.level, [], 64, fillerSource.rng).map(row => row.problem);
        poolRef.current = refillFishPool(poolRef.current, caught.current, filler);
        setPool(poolRef.current);
      }
    } else cooldown.current.set(fish.id, performance.now() + 5000);
    setFeedback({ counted: true, correct: result.correct, message: result.correct ? `잡았어요! +${fish.points}점 🎣` : `물고기가 도망갔어요. 정답은 ${formatAnswer(fish.problem)}. 곧 다시 만나요!` });
  };
  const score = fishingScore(caught.current);
  const back = () => {
    if (!ended && !confirm('지금 끝낼까요? 시작한 판은 오늘 판 수에 포함돼요.')) return;
    if (!ended) end();
    go({ name: 'home', profileId });
  };
  return <div className="page reward-game"><TopBar title="🎣 오늘의 낚시" onBack={back} />
    {ended ? <section className="panel done"><div className="done-emoji">🎣</div><h2>낚시 끝!</h2><p>잡은 물고기 {caught.current.length}마리 · 금빛 {caught.current.filter(fish => fish.golden).length}마리</p><strong className="game-score">{score}점</strong><p>오늘 최고 {Math.max(score, ...(state.data[profileId].games ?? []).filter(row => row.date === plan.date && row.game === 'fishing').map(row => row.score))}점</p><p className="small muted">게임 점수는 별과 학습 기록에 더하지 않아요.</p><button className="btn btn-primary" onClick={() => go({ name: 'home', profileId })}>홈으로</button></section> : <>
      <div className="game-status" role="timer" aria-label="남은 시간"><strong>⏱ {Math.ceil(remaining / 1000)}초</strong><span>{score}점 · {caught.current.length}마리</span></div>
      {selected ? <section className="question-card"><span className={`badge ${selected.golden ? 'badge-warn' : ''}`}>{selected.golden ? '금빛 물고기 · 30점' : '물고기 · 10점'}</span><h2 className="question-text">{selected.problem.question}</h2>
        {selected.problem.answer.kind === 'fraction' && <p className="small muted">기약분수로 답해요. 대분수는 자연수 칸도 채워요.</p>}
        <NumberPad key={selected.id} kind={selected.problem.answer.kind} value={input} onChange={setInput} onSubmit={submit} onNext={() => { if (answered.current) close(); }} nextButtonRef={nextButton} onActivity={() => {}} disabled={feedback?.counted} />
        {feedback && <p className={`feedback ${feedback.correct ? 'ok' : 'bad'}`} role="status">{feedback.message}</p>}
        {feedback?.counted && <button ref={nextButton} className="btn btn-primary wide" onClick={close}>물고기 고르기</button>}
        <button className="btn btn-ghost wide" onClick={close}>닫기 · Esc</button>
      </section> : <><p className="small muted">물고기를 눌러 문제를 풀어요. 금빛은 오늘 틀린 문제예요.</p><FishPond fish={visible} cursor={visible.length ? cursor % visible.length : 0} onChoose={choose} onCursor={moveCursor} /><p className="small muted">← → 고르기 · Enter 문제 열기 · Esc 닫기</p></>}
    </>}
  </div>;
}
