export interface GameTime { pausedMs: number; pausedAt?: number }
export const startGameTime = (): GameTime => ({ pausedMs: 0 });
export function pauseGameTime(clock: GameTime, now: number): GameTime { return clock.pausedAt === undefined ? { ...clock, pausedAt: now } : clock; }
export function resumeGameTime(clock: GameTime, now: number): GameTime { return clock.pausedAt === undefined ? clock : { pausedMs: clock.pausedMs + Math.max(0, now - clock.pausedAt) }; }
/** 성능 시계와 같은 원점을 쓰되 숨김·일시정지 구간은 제외한다. */
export const gameTime = (clock: GameTime, now: number): number => (clock.pausedAt ?? now) - clock.pausedMs;
