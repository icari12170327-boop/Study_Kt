import { useEffect, useRef } from 'react';
import { describePatternTile, explainRules, isPatternView, patternChoiceKey, type PatternTile } from '../../content/puzzles/pattern';
import type { PuzzleRendererProps } from './renderers';
const COLORS = { blue: '#2672d4', orange: '#c65a0d', purple: '#8d47bf', green: '#237c49' };
function Tile({ tile }: { tile: PatternTile }) {
  return <span className="pattern-tile" role="img" aria-label={describePatternTile(tile)}>
    <span className="pattern-shapes" style={{ gridTemplateColumns: `repeat(${Math.min(3, tile.count)}, 24px)` }} aria-hidden="true">{Array.from({ length: tile.count }, (_, i) => <svg key={i} viewBox="0 0 40 40" fill={COLORS[tile.color]}>
      {tile.shape === 'arrow' ? <g transform={`rotate(${tile.dir ?? 0} 20 20)`}><path d="M3 13 H23 V4 L38 20 L23 36 V27 H3 Z" /></g> : tile.shape === 'circle' ? <circle cx="20" cy="20" r="16" /> : tile.shape === 'square' ? <rect x="4" y="4" width="32" height="32" rx="2" /> :
        tile.shape === 'triangle' ? <polygon points="20,3 38,36 2,36" /> : <polygon points="20,2 25,14 38,15 28,24 31,37 20,30 9,37 12,24 2,15 15,14" />}
    </svg>)}</span>
  </span>;
}
export function PatternPuzzle({ puzzle, input, change, disabled, onSubmit, onNext, onRestart }: PuzzleRendererProps) {
  const view = puzzle.view, valid = isPatternView(view);
  const root = useRef<HTMLDivElement>(null);
  // 이전 화면의 React 상태가 남아 있어도 기록을 바꾸지 않고 새 판으로 교체한다.
  useEffect(() => { if (!valid) onRestart?.(); }, [valid, onRestart]);
  useEffect(() => {
    if (!valid) return;
    // 보기형은 NumberPad를 붙이지 않는다. 이 리스너 하나만 숫자와 Enter를 담당한다.
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return;
      if (document.querySelector('.modal-backdrop, [aria-modal="true"], dialog[open]')) return;
      for (const element of [event.target instanceof Element ? event.target : null, document.activeElement]) {
        if (element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
        const control = element?.closest('button, a[href], [role="button"], [role="link"]');
        if (event.key === 'Enter' && control && !root.current?.contains(control)) return;
      }
      const choice = patternChoiceKey(event.key);
      if (choice === null && event.key !== 'Enter') return;
      event.preventDefault();
      if (event.repeat) return;
      if (event.key === 'Enter') {
        if (disabled) onNext?.();
        else {
          const focused = document.activeElement?.closest<HTMLElement>('[data-pattern-choice]');
          const focusedChoice = focused && root.current?.contains(focused) ? patternChoiceKey(focused.dataset.patternChoice ?? '') : null;
          // React 상태 반영을 기다리지 않고 포커스된 보기를 같은 입력으로 선택·채점한다.
          if (focusedChoice !== null) change(focusedChoice);
          onSubmit?.(focusedChoice ?? undefined);
        }
      }
      else if (!disabled) change(choice);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [change, disabled, onSubmit, onNext, valid]);
  if (!valid) return <p role="status">새로운 도형 규칙을 준비하고 있어요.</p>;
  return <div className="pattern-puzzle" ref={root}>
    <ol className={`pattern-sequence pattern-${view.layout}`} aria-label={view.layout === 'grid' ? '물음표 한 칸이 있는 도형 격자' : '왼쪽부터 규칙을 찾는 도형 줄'} tabIndex={view.layout === 'row' ? 0 : undefined}>
      {view.cells.map((tile, i) => <li key={i} className={tile ? '' : 'pattern-unknown'} aria-label={tile ? undefined : '물음표 칸'}>
        {view.layout === 'row' && <span className="small muted">{tile ? `${i + 1}번째` : '다음'}</span>}{tile ? <Tile tile={tile} /> : <strong>?</strong>}
      </li>)}
    </ol>
    {view.layout === 'row' && <p className="small muted center pattern-scroll-hint">옆으로 밀어서 모든 칸을 봐요.</p>}
    <div className="pattern-options" role="group" aria-label="물음표 칸 보기 네 개">
      {view.options.map((tile, i) => <button key={i} type="button" className={`pattern-option ${input === i + 1 ? 'selected' : ''}`}
        data-pattern-choice={i + 1} aria-label={`${i + 1}번 ${describePatternTile(tile)}`} aria-pressed={input === i + 1} disabled={disabled} onClick={() => change(i + 1)}>
        <strong>{i + 1}번</strong><Tile tile={tile} />
      </button>)}
    </div>
    <p className="small muted center">1~4로 고르고 Enter로 확인해요.</p>
    {!disabled && <button className="btn btn-primary pattern-confirm" onClick={() => onSubmit?.()}>확인</button>}
    {disabled && <p className="panel pattern-explanation" aria-label="도형 규칙 풀이">{explainRules(view)}</p>}
  </div>;
}
