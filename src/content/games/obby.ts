import type { MathProblem, ObbyColor, ObbyHat, ProfileData } from '../../types';
import { buildFishPool, refillFishPool, type Fish } from './fishing';

export const OBBY_PENALTY_MS = 3000;
export const OBBY_RETRY_GAP = 3;
export const CHECKPOINT_EVERY = 5;
export const CHECKPOINT_BONUS = 20;
export const OBBY_REFILL_ATTEMPTS = 3;
export const OBBY_COLORS: readonly ObbyColor[] = ['red', 'blue', 'green', 'yellow', 'purple'];
export const OBBY_HATS: readonly ObbyHat[] = ['cap', 'tophat', 'helmet'];
export type ObstacleKind = 'lava' | 'wall' | 'spinner' | 'hole' | 'ladder';
export interface ObbyRun {
  queue: Fish[];
  stage: number;
  cleared: Fish[];
  lockedUntil: number;
  falls: number;
}
export function startRun(pool: readonly Fish[]): ObbyRun {
  return { queue: [...pool], stage: 1, cleared: [], lockedUntil: 0, falls: 0 };
}
export function obstacleKind(fish: Fish, stage: number): ObstacleKind {
  return fish.golden ? 'lava' : (['wall', 'spinner', 'hole', 'ladder'] as const)[(stage - 1) % 4];
}
export function answerObstacle(run: ObbyRun, correct: boolean, now: number): ObbyRun {
  const next = { ...run, queue: [...run.queue], cleared: [...run.cleared] };
  if (now < run.lockedUntil || !next.queue.length) return next;
  const fish = next.queue.shift()!;
  if (correct) {
    next.cleared.push(fish); next.stage++; next.lockedUntil = 0;
  } else {
    next.queue.splice(Math.min(OBBY_RETRY_GAP, next.queue.length), 0, fish);
    next.lockedUntil = now + OBBY_PENALTY_MS; next.falls++;
  }
  return next;
}
export function needsRefill(run: ObbyRun, min = 4): boolean { return run.queue.length < min; }
export function checkpointsPassed(clearedCount: number): number { return Math.floor(clearedCount / CHECKPOINT_EVERY); }
export function obbyScore(run: ObbyRun): number {
  return run.cleared.reduce((sum, fish) => sum + fish.points, 0) + checkpointsPassed(run.cleared.length) * CHECKPOINT_BONUS;
}
export function unlockedHats(best: number): ObbyHat[] {
  return OBBY_HATS.filter((_, index) => best >= (index + 1) * 10);
}
export function normalizeObby(raw: unknown): NonNullable<ProfileData['obby']> {
  const value = raw && typeof raw === 'object' ? raw as Partial<NonNullable<ProfileData['obby']>> : {};
  const best = Number.isSafeInteger(value.best) && value.best! >= 0 ? value.best! : 0;
  const color = OBBY_COLORS.includes(value.color!) ? value.color! : 'blue';
  return { best, color, ...(unlockedHats(best).includes(value.hat!) ? { hat: value.hat } : {}) };
}
/** 유한한 후보 묶음만 확인한다. 중복 후보뿐이면 문제를 재사용해서 다음 장애물을 보장한다. */
export function refillRun(run: ObbyRun, batches: readonly (readonly MathProblem[])[], min = 4): ObbyRun {
  const target = Number.isFinite(min) ? Math.max(0, Math.min(64, Math.floor(min))) : 4;
  let queue = [...run.queue];
  const caught = new Set(run.cleared.map(fish => fish.id));
  const limited = batches.slice(0, OBBY_REFILL_ATTEMPTS);
  for (const filler of limited) {
    if (queue.length >= target) break;
    queue = refillFishPool([...run.cleared, ...queue], run.cleared, filler, target).filter(fish => !caught.has(fish.id));
  }
  const fallback = buildFishPool([], limited.flat(), target);
  const reusable = fallback.length ? fallback : [...queue, ...run.cleared];
  const ids = new Set([...run.cleared, ...queue].map(fish => fish.id));
  for (let i = 0; queue.length < target && reusable.length && i < target; i++) {
    let id = `obby-${run.stage}-${run.falls}-${i}`;
    // 입력 풀에 같은 이름이 있어도 기존 id와 충돌하지 않는다.
    if (ids.has(id)) id = `obby-repeat-${ids.size}-${i}`;
    ids.add(id); queue.push({ ...reusable[i % reusable.length], id });
  }
  return { ...run, queue, cleared: [...run.cleared] };
}
