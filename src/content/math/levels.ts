import type { Level, MathLevelState } from '../../types';

export interface MathLevel {
  level: number;
  mainSkills: readonly string[];
  targetSec: number;
}

const table = (skills: string[][]): MathLevel[] =>
  skills.map((mainSkills, i) => ({ level: i + 1, mainSkills, targetSec: 25 }));

export const G3_LEVELS = table([
  ['g2-addsub2', 'g2-times'],
  ['g3-add3'],
  ['g3-sub3'],
  ['g3-div-basic'],
  ['g3-mul2x1'],
  ['g3-mul3x1'],
  ['g3-div-rem'],
  ['g3-mul2x2'],
  ['g3-add3', 'g3-sub3', 'g3-div-basic', 'g3-mul2x1', 'g3-mul3x1', 'g3-div-rem', 'g3-mul2x2', 'g3-missing'],
]);

export const G5_LEVELS = table([
  ['g5-mixed'],
  ['g5-gcd', 'g5-lcm'],
  ['g5-reduce'],
  ['g5-frac-add'],
  ['g5-frac-sub'],
  ['g5-round'],
  ['g5-frac-mul'],
  ['g5-dec-mul'],
  [
    'g5-mixed',
    'g5-gcd',
    'g5-lcm',
    'g5-reduce',
    'g5-frac-add',
    'g5-frac-sub',
    'g5-round',
    'g5-frac-mul',
    'g5-dec-mul',
    'g5-avg',
  ],
]);

export const mathLevelsFor = (grade: Level): readonly MathLevel[] => (grade === 'g3' ? G3_LEVELS : G5_LEVELS);

export const clampMathLevel = (level: number, grade: Level): number =>
  Math.max(1, Math.min(mathLevelsFor(grade).length, Math.trunc(level)));

export function defaultMathState(grade: Level): MathLevelState {
  return { level: grade === 'g3' ? 3 : 4, history: [] };
}

export function reviewSkills(grade: Level, level: number): string[] {
  return [
    ...new Set(
      mathLevelsFor(grade)
        .slice(0, clampMathLevel(level, grade) - 1)
        .flatMap((row) => row.mainSkills),
    ),
  ];
}
