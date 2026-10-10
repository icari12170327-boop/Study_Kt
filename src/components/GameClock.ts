import { useEffect, useRef, useState } from 'react';
import { roundRemaining } from '../content/games/limits';

const realNow = () => performance.now();
const neverPaused = () => false;

/** 늦게 그려진 프레임도 실제 경과 시간으로 판정한다. 숨김·일시정지 시간은 주입받은 시계가 제외한다. */
export function useGameClock(startedAt: number, running: boolean, onEnd: () => void, now: () => number = realNow, isPaused: () => boolean = neverPaused): number {
  const [remaining, setRemaining] = useState(90000);
  const end = useRef(onEnd);
  useEffect(() => { end.current = onEnd; }, [onEnd]);
  useEffect(() => {
    if (!running) return;
    let frame = 0, lastPaint = 0, stopped = false;
    const tick = () => {
      if (stopped || isPaused()) return;
      const time = now();
      const left = roundRemaining(startedAt, time);
      if (left === 0) { stopped = true; setRemaining(0); end.current(); return; }
      if (time - lastPaint >= 100) { lastPaint = time; setRemaining(left); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [startedAt, running, now, isPaused]);
  return remaining;
}
