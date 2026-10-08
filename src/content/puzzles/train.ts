import { randInt, type Rng } from '../../lib/random';
import type { PuzzleGenerator } from './types';
export interface TrainView { numbers: number[] }
export const trainGenerator: PuzzleGenerator<TrainView, number> = {
  type: 'train',
  generate(difficulty, rng: Rng) {
    const seed = randInt(0, 0xffffffff, rng);
    const step = randInt(1, 5, rng), second = step + randInt(1, 4, rng);
    const growth = randInt(1, 3, rng);
    const start = difficulty === 2 ? step * 7 + randInt(1, 10, rng) : randInt(1, 6, rng);
    const numbers = [start];
    for (let i = 0; i < 5; i++) {
      const current = numbers[numbers.length - 1];
      numbers.push(difficulty === 3 ? current * 2 : current + (difficulty === 2 ? -step :
        difficulty === 4 ? (i % 2 ? second : step) : difficulty === 5 ? step + i * growth : step));
    }
    const hint = difficulty === 1 ? `앞 수에 ${step}을 더해요.` : difficulty === 2 ? `앞 수에서 ${step}을 빼요.` :
      difficulty === 3 ? '앞 수의 두 배가 돼요.' : difficulty === 4 ? `${step}, ${second}를 번갈아 더해요.` :
        `더하는 수가 ${growth}씩 커져요. 첫 번째는 ${step}을 더했어요.`;
    return { type: 'train', difficulty, seed, view: { numbers: numbers.slice(0, -1) }, answer: numbers[5], hint };
  },
  check(puzzle, input) { return input === puzzle.answer; },
};
