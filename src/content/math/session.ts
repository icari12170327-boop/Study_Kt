import type { MathProblem, WrongItem } from '../../types';
import { pick, shuffle, type Rng, defaultRng } from '../../lib/random';
import { SKILL_MAP } from './skills';

export interface QueueItem {
  problem: MathProblem;
  /** 오답노트에서 다시 나온 문제라면 그 id */
  wrongId?: string;
}

/**
 * 연산 세션 문제 목록.
 * 오답노트 문제를 최대 절반까지 먼저 내고, 나머지는 켜진 단원에서 고르게 생성한다.
 */
export function buildMathQueue(
  skillIds: readonly string[],
  wrongNotes: readonly WrongItem[],
  count: number,
  rng: Rng = defaultRng,
): QueueItem[] {
  const skills = skillIds.map((id) => SKILL_MAP[id]).filter(Boolean);
  const review = wrongNotes.slice(0, skills.length ? Math.floor(count / 2) : count).map((w) => ({ problem: w.problem, wrongId: w.id }));
  const fresh: QueueItem[] = [];
  if (skills.length) {
    // 단원이 고르게 나오도록 섞은 단원 목록을 돌아가며 사용
    let order = shuffle(skills, rng);
    for (let i = 0; fresh.length < count - review.length; i++) {
      if (i > 0 && i % order.length === 0) order = shuffle(skills, rng);
      const skill = order[i % order.length] ?? pick(skills, rng);
      fresh.push({ problem: skill.generate(rng) });
    }
  }
  return [...review, ...shuffle(fresh, rng)];
}
