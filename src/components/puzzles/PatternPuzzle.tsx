import { useEffect, useRef } from 'react';
import { describePatternTile, patternChoiceKey, type PatternTile, type PatternView } from '../../content/puzzles/pattern';
import type { PuzzleRendererProps } from './renderers';
const COLORS = { blue: '#2672d4', orange: '#c65a0d', purple: '#8d47bf', green: '#237c49' };
function Tile({ tile }: { tile: PatternTile }) {
  return <span className="pattern-tile">
    <span className="pattern-shapes" aria-hidden="true">{Array.from({ length: tile.count }, (_, i) => <svg key={i} viewBox="0 0 40 40" fill={COLORS[tile.color]}>
      {tile.shape === 'circle' ? <circle cx="20" cy="20" r="16" /> : tile.shape === 'square' ? <rect x="4" y="4" width="32" height="32" rx="2" /> :
        tile.shape === 'triangle' ? <polygon points="20,3 38,36 2,36" /> : <polygon points="20,2 25,14 38,15 28,24 31,37 20,30 9,37 12,24 2,15 15,14" />}
    </svg>)}</span>
    <span className="pattern-label">{describePatternTile(tile)}</span>
  </span>;
}
export function PatternPuzzle({ puzzle, input, change, disabled, onSubmit, onNext }: PuzzleRendererProps) {
  const view = puzzle.view as PatternView;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
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
      if (event.key === 'Enter') { if (disabled) onNext?.(); else onSubmit?.(); }
      else if (!disabled) change(choice);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [change, disabled, onSubmit, onNext]);
  return <div className="pattern-puzzle" ref={root}>
    <ol className="pattern-sequence" aria-label="앞에서부터 반복되는 도형 줄">
      {view.sequence.map((tile, i) => <li key={i}><span className="small muted">{i + 1}번째</span><Tile tile={tile} /></li>)}
      <li className="pattern-unknown"><span className="small muted">다음</span><strong>?</strong></li>
    </ol>
    <div className="pattern-options" role="group" aria-label="다음 칸 보기 네 개">
      {view.options.map((tile, i) => <button key={i} type="button" className={`pattern-option ${input === i + 1 ? 'selected' : ''}`}
        aria-label={`${i + 1}번 ${describePatternTile(tile)}`} aria-pressed={input === i + 1} disabled={disabled} onClick={() => change(i + 1)}>
        <strong>{i + 1}번</strong><Tile tile={tile} />
      </button>)}
    </div>
    <p className="small muted center">1~4로 고르고 Enter로 확인해요.</p>
    {!disabled && <button className="btn btn-primary pattern-confirm" onClick={onSubmit}>확인</button>}
  </div>;
}
