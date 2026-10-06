import type { Level, MathProblem, WrongItem } from '../../types';
import { pick, shuffle, type Rng, defaultRng } from '../../lib/random';
import { SKILL_MAP } from './skills';
import { clampMathLevel, mathLevelsFor, reviewSkills } from './levels';

export interface QueueItem {
  problem: MathProblem;
  /** 오답노트에서 다시 나온 문제라면 그 id */
  wrongId?: string;
  band?: 'main' | 'review';
}

/**
 * 하루 목표의 70%는 주 단원, 나머지는 아래 레벨 단원에서 출제한다.
 * 오답은 같은 단원의 문제를 대체하며, 현재 출제 범위 밖의 오답은 다시 내지 않는다.
 */
export function buildLevelQueue(grade: Level, level: number, wrongNotes: readonly WrongItem[], count: number,
  rng: Rng = defaultRng): QueueItem[] {
  const mainSkills = mathLevelsFor(grade)[clampMathLevel(level, grade) - 1].mainSkills;
  const lowerSkills = reviewSkills(grade, level);
  const size = Math.max(0, Math.trunc(count));
  const mainCount = lowerSkills.length ? Math.round(size * 0.7) : size;
  const main = buildMathQueue(mainSkills, [], mainCount, rng);
  const review = buildMathQueue(lowerSkills, [], size - mainCount, rng);
  const used = new Set<string>();
  const fresh = shuffle([...main.map((item) => ({ ...item, band: 'main' as const })),
    ...review.map((item) => ({ ...item, band: 'review' as const }))], rng);
  // 먼저 단원을 고르게 배정한 뒤 같은 단원의 오답으로 대체해 비율을 유지한다.
  return fresh.map((item) => {
    const note = wrongNotes.find((note) => note.problem.skill === item.problem.skill && !used.has(note.id));
    if (!note || used.size >= Math.floor(size / 2)) return item;
    used.add(note.id);
    return { ...item, problem: note.problem, wrongId: note.id };
  });
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
