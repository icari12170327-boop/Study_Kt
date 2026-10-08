import { useEffect, useRef, useState } from 'react';
import { roundRemaining } from '../content/games/limits';

/** 늦게 그려진 프레임도 실제 경과 시간으로 판정한다. 백그라운드 시간도 포함한다. */
export function useGameClock(startedAt: number, running: boolean, onEnd: () => void): number {
  const [remaining, setRemaining] = useState(90000);
  const end = useRef(onEnd);
  useEffect(() => { end.current = onEnd; }, [onEnd]);
  useEffect(() => {
    if (!running) return;
    let frame = 0, lastPaint = 0, stopped = false;
    const tick = (now: number) => {
      if (stopped) return;
      const left = roundRemaining(startedAt, now);
      if (left === 0) { stopped = true; setRemaining(0); end.current(); return; }
      if (now - lastPaint >= 100) { lastPaint = now; setRemaining(left); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [startedAt, running]);
  return remaining;
}
