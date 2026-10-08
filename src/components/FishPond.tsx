import { useEffect, useRef } from 'react';
import type { Fish } from '../content/games/fishing';

export function FishPond({ fish, cursor, onChoose }: { fish: readonly Fish[]; cursor: number; onChoose: (fish: Fish) => void }) {
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const ids = fish.slice(0, 8).map(row => row.id).join('|');
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const start = performance.now();
    const paint = (now: number) => {
      // 프레임 수가 아니라 경과 초로 좌표를 구하고 최대 8마리의 DOM만 갱신한다.
      const seconds = (now - start) / 1000;
      ids.split('|').filter(Boolean).forEach((id, index) => {
        const node = nodes.current.get(id);
        if (!node) return;
        const amplitude = motion.matches ? 2 : 12;
        const x = Math.sin(seconds * (motion.matches ? 0.3 : 0.7) + index) * amplitude;
        const y = Math.cos(seconds * 0.5 + index) * (motion.matches ? 1 : 5);
        node.style.transform = `translate(calc(-50% + ${x}px), ${y}px)`;
      });
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [ids]);
  return <div className="fish-pond" role="group" aria-label="헤엄치는 물고기">
    {fish.slice(0, 8).map((row, index) => <button key={row.id} ref={node => { if (node) nodes.current.set(row.id, node); else nodes.current.delete(row.id); }}
      style={{ left: index % 2 ? '75%' : '25%', top: `${Math.floor(index / 2) * 112 + 14}px`, transform: 'translateX(-50%)' }}
      className={`fish ${row.golden ? 'golden' : ''} ${cursor === index ? 'chosen' : ''}`} aria-label={`${row.golden ? '금빛 물고기' : '물고기'} ${index + 1}: ${row.problem.question}`} aria-pressed={cursor === index} onClick={() => onChoose(row)}>
      <span className="fish-emoji" aria-hidden="true">{row.golden ? '🐠' : '🐟'}</span><span className="fish-question">{row.problem.question}</span><span className="small">{row.points}점</span>
    </button>)}
    {!fish.length && <p className="pond-empty">물고기가 곧 돌아와요 🫧</p>}
  </div>;
}
