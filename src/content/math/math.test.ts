import { describe, expect, it } from 'vitest';
import { SKILLS } from './skills';
import { gradeAnswer } from './grading';
import { buildMathQueue } from './session';
import { gcd } from './fraction';
import { seededRng } from '../../lib/random';
import type { WrongItem } from '../../types';

describe('연산 문제 생성기', () => {
  for (const skill of SKILLS) {
    it(`${skill.id}: 정답이 유효하고 정답 입력이 채점을 통과한다`, () => {
      const rng = seededRng(42);
      for (let i = 0; i < 300; i++) {
        const p = skill.generate(rng);
        expect(p.skill).toBe(skill.id);
        expect(p.question.length).toBeGreaterThan(0);
        const a = p.answer;
        switch (a.kind) {
          case 'int':
            expect(Number.isInteger(a.value)).toBe(true);
            expect(a.value).toBeGreaterThanOrEqual(0);
            expect(gradeAnswer(a, { value: String(a.value) }).correct).toBe(true);
            break;
          case 'decimal':
            expect(gradeAnswer(a, { value: String(a.value) }).correct).toBe(true);
            break;
          case 'qr':
            expect(gradeAnswer(a, { q: String(a.q), r: String(a.r) }).correct).toBe(true);
            break;
          case 'fraction': {
            expect(gcd(a.num, a.den)).toBe(1);
            expect(a.num).toBeGreaterThan(0);
            const whole = Math.floor(a.num / a.den);
            const rest = a.num % a.den;
            const input = rest === 0 ? { whole: String(whole) } : { whole: whole ? String(whole) : '', num: String(rest), den: String(a.den) };
            expect(gradeAnswer(a, input).correct).toBe(true);
            break;
          }
        }
      }
    });
  }

  it('세 자리 덧셈은 결과가 999 이하', () => {
    const rng = seededRng(1);
    const add = SKILLS.find((s) => s.id === 'g3-add3')!;
    for (let i = 0; i < 500; i++) {
      const p = add.generate(rng);
      if (p.answer.kind === 'int') expect(p.answer.value).toBeLessThanOrEqual(999);
    }
  });

  it('나머지 있는 나눗셈은 피제수가 두 자리 수', () => {
    const rng = seededRng(2);
    const div = SKILLS.find((s) => s.id === 'g3-div-rem')!;
    for (let i = 0; i < 500; i++) {
      const dividend = Number(div.generate(rng).question.split(' ')[0]);
      expect(dividend).toBeGreaterThanOrEqual(10);
      expect(dividend).toBeLessThanOrEqual(99);
    }
  });
});

describe('채점', () => {
  const half = { kind: 'fraction' as const, num: 1, den: 2 };
  const sevenThirds = { kind: 'fraction' as const, num: 7, den: 3 };

  it('분수: 대분수와 가분수 모두 정답', () => {
    expect(gradeAnswer(sevenThirds, { whole: '2', num: '1', den: '3' }).correct).toBe(true);
    expect(gradeAnswer(sevenThirds, { num: '7', den: '3' }).correct).toBe(true);
  });

  it('분수: 약분하지 않으면 안내 메시지와 함께 오답 처리하지 않는다', () => {
    const r = gradeAnswer(half, { num: '2', den: '4' });
    expect(r.correct).toBe(false);
    expect(r.reason).toContain('기약분수');
  });

  it('분수: 값이 다르면 오답', () => {
    expect(gradeAnswer(half, { num: '1', den: '3' })).toEqual({ correct: false });
  });

  it('분수: 답이 자연수면 자연수 칸만 채워도 정답', () => {
    expect(gradeAnswer({ kind: 'fraction', num: 3, den: 1 }, { whole: '3' }).correct).toBe(true);
    expect(gradeAnswer({ kind: 'fraction', num: 3, den: 1 }, { whole: '3', num: '0', den: '5' }).correct).toBe(true);
  });

  it('빈 입력은 이유를 돌려준다', () => {
    expect(gradeAnswer({ kind: 'int', value: 3 }, {}).reason).toBeDefined();
    expect(gradeAnswer(half, {}).reason).toBeDefined();
  });

  it('소수 비교는 부동소수 오차를 무시한다', () => {
    expect(gradeAnswer({ kind: 'decimal', value: 0.36 }, { value: '0.36' }).correct).toBe(true);
    expect(gradeAnswer({ kind: 'decimal', value: 0.36 }, { value: '.36' }).correct).toBe(true);
  });

  it('몫과 나머지: 나머지 칸을 비우면 0', () => {
    expect(gradeAnswer({ kind: 'qr', q: 5, r: 0 }, { q: '5' }).correct).toBe(true);
    expect(gradeAnswer({ kind: 'qr', q: 5, r: 2 }, { q: '5' }).correct).toBe(false);
  });
});

describe('연산 세션 구성', () => {
  const wrong = (id: string): WrongItem => ({
    id,
    addedAt: '2026-10-01',
    given: '1',
    problem: { skill: 'g3-add3', question: '1 + 1 =', answer: { kind: 'int', value: 2 } },
  });

  it('오답노트는 최대 절반까지 앞에 나온다', () => {
    const q = buildMathQueue(['g3-add3', 'g3-sub3'], Array.from({ length: 20 }, (_, i) => wrong(String(i))), 10, seededRng(3));
    expect(q).toHaveLength(10);
    expect(q.slice(0, 5).every((x) => x.wrongId)).toBe(true);
    expect(q.slice(5).every((x) => !x.wrongId)).toBe(true);
  });

  it('켜진 단원에서 고르게 출제된다', () => {
    const q = buildMathQueue(['g3-add3', 'g3-sub3'], [], 10, seededRng(4));
    const counts = q.reduce<Record<string, number>>((m, x) => ({ ...m, [x.problem.skill]: (m[x.problem.skill] ?? 0) + 1 }), {});
    expect(counts['g3-add3']).toBe(5);
    expect(counts['g3-sub3']).toBe(5);
  });
});
