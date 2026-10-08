import type { BalanceView } from '../../content/puzzles/balance';
import type { PuzzleRendererProps } from './renderers';

export function BalancePuzzle({ puzzle }: PuzzleRendererProps) {
  const view = puzzle.view as BalanceView;
  return <div className="balance-puzzle" role="group" aria-label="저울 그림 식">
    {view.equations.map((equation, i) => {
      const pictures = view.symbols.flatMap((symbol, index) => Array.from({ length: equation.counts[index] }, () => symbol));
      return <div className="balance-equation" key={i} aria-label={`${pictures.map(symbol => symbol.label).join(' 더하기 ')} 는 ${equation.total}`}>
        {pictures.map((symbol, j) => <span className="balance-term" key={j} aria-hidden="true">{j > 0 && <span className="balance-sign">+</span>}<span>{symbol.emoji}</span></span>)}
        <span aria-hidden="true">= {equation.total}</span>
      </div>;
    })}
    <p className="balance-target"><span role="img" aria-label={view.symbols[view.target].label}>{view.symbols[view.target].emoji}</span> = ?</p>
  </div>;
}
