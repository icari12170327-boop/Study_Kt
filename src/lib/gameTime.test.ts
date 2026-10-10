import { expect, it } from 'vitest';
import { gameTime, pauseGameTime, resumeGameTime, startGameTime } from './gameTime';
import { roundRemaining } from '../content/games/limits';
it('숨김부터 명시적 재개까지 여러 번 멈춰도 프레임 수 없이 게임 시간이 유지된다', () => {
  const startedAt = 100;
  const original = startGameTime(), paused = pauseGameTime(original, 5100);
  expect(original).toEqual({ pausedMs: 0 }); expect(roundRemaining(startedAt, gameTime(paused, 80000))).toBe(85000);
  expect(pauseGameTime(paused, 90000)).toBe(paused);
  const resumed = resumeGameTime(paused, 100100);
  expect(roundRemaining(startedAt, gameTime(resumed, 101100))).toBe(84000);
  const second = pauseGameTime(resumed, 102100); expect(gameTime(second, 900000)).toBe(7100);
  expect(gameTime(resumeGameTime(second, 900000), 901000)).toBe(8100);
});
