import { useCallback, useEffect, useRef, useState } from 'react';
import { gameTime, pauseGameTime, resumeGameTime, startGameTime } from '../lib/gameTime';
export function useGamePause(running: boolean) {
  const clock = useRef(startGameTime());
  const [paused, setPaused] = useState(false);
  const isPaused = useCallback(() => document.hidden || clock.current.pausedAt !== undefined, []);
  const now = useCallback(() => gameTime(clock.current, performance.now()), []);
  const resume = useCallback(() => { if (document.hidden) return; clock.current = resumeGameTime(clock.current, performance.now()); setPaused(false); }, []);
  useEffect(() => {
    if (!running) return;
    const visibility = () => { if (document.hidden) { clock.current = pauseGameTime(clock.current, performance.now()); setPaused(true); } };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [running]);
  return { paused, now, isPaused, resume };
}
