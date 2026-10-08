import type { MathAttempt, MathProblem } from '../../types';

export interface Fish { id: string; problem: MathProblem; golden: boolean; points: number }

/** 백업의 문제 본문도 입력 화면에서 안전하게 쓸 수 있는 형태로 제한한다. */
export function normalizeProblem(raw: unknown): MathProblem | undefined {
  if (!raw || typeof raw !== 'object') return;
  const p = raw as MathProblem, a = p.answer;
  if (typeof p.skill !== 'string' || !p.skill || p.skill.length > 100 || typeof p.question !== 'string' || !p.question.trim() || p.question.length > 1000 || !a || typeof a !== 'object') return;
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  let answer: MathProblem['answer'];
  if ((a.kind === 'int' || a.kind === 'decimal') && finite(a.value)) answer = { kind: a.kind, value: a.value };
  else if (a.kind === 'fraction' && Number.isInteger(a.num) && Number.isInteger(a.den) && a.den > 0) answer = { kind: a.kind, num: a.num, den: a.den };
  else if (a.kind === 'qr' && Number.isInteger(a.q) && Number.isInteger(a.r) && a.r >= 0) answer = { kind: a.kind, q: a.q, r: a.r };
  else return;
  return { skill: p.skill, question: p.question, answer, ...(typeof p.hint === 'string' ? { hint: p.hint.slice(0, 1000) } : {}) };
}
export function problemKey(problem: MathProblem): string {
  return JSON.stringify([problem.skill, problem.question, normalizeProblem(problem)?.answer]);
}
/** 같은 문제의 정오답이 섞여 있어도 오늘 한 번 틀렸다면 금빛이다. */
export function buildFishPool(attempts: readonly MathAttempt[], filler: readonly MathProblem[], min: number): Fish[] {
  const pool = new Map<string, Fish>();
  const add = (raw: unknown, golden: boolean) => {
    const problem = normalizeProblem(raw);
    if (!problem) return;
    const key = problemKey(problem), previous = pool.get(key);
    if (previous) { if (golden) { previous.golden = true; previous.points = 30; } return; }
    pool.set(key, { id: `fish-${pool.size}`, problem, golden, points: golden ? 30 : 10 });
  };
  for (const attempt of attempts) add(attempt.problem, !attempt.correct);
  for (const problem of filler) { if (pool.size >= Math.max(0, Math.floor(min))) break; add(problem, false); }
  return [...pool.values()];
}
export function fishingScore(caught: readonly Fish[]): number { return caught.reduce((sum, fish) => sum + fish.points, 0); }

/** 잡은 물고기는 계속 제외하고 틀린 물고기만 도망간 시간이 지나면 돌아온다. */
export function availableFish(pool: readonly Fish[], caught: readonly Fish[], escapedUntil: ReadonlyMap<string, number>, now: number): Fish[] {
  const caughtIds = new Set(caught.map(fish => fish.id));
  return pool.filter(fish => !caughtIds.has(fish.id) && (escapedUntil.get(fish.id) ?? 0) <= now).slice(0, 8);
}
/** 이미 잡은 문제도 중복 후보에서 제외한다. 후보가 모두 중복이어도 반복 생성하지 않는다. */
export function refillFishPool(pool: readonly Fish[], caught: readonly Fish[], filler: readonly MathProblem[], min = 8): Fish[] {
  const next = [...pool], seen = new Set(pool.map(fish => problemKey(fish.problem)));
  const caughtIds = new Set(caught.map(fish => fish.id));
  let remaining = pool.filter(fish => !caughtIds.has(fish.id)).length;
  for (const raw of filler) {
    if (remaining >= min) break;
    const problem = normalizeProblem(raw);
    if (!problem || seen.has(problemKey(problem))) continue;
    seen.add(problemKey(problem));
    next.push({ id: `fish-${next.length}`, problem, golden: false, points: 10 }); remaining++;
  }
  return next;
}
export function fishingKeyAction(key: string, count: number, cursor: number, focusedIndex?: number): { type: 'choose' | 'move'; index: number } | null {
  if (count <= 0) return null;
  const base = focusedIndex !== undefined && focusedIndex >= 0 && focusedIndex < count ? focusedIndex : (cursor % count + count) % count;
  if (key === 'Enter') return { type: 'choose', index: base };
  if (key === 'ArrowLeft' || key === 'ArrowRight') return { type: 'move', index: (base + (key === 'ArrowRight' ? 1 : -1) + count) % count };
  return null;
}
