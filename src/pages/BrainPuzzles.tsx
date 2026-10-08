import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import type { Go } from '../route';
import type { Cell } from '../content/math/bingo';
import { generatePuzzle, GENERATORS, PUZZLE_LABELS, registeredPuzzleTypes } from '../content/puzzles/registry';
import { adjustPuzzleLevel, defaultPuzzleLevel, normalizePuzzleSettings, puzzleSummary, recordPuzzle, recordPuzzleExit } from '../content/puzzles/state';
import { pausePuzzleClock, puzzleActivity, puzzleActiveMs, puzzlePaused, PUZZLE_HINT_MS, startPuzzleClock } from '../content/puzzles/activity';
import type { Puzzle, PuzzleResult, PuzzleType } from '../content/puzzles/types';
import { PUZZLE_RENDERERS } from '../components/puzzles/renderers';
import { NumberPad } from '../components/NumberPad';
import { TopBar } from '../components/common';
import { toDateKey } from '../lib/date';

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
const available = () => registeredPuzzleTypes().filter(type => !!PUZZLE_RENDERERS[type]);
interface Play { puzzle: Puzzle; random: boolean; input: unknown; selected: Cell; wrong: number; hinted: boolean; finished: boolean; revealed: boolean }

export function BrainPuzzles({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state } = useStore();
  const profile = state.profiles.find(row => row.id === profileId)!;
  if (profileId === 'parent' || profile.level === 'adult' || !normalizePuzzleSettings(state.settings[profileId].puzzles).enabled) {
    return <div className="page"><TopBar title="🧩 두뇌 퍼즐" onBack={() => go({ name: 'home', profileId })} /><p>보호자가 두뇌 퍼즐을 켜면 놀 수 있어요.</p></div>;
  }
  return <PuzzlePlay profileId={profileId} go={go} />;
}
function PuzzlePlay({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const profile = state.profiles.find(row => row.id === profileId)!;
  const [play, setPlay] = useState<Play | null>(null);
  const live = useRef(play); live.current = play;
  const clock = useRef(startPuzzleClock(Date.now()));
  const [now, setNow] = useState(Date.now);
  const puzzle = play?.puzzle;
  const finished = play?.finished ?? false;
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const padContainer = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const advancing = useRef(false);
  const today = toDateKey(new Date(now));
  const data = state.data[profileId].puzzles;
  const summary = puzzleSummary(data, today, 1);
  const activeMs = play && !play.finished ? puzzleActiveMs(clock.current, now) : 0;
  const paused = !!play && !play.finished && puzzlePaused(clock.current, now);
  const activity = useCallback(() => {
    if (!live.current || live.current.finished || document.hidden) return;
    const time = Date.now(); clock.current = puzzleActivity(clock.current, time); setNow(time);
  }, []);
  useEffect(() => {
    if (!puzzle || finished || done) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    const visibility = () => {
      // 화면으로 돌아와도 직접 누르기 전까지는 동결한다.
      if (document.hidden) clock.current = pausePuzzleClock(clock.current, Date.now());
      setNow(Date.now());
    };
    document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [puzzle, finished, done]);
  const change = (input: unknown) => {
    activity();
    setPlay(previous => previous && !previous.finished ? { ...previous, input } : previous);
  };
  const select = useCallback((cell: Cell) => {
    activity(); setPlay(previous => previous && !previous.finished ? { ...previous, selected: cell } : previous);
    padContainer.current?.querySelector('input')?.focus();
  }, [activity]);
  useEffect(() => {
    if (!puzzle || finished || done || !PUZZLE_RENDERERS[puzzle.type]?.move) return;
    const keydown = (event: KeyboardEvent) => {
      // 숫자·삭제·Enter는 NumberPad 한 개가 담당한다. 여기서는 방향키만 받는다.
      if (!event.key.startsWith('Arrow') || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return;
      if (document.querySelector('.modal-backdrop, [aria-modal="true"], dialog[open]')) return;
      for (const element of [event.target instanceof Element ? event.target : null, document.activeElement]) {
        const editable = element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
        if (editable && !editable.closest('.number-answer')) return;
      }
      const current = live.current;
      if (!current || current.finished) return;
      const renderer = PUZZLE_RENDERERS[current.puzzle.type]!;
      if (!renderer.move) return;
      event.preventDefault();
      select(renderer.move(current.puzzle, current.selected, event.key));
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [puzzle, finished, done, select]);

  const start = useCallback((type: PuzzleType, random = false) => {
    const level = data?.levels[type] ?? defaultPuzzleLevel(profile.level);
    const puzzle = generatePuzzle(type, level.level, Math.floor(Math.random() * 0x100000000));
    const renderer = PUZZLE_RENDERERS[type]!;
    const next = { puzzle, random, input: renderer.initialInput(puzzle), selected: renderer.firstCell?.(puzzle) ?? { r: 0, c: 0 },
      wrong: 0, hinted: false, finished: false, revealed: false };
    live.current = next; setPlay(next);
    clock.current = startPuzzleClock(Date.now());
    if (document.hidden) clock.current = pausePuzzleClock(clock.current, Date.now());
    setNow(Date.now()); setMessage(''); setDone(false); advancing.current = false;
  }, [data, profile.level]);
  const next = useCallback(() => {
    const current = live.current;
    if (!current?.finished || advancing.current) return;
    advancing.current = true;
    const types = available();
    const type = current.random ? types[(types.indexOf(current.puzzle.type) + 1) % types.length] : current.puzzle.type;
    start(type, current.random);
  }, [start]);
  useEffect(() => {
    if (!play?.finished || play.revealed || done) return;
    const timer = window.setTimeout(next, 1200);
    return () => clearTimeout(timer);
  }, [play, done, next]);
  const finish = (result: PuzzleResult) => {
    const current = live.current;
    if (!current || current.finished) return;
    const time = Date.now(), elapsed = puzzleActiveMs(clock.current, time);
    const finished = { ...current, finished: true, revealed: result.revealed };
    live.current = finished; setPlay(finished);
    const before = data?.levels[current.puzzle.type] ?? defaultPuzzleLevel(profile.level);
    const after = adjustPuzzleLevel(before, result);
    const changeText = after.level === before.level ? '' : after.level > before.level ? '★ 한 단계 올라갔어요!' : '★ 한 단계 내려가서 다시 해 봐요.';
    update(draft => {
      recordPuzzle(draft.data[profileId], profile.level, { date: toDateKey(new Date(time)), type: current.puzzle.type,
        difficulty: current.puzzle.difficulty, correct: result.correct, hinted: result.hinted, activeSec: Math.floor(elapsed / 1000) }, result);
    });
    setMessage(`${result.correct ? '멋져요! 잘 풀었어요.' : '정답을 함께 살펴봐요.'} ${changeText}`);
    setNow(time);
  };
  const submit = () => {
    const current = live.current;
    if (!current || current.finished) return;
    activity();
    const renderer = PUZZLE_RENDERERS[current.puzzle.type]!;
    if (!renderer.complete(current.input)) { setMessage('빈칸을 모두 채워 주세요.'); return; }
    const correct = GENERATORS[current.puzzle.type]!.check(current.puzzle, renderer.toAnswer(current.input));
    if (correct) finish({ correct, hinted: current.hinted, revealed: false, wrong: current.wrong });
    else {
      const changed = { ...current, wrong: current.wrong + 1 };
      live.current = changed; setPlay(changed); setMessage(current.puzzle.type === 'pattern' ? '조금만 더 생각해 봐요. 보기를 바꿀 수 있어요.' : '조금만 더 생각해 봐요. 숫자를 바꿀 수 있어요.');
    }
  };
  const saveExit = () => {
    const current = live.current;
    if (current && !current.finished) {
      const time = Date.now();
      const activeSec = Math.floor(puzzleActiveMs(clock.current, time) / 1000);
      update(draft => recordPuzzleExit(draft.data[profileId], profile.level, { date: toDateKey(new Date(time)),
        type: current.puzzle.type, difficulty: current.puzzle.difficulty, correct: false, hinted: current.hinted,
        activeSec }, current.wrong));
    }
    setNow(Date.now()); setPlay(null); live.current = null; setMessage('');
  };
  const stop = () => { saveExit(); setDone(true); };
  const choose = () => { saveExit(); };
  if (done) return <div className="page"><TopBar title="🧩 오늘의 퍼즐 놀이" onBack={() => go({ name: 'home', profileId })} />
    <div className="panel center"><div className="celebrate-emoji">🧩</div><h2>생각하는 재미가 있었나요?</h2>
      <p>오늘 맞힌 퍼즐 {summary.solved}개</p><p>활동 시간 {formatTime(summary.activeSec)}</p>
      <p className="small muted">별과 쿠폰 없이 자유롭게 놀았어요.</p>
      <button className="btn btn-primary" onClick={() => go({ name: 'home', profileId })}>홈으로</button>
      <button className="btn btn-soft" onClick={() => setDone(false)}>더 놀기</button></div></div>;
  if (!play) return <div className="page"><TopBar title="🧩 두뇌 퍼즐" onBack={() => go({ name: 'home', profileId })} />
    <p className="muted">하고 싶은 퍼즐을 골라요. 그만두고 싶을 때 언제든 끝낼 수 있어요.</p>
    <div className="puzzle-picker">{available().map(type => {
      const renderer = PUZZLE_RENDERERS[type]!, level = data?.levels[type]?.level ?? defaultPuzzleLevel(profile.level).level;
      return <button key={type} className="panel puzzle-choice" onClick={() => start(type)}>
        <span className="puzzle-choice-icon">{renderer.icon}</span><strong>{PUZZLE_LABELS[type]}</strong>
        <span className="puzzle-example">{renderer.example}</span><span aria-label={`난이도 ${level}`}>{'★'.repeat(level)}{'☆'.repeat(5 - level)}</span>
      </button>;
    })}</div>
    <button className="btn btn-primary puzzle-random" onClick={() => { const types = available(); start(types[Math.floor(Math.random() * types.length)], true); }}>🎲 아무거나 · 종류를 돌아가며 풀어요</button>
    <p className="small muted center">오늘 맞힌 퍼즐 {summary.solved}개 · 활동 시간 {formatTime(summary.activeSec)}</p>
  </div>;
  const renderer = PUZZLE_RENDERERS[play.puzzle.type]!, Component = renderer.Component;
  return <div className="page brain-puzzles" onPointerDownCapture={activity}>
    <TopBar title={`${renderer.icon} ${PUZZLE_LABELS[play.puzzle.type]}`} onBack={stop} right={<button className="btn btn-ghost" onClick={stop}>그만하기</button>} />
    <div className="puzzle-status"><span>{'★'.repeat(play.puzzle.difficulty)}{'☆'.repeat(5 - play.puzzle.difficulty)}</span><span>활동 {formatTime(Math.floor((summary.activeSec * 1000 + activeMs) / 1000))}</span></div>
    <p className="puzzle-instruction">{renderer.instruction}</p>
    {paused && <button className="btn btn-soft puzzle-resume" onClick={activity}>계속하려면 화면을 눌러요</button>}
    <Component puzzle={play.puzzle} input={play.revealed ? renderer.answerInput(play.puzzle) : play.input} selected={play.selected} select={select} change={change} disabled={play.finished} onSubmit={submit} onNext={next} />
    {play.hinted && <p className="panel puzzle-hint">💡 {play.puzzle.hint}</p>}
    <p className="puzzle-feedback" role="status">{message || renderer.answerPrompt || (renderer.move ? '빈칸을 누르거나 방향키로 이동해요.' : '다음 수는 무엇일까요?')}</p>
    {!play.finished && <div className="row-center">
      {activeMs >= PUZZLE_HINT_MS && !play.hinted && <button className="btn btn-soft puzzle-hint-ready" onClick={() => {
        activity(); setPlay(previous => previous ? { ...previous, hinted: true } : previous);
      }}>💡 힌트</button>}
      {play.wrong >= 3 && <button className="btn btn-soft" onClick={() => finish({ correct: false, hinted: play.hinted, revealed: true, wrong: play.wrong })}>정답 보기</button>}
    </div>}
    {renderer.padValue && renderer.setPad && <div ref={padContainer}><NumberPad kind="int" value={{ value: renderer.padValue(play.input, play.selected) }}
      onChange={value => change(renderer.setPad!(play.input, play.selected, value.value ?? ''))} onSubmit={submit}
      onNext={next} nextButtonRef={nextButtonRef} onActivity={activity} disabled={play.finished} /></div>}
    {play.finished && <button ref={nextButtonRef} className="btn btn-primary puzzle-next" onClick={next}>다음 퍼즐</button>}
    <button className="btn btn-ghost puzzle-other" onClick={choose}>다른 퍼즐</button>
  </div>;
}
