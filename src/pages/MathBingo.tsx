import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import type { Go } from '../route';
import { ProgressBar, TopBar } from '../components/common';
import { toDateKey } from '../lib/date';
import { actBingo, bingoElapsed, canBingoHint, canBingoPass, lineFromEnds, normalizeBingoSettings, recordBingo, remaining, startBingoGame, updateBest,
  type BingoAction, type BingoGame, type BingoMode, type Cell } from '../content/math/bingo';

const sameCell = (a: Cell, b?: Cell) => !!b && a.r === b.r && a.c === b.c;
export function MathBingo({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const profile = state.profiles.find(row => row.id === profileId)!;
  const settings = normalizeBingoSettings(state.settings[profileId].bingo, profile.level);
  const [mode, setMode] = useState<BingoMode>('time');
  const [game, setGame] = useState<BingoGame>();
  const [now, setNow] = useState(Date.now);
  const [isNew, setIsNew] = useState(false);
  const [preview, setPreview] = useState<Cell[]>([]);
  const current = useRef<BingoGame | undefined>(undefined), saved = useRef(false);
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; start: Cell; end: Cell; moved: boolean } | undefined>(undefined);
  const dispatch = useCallback((action: BingoAction) => {
    if (!current.current) return;
    const time = Date.now(), next = actBingo(current.current, action, time, Math.random);
    // 이벤트가 빠르게 겹쳐도 이전 선택이나 종료 전 상태를 다시 쓰지 않는다.
    current.current = next;
    setGame(next); setNow(time);
  }, []);
  const start = () => {
    if (profileId === 'parent' || profile.level === 'adult' || !settings.enabled) return;
    const time = Date.now(), next = startBingoGame(profile.level, settings, mode, Math.random, time);
    current.current = next; saved.current = false; drag.current = undefined;
    setGame(next); setNow(time); setIsNew(false); setPreview([]);
  };
  const phase = game?.phase;
  useEffect(() => {
    if (!phase || phase === 'paused' || phase === 'ended') return;
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), 100);
    return () => window.clearInterval(timer);
  }, [phase, dispatch]);
  useEffect(() => {
    const visibility = () => {
      if (!document.hidden) return;
      drag.current = undefined; setPreview([]); dispatch({ type: 'pause' });
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [dispatch]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (current.current?.phase !== 'playing' || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return;
      if (document.querySelector('.modal-backdrop, [aria-modal="true"], dialog[open]')) return;
      const target = event.target instanceof Element ? event.target : document.activeElement;
      for (const element of [target, document.activeElement]) {
        if (element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
        const control = element?.closest('button, a[href], [role="button"], [role="link"], summary');
        if ((event.key === 'Enter' || event.key === ' ') && control && !board.current?.contains(control)) return;
      }
      let action: BingoAction;
      if (event.key.startsWith('Arrow') && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) action = { type: 'move', key: event.key };
      else if (event.key === 'Enter' || event.key === ' ') action = { type: 'select', cell: current.current.cursor };
      else if (event.key === 'Backspace') action = { type: 'undo' };
      else if (event.key === 'Escape') action = { type: 'clear' };
      else return;
      event.preventDefault();
      if (event.repeat) return;
      dispatch(action);
      const cell = current.current.cursor;
      board.current?.querySelector<HTMLButtonElement>(`[data-r="${cell.r}"][data-c="${cell.c}"]`)?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [dispatch]);
  useEffect(() => {
    if (!game || game.phase !== 'ended' || game.mode === 'practice' || saved.current) return;
    saved.current = true;
    const rec = { date: toDateKey(new Date(now)), level: game.level, limitSec: game.limitSec, found: game.found, bingos: game.bingos, hints: game.hints };
    setIsNew(updateBest(state.data[profileId].bingo?.best ?? {}, rec).isNew);
    update(draft => { recordBingo(draft.data[profileId], rec); });
  }, [game, now, profileId, state.data, update]);
  const pointedCell = (event: PointerEvent): Cell | undefined => {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-bingo-cell]');
    return element && board.current?.contains(element) ? { r: Number(element.dataset.r), c: Number(element.dataset.c) } : undefined;
  };
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary || drag.current || current.current?.phase !== 'playing') return;
    dispatch({ type: 'tick' });
    if (current.current?.phase !== 'playing') return;
    const cell = pointedCell(event);
    if (!cell) return;
    event.preventDefault(); board.current?.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, start: cell, end: cell, moved: false };
    setPreview([cell]);
  };
  const pointerMove = (event: PointerEvent) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const cell = pointedCell(event);
    if (!cell) { setPreview([]); return; }
    gesture.end = cell;
    if (!sameCell(cell, gesture.start)) gesture.moved = true;
    setPreview(lineFromEnds(gesture.start, cell) ?? [gesture.start, cell]);
  };
  const pointerUp = (event: PointerEvent) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const cell = pointedCell(event);
    drag.current = undefined; setPreview([]);
    if (board.current?.hasPointerCapture(event.pointerId)) board.current.releasePointerCapture(event.pointerId);
    if (!cell) return;
    if (!gesture.moved && sameCell(cell, gesture.start)) dispatch({ type: 'select', cell });
    else dispatch({ type: 'line', cells: lineFromEnds(gesture.start, cell) ?? [] });
  };
  const cancelDrag = () => { drag.current = undefined; setPreview([]); };
  const seconds = game ? Math.ceil(remaining(game.clock, now) / 1000) : settings.limitSec;
  const goal = game?.board.goals[game.goalIndex];
  const feedback = game?.feedback;
  const freshFeedback = !!game && !!feedback && bingoElapsed(game, now) - feedback.atMs < 1600;
  const savedBest = state.data[profileId].bingo?.best[String(game?.limitSec ?? settings.limitSec)];
  const best = savedBest && savedBest.found > 0 ? savedBest : undefined;
  return <div className="page bingo-page">
    <TopBar title="🎯 수학 빙고" onBack={() => go({ name: 'home', profileId })} />
    {profileId === 'parent' || profile.level === 'adult' || !settings.enabled ? <p className="panel">지금은 빙고가 꺼져 있어요.</p> : !game ? <>
      <section className="panel bingo-intro">
        <div className="bingo-hero" aria-hidden="true">🎯</div>
        <h2>숫자 3칸을 찾아요!</h2>
        <p>가로, 세로, 대각선으로 붙은 3칸이에요.<br />한 판에 5문제를 풀어요.</p>
        <div className="tabs" role="group" aria-label="게임 모드">
          <button className={`tab ${mode === 'time' ? 'active' : ''}`} aria-pressed={mode === 'time'} onClick={() => setMode('time')}>⏱️ 타임어택</button>
          <button className={`tab ${mode === 'practice' ? 'active' : ''}`} aria-pressed={mode === 'practice'} onClick={() => setMode('practice')}>🐢 연습</button>
        </div>
        <p>{mode === 'time' ? `${settings.limitSec}초 안에 많이 찾아요. 정답 +5초, 힌트 −3초!` : '시간 제한 없이 한 판을 풀어요. 기록은 남기지 않아요.'}</p>
        {mode === 'time' && <p className="small muted">{settings.limitSec}초 최고 기록: {best ? `${best.found}개 · 힌트 ${best.hints}번` : '아직 없어요'}</p>}
        <button className="btn btn-primary wide" onClick={start}>시작하기</button>
      </section>
      <p className="small muted center">드래그하거나 3칸을 차례로 눌러요.<br />키보드: 방향키로 이동 · Enter/Space 선택<br />Backspace 하나 취소 · Esc 모두 취소</p>
    </> : game.phase === 'ended' ? <section className="panel bingo-results" aria-live="polite">
      <div className="bingo-hero">{game.mode === 'time' ? '⏱️' : game.boardFound === 5 ? '🎉' : '🐢'}</div>
      <h2>{game.mode === 'time' ? '시간 끝!' : game.boardFound === 5 ? '빙고! 5개 모두 찾았어요' : '연습 한 판을 끝냈어요'}</h2>
      {game.mode === 'time' && isNew && <h3 className="bingo-new">🎉 새 기록!</h3>}
      <div className="stat-row"><div className="stat"><div className="stat-value">{game.found}</div><div className="stat-label">찾은 개수</div></div>
        <div className="stat"><div className="stat-value">{game.bingos}</div><div className="stat-label">완성한 빙고</div></div>
        <div className="stat"><div className="stat-value">{game.hints}</div><div className="stat-label">힌트 수</div></div></div>
      {game.mode === 'time' ? <p>{game.limitSec}초 최고 기록: {best ? <><strong>{best.found}개</strong> · 힌트 {best.hints}번</> : '아직 없어요'}</p> : <p className="muted">연습 기록은 저장하지 않아요.</p>}
      <div className="row-center"><button className="btn btn-primary" onClick={start}>한 판 더</button><button className="btn btn-soft" onClick={() => { current.current = undefined; setGame(undefined); }}>모드 고르기</button></div>
    </section> : <>
      {game.mode === 'time' ? <section className={`bingo-timer ${seconds <= 10 ? 'bingo-urgent' : ''}`} aria-label="남은 시간">
        <div className="bingo-timer-label"><strong>{seconds}초</strong><span className="small">찾은 문제 {game.found}개 · 빙고 {game.bingos}판</span></div>
        <ProgressBar value={remaining(game.clock, now)} max={game.clock.limitMs} color={seconds <= 10 ? 'var(--bad)' : 'var(--primary)'} />
      </section> : <p className="badge">🐢 연습 · 시간 제한 없어요</p>}
      <section className="bingo-goal" aria-live="polite">
        {game.phase === 'bingo' || game.goalIndex === 5 ? <h2>{game.boardFound === 5 ? '빙고! 5개 모두 찾았어요' : '이번 판 끝! 다음 판으로 가요'}</h2> : <>
          <span className="small muted">이번 판 {game.goalIndex + 1} / 5문제</span>
          <h2>{goal?.op === 'product' ? '곱' : '합'}이 <strong>{goal?.target}</strong>이 되는 3칸</h2>
          <p className="small muted">붙은 3칸을 찾아 한 줄로 그어요.</p>
        </>}
      </section>
      <div className="bingo-board-wrap">
        <div className={`bingo-board bingo-size-${game.board.size}`} ref={board} role="group" aria-label="숫자판" style={{ '--bingo-size': game.board.size } as CSSProperties}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
          {game.board.grid.flatMap((row, r) => row.map((value, c) => {
            const cell = { r, c }, selected = game.selected.some(item => sameCell(item, cell));
            const shaking = freshFeedback && feedback?.kind === 'wrong' && feedback.cells.some(item => sameCell(item, cell));
            return <button key={`${r}:${c}`} data-bingo-cell data-r={r} data-c={c} disabled={game.phase !== 'playing'}
              className={`bingo-cell ${selected ? 'selected' : ''} ${sameCell(cell, game.cursor) ? 'cursor' : ''} ${sameCell(cell, game.hintCell) ? 'hinted' : ''} ${shaking ? 'shake' : ''}`}
              tabIndex={sameCell(cell, game.cursor) ? 0 : -1} aria-label={`${r + 1}행 ${c + 1}열, ${value}`} aria-pressed={selected}
              onClick={event => { if (event.detail === 0 && !document.querySelector('.modal-backdrop, [aria-modal="true"], dialog[open]')) dispatch({ type: 'select', cell }); }}
              onFocus={() => { if (current.current) { current.current = { ...current.current, cursor: cell }; setGame(current.current); } }}>{value}</button>;
          }))}
          <svg className="bingo-lines" viewBox={`0 0 ${game.board.size} ${game.board.size}`} aria-hidden="true">
            {game.lines.map((line, i) => <line key={i} x1={line[0].c + 0.5} y1={line[0].r + 0.5} x2={line[2].c + 0.5} y2={line[2].r + 0.5} />)}
            {preview.length > 1 && <line className="bingo-preview" x1={preview[0].c + 0.5} y1={preview[0].r + 0.5} x2={preview[preview.length - 1].c + 0.5} y2={preview[preview.length - 1].r + 0.5} />}
          </svg>
        </div>
        {game.phase === 'countdown' && <div className="bingo-overlay" role="status"><strong>{Math.ceil(remaining(game.countdown, now) / 1000)}</strong><span>준비해요!</span></div>}
        {game.phase === 'paused' && <div className="bingo-overlay"><h2>잠깐 쉬어요</h2><button className="btn btn-primary" onClick={() => dispatch({ type: 'resume' })}>계속하기</button></div>}
      </div>
      <div className={`bingo-feedback ${freshFeedback && feedback?.kind === 'wrong' ? 'bad-text' : ''}`} role="status">
        {feedback?.text ?? '숫자 3칸을 골라요'}{freshFeedback && feedback?.kind === 'correct' && game.mode === 'time' && <strong className="bingo-bonus"> +5초</strong>}
      </div>
      <div className="row-center">
        <button className="btn btn-ghost" disabled={game.phase !== 'playing' || !game.selected.length} onClick={() => dispatch({ type: 'clear' })}>선택 취소</button>
        {canBingoHint(game, now) && <button className="btn btn-soft" onClick={() => dispatch({ type: 'hint' })}>💡 힌트{game.mode === 'time' ? ' −3초' : ''}</button>}
        <button className="btn btn-soft" disabled={!canBingoPass(game, now)} onClick={() => dispatch({ type: 'pass' })}>⏭️ 패스</button>
      </div>
      <p className="small muted center">방향키로 이동 · Enter/Space 선택</p>
    </>}
  </div>;
}
