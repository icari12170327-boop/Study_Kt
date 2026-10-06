export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** [min, max] 범위의 정수 */
export function randInt(min: number, max: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick<T>(items: readonly T[], rng: Rng = defaultRng): T {
  return items[Math.floor(rng() * items.length)];
}

export function shuffle<T>(items: readonly T[], rng: Rng = defaultRng): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 테스트용 시드 고정 난수 (mulberry32) */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
