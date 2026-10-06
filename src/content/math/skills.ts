import type { Level, MathProblem } from '../../types';
import { randInt, pick, type Rng } from '../../lib/random';
import { add, gcd, lcm, mul, reduce, sub, showFrac, type Frac } from './fraction';

export interface MathSkill {
  id: string;
  level: Level;
  /** 교과 단원 (2022 개정 교육과정) */
  unit: string;
  term: string;
  label: string;
  generate: (rng: Rng) => MathProblem;
}

const int = (value: number) => ({ kind: 'int' as const, value });
const frac = (f: Frac) => {
  const r = reduce(f);
  return { kind: 'fraction' as const, num: r.num, den: r.den };
};
/** 부동소수 오차 제거 */
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** 진분수 하나 (분모 2~maxDen) */
function properFrac(rng: Rng, maxDen = 9): Frac {
  const den = randInt(2, maxDen, rng);
  return { num: randInt(1, den - 1, rng), den };
}

export const SKILLS: MathSkill[] = [
  {
    id: 'g2-addsub2', level: 'g3', unit: '기초 연산', term: '2학년 복습', label: '두 자리 덧셈·뺄셈',
    generate: (rng) => {
      const subtract = rng() < 0.5;
      const a = randInt(subtract ? 20 : 10, subtract ? 99 : 89, rng);
      const b = randInt(10, subtract ? a : 99 - a, rng);
      return { skill: 'g2-addsub2', question: `${a} ${subtract ? '-' : '+'} ${b} =`,
        answer: int(subtract ? a - b : a + b) };
    },
  },
  {
    id: 'g2-times', level: 'g3', unit: '기초 연산', term: '2학년 복습', label: '곱셈구구',
    generate: (rng) => {
      const a = randInt(2, 9, rng), b = randInt(1, 9, rng);
      return { skill: 'g2-times', question: `${a} × ${b} =`, answer: int(a * b) };
    },
  },
  {
    id: 'g3-missing', level: 'g3', unit: '빈칸 추론', term: '3학년', label: '빈칸에 들어갈 수',
    generate: (rng) => {
      const multiply = rng() < 0.5;
      const a = randInt(multiply ? 2 : 10, multiply ? 9 : 600, rng);
      const b = randInt(multiply ? 2 : 10, multiply ? 9 : 399, rng);
      return { skill: 'g3-missing', question: `□ ${multiply ? '×' : '+'} ${b} = ${multiply ? a * b : a + b}`,
        answer: int(a), hint: '결과에서 거꾸로 생각해 봐요.' };
    },
  },
  // ───────── 3학년 ─────────
  {
    id: 'g3-add3',
    level: 'g3',
    unit: '덧셈과 뺄셈',
    term: '3-1',
    label: '세 자리 수 덧셈',
    generate: (rng) => {
      const a = randInt(100, 899, rng);
      const b = randInt(100, 999 - a < 100 ? 100 : 999 - a, rng);
      return { skill: 'g3-add3', question: `${a} + ${b} =`, answer: int(a + b), hint: '일의 자리부터 더하고, 10이 넘으면 받아올려요.' };
    },
  },
  {
    id: 'g3-sub3',
    level: 'g3',
    unit: '덧셈과 뺄셈',
    term: '3-1',
    label: '세 자리 수 뺄셈',
    generate: (rng) => {
      const a = randInt(200, 999, rng);
      const b = randInt(100, a - 1, rng);
      return { skill: 'g3-sub3', question: `${a} - ${b} =`, answer: int(a - b), hint: '뺄 수 없으면 윗자리에서 10을 받아내려요.' };
    },
  },
  {
    id: 'g3-div-basic',
    level: 'g3',
    unit: '나눗셈',
    term: '3-1',
    label: '곱셈구구로 나눗셈',
    generate: (rng) => {
      const b = randInt(2, 9, rng);
      const q = randInt(2, 9, rng);
      return { skill: 'g3-div-basic', question: `${b * q} ÷ ${b} =`, answer: int(q), hint: `${b} × □ = ${b * q} 를 생각해 봐요.` };
    },
  },
  {
    id: 'g3-mul2x1',
    level: 'g3',
    unit: '곱셈',
    term: '3-1',
    label: '두 자리 × 한 자리',
    generate: (rng) => {
      const a = randInt(12, 99, rng);
      const b = randInt(2, 9, rng);
      return { skill: 'g3-mul2x1', question: `${a} × ${b} =`, answer: int(a * b), hint: '일의 자리, 십의 자리를 따로 곱해서 더해요.' };
    },
  },
  {
    id: 'g3-mul3x1',
    level: 'g3',
    unit: '곱셈',
    term: '3-2',
    label: '세 자리 × 한 자리',
    generate: (rng) => {
      const a = randInt(102, 999, rng);
      const b = randInt(2, 9, rng);
      return { skill: 'g3-mul3x1', question: `${a} × ${b} =`, answer: int(a * b) };
    },
  },
  {
    id: 'g3-mul2x2',
    level: 'g3',
    unit: '곱셈',
    term: '3-2',
    label: '두 자리 × 두 자리',
    generate: (rng) => {
      const a = randInt(11, 99, rng);
      const b = randInt(11, 49, rng);
      return { skill: 'g3-mul2x2', question: `${a} × ${b} =`, answer: int(a * b), hint: `${a} × ${b % 10} 와 ${a} × ${b - (b % 10)} 를 더해요.` };
    },
  },
  {
    id: 'g3-div-rem',
    level: 'g3',
    unit: '나눗셈',
    term: '3-2',
    label: '두 자리 ÷ 한 자리 (나머지)',
    generate: (rng) => {
      const b = randInt(2, 9, rng);
      const q = randInt(Math.ceil(10 / b), Math.floor(99 / b) - 1, rng);
      const r = randInt(0, b - 1, rng);
      return {
        skill: 'g3-div-rem',
        question: `${b * q + r} ÷ ${b} =`,
        answer: { kind: 'qr', q, r },
        hint: '나머지는 나누는 수보다 작아야 해요.',
      };
    },
  },

  // ───────── 5학년 ─────────
  {
    id: 'g5-mixed',
    level: 'g5',
    unit: '자연수의 혼합 계산',
    term: '5-1',
    label: '혼합 계산',
    generate: (rng) => {
      const forms: (() => MathProblem)[] = [
        () => {
          const a = randInt(10, 60, rng), b = randInt(2, 9, rng), c = randInt(2, 9, rng);
          return { skill: 'g5-mixed', question: `${a} + ${b} × ${c} =`, answer: int(a + b * c) };
        },
        () => {
          const b = randInt(2, 9, rng), c = randInt(2, 9, rng), a = b * c + randInt(1, 40, rng);
          return { skill: 'g5-mixed', question: `${a} - ${b} × ${c} =`, answer: int(a - b * c) };
        },
        () => {
          const a = randInt(5, 30, rng), b = randInt(2, 20, rng), c = randInt(2, 9, rng);
          return { skill: 'g5-mixed', question: `(${a} + ${b}) × ${c} =`, answer: int((a + b) * c) };
        },
        () => {
          const c = randInt(2, 9, rng), q = randInt(2, 12, rng), a = randInt(5, 50, rng);
          return { skill: 'g5-mixed', question: `${a} + ${c * q} ÷ ${c} =`, answer: int(a + q) };
        },
        () => {
          const d = randInt(2, 9, rng), q = randInt(2, 9, rng), b = randInt(1, 9, rng), a = d * q + b;
          const m = randInt(2, 6, rng);
          return { skill: 'g5-mixed', question: `(${a} - ${b}) ÷ ${d} × ${m} =`, answer: int(q * m) };
        },
      ];
      return { ...pick(forms, rng)(), hint: '괄호 → 곱셈·나눗셈 → 덧셈·뺄셈 순서예요.' };
    },
  },
  {
    id: 'g5-gcd',
    level: 'g5',
    unit: '약수와 배수',
    term: '5-1',
    label: '최대공약수',
    generate: (rng) => {
      const g = randInt(2, 12, rng);
      let x = randInt(2, 9, rng);
      let y = randInt(2, 9, rng);
      while (gcd(x, y) !== 1 || x === y) {
        x = randInt(1, 9, rng);
        y = randInt(2, 9, rng);
      }
      return { skill: 'g5-gcd', question: `${g * x} 과 ${g * y} 의 최대공약수는?`, answer: int(g), hint: '두 수를 함께 나눌 수 있는 가장 큰 수예요.' };
    },
  },
  {
    id: 'g5-lcm',
    level: 'g5',
    unit: '약수와 배수',
    term: '5-1',
    label: '최소공배수',
    generate: (rng) => {
      let a = randInt(2, 15, rng);
      let b = randInt(2, 15, rng);
      while (a === b) b = randInt(2, 15, rng);
      if (a > b) [a, b] = [b, a];
      return { skill: 'g5-lcm', question: `${a} 와 ${b} 의 최소공배수는?`, answer: int(lcm(a, b)), hint: '두 수의 공통인 배수 중 가장 작은 수예요.' };
    },
  },
  {
    id: 'g5-reduce',
    level: 'g5',
    unit: '약분과 통분',
    term: '5-1',
    label: '기약분수로 나타내기',
    generate: (rng) => {
      const f = properFrac(rng, 9);
      const base = reduce(f);
      const k = randInt(2, 8, rng);
      const shown = { num: base.num * k, den: base.den * k };
      return { skill: 'g5-reduce', question: `${shown.num}/${shown.den} 을 기약분수로`, answer: frac(base), hint: '분자와 분모를 최대공약수로 나눠요.' };
    },
  },
  {
    id: 'g5-frac-add',
    level: 'g5',
    unit: '분수의 덧셈과 뺄셈',
    term: '5-1',
    label: '분모가 다른 분수의 덧셈',
    generate: (rng) => {
      const a = properFrac(rng, 8);
      let b = properFrac(rng, 8);
      while (b.den === a.den) b = properFrac(rng, 8);
      return { skill: 'g5-frac-add', question: `${a.num}/${a.den} + ${b.num}/${b.den} =`, answer: frac(add(a, b)), hint: '통분해서 분모를 같게 만든 다음 더해요.' };
    },
  },
  {
    id: 'g5-frac-sub',
    level: 'g5',
    unit: '분수의 덧셈과 뺄셈',
    term: '5-1',
    label: '분모가 다른 분수의 뺄셈',
    generate: (rng) => {
      let a = properFrac(rng, 8);
      let b = properFrac(rng, 8);
      while (b.den === a.den || a.num * b.den === b.num * a.den) b = properFrac(rng, 8);
      if (a.num * b.den < b.num * a.den) [a, b] = [b, a];
      return { skill: 'g5-frac-sub', question: `${a.num}/${a.den} - ${b.num}/${b.den} =`, answer: frac(sub(a, b)), hint: '통분해서 분모를 같게 만든 다음 빼요.' };
    },
  },
  {
    id: 'g5-round',
    level: 'g5',
    unit: '수의 범위와 어림하기',
    term: '5-2',
    label: '올림·버림·반올림',
    generate: (rng) => {
      const n = randInt(1001, 9999, rng);
      const places = [
        { name: '십의 자리', unit: 10 },
        { name: '백의 자리', unit: 100 },
      ] as const;
      const p = pick(places, rng);
      const mode = pick(['올림', '버림', '반올림'] as const, rng);
      const fn = mode === '올림' ? Math.ceil : mode === '버림' ? Math.floor : Math.round;
      return {
        skill: 'g5-round',
        question: `${n} 을 ${mode}하여 ${p.name}까지 나타내면?`,
        answer: int(fn(n / p.unit) * p.unit),
        hint: `${p.name} 아래 숫자를 보고 결정해요.`,
      };
    },
  },
  {
    id: 'g5-frac-mul',
    level: 'g5',
    unit: '분수의 곱셈',
    term: '5-2',
    label: '분수의 곱셈',
    generate: (rng) => {
      if (rng() < 0.4) {
        const n = randInt(2, 12, rng);
        const f = properFrac(rng, 9);
        return { skill: 'g5-frac-mul', question: `${n} × ${f.num}/${f.den} =`, answer: frac(mul({ num: n, den: 1 }, f)), hint: '자연수와 분자를 곱하고, 약분해요.' };
      }
      const a = properFrac(rng, 9);
      const b = properFrac(rng, 9);
      return { skill: 'g5-frac-mul', question: `${a.num}/${a.den} × ${b.num}/${b.den} =`, answer: frac(mul(a, b)), hint: '분자끼리, 분모끼리 곱해요.' };
    },
  },
  {
    id: 'g5-dec-mul',
    level: 'g5',
    unit: '소수의 곱셈',
    term: '5-2',
    label: '소수의 곱셈',
    generate: (rng) => {
      if (rng() < 0.5) {
        const a = randInt(11, 99, rng) / 10;
        const n = randInt(2, 9, rng);
        return { skill: 'g5-dec-mul', question: `${a} × ${n} =`, answer: { kind: 'decimal', value: round6(a * n) } };
      }
      const a = randInt(11, 99, rng) / 10;
      const b = randInt(2, 9, rng) / 10;
      return {
        skill: 'g5-dec-mul',
        question: `${a} × ${b} =`,
        answer: { kind: 'decimal', value: round6(a * b) },
        hint: '자연수처럼 곱하고, 소수점 아래 자릿수를 더한 만큼 소수점을 찍어요.',
      };
    },
  },
  {
    id: 'g5-avg',
    level: 'g5',
    unit: '평균과 가능성',
    term: '5-2',
    label: '평균 구하기',
    generate: (rng) => {
      const count = randInt(3, 5, rng);
      const avg = randInt(5, 30, rng);
      let values: number[];
      do {
        values = Array.from({ length: count - 1 }, () => avg + randInt(-5, 5, rng));
        values.push(avg * count - values.reduce((s, v) => s + v, 0));
      } while (values[count - 1] < 1);
      const subject = pick(['줄넘기 횟수', '읽은 쪽수', '턱걸이 기록', '받은 칭찬 스티커'], rng);
      return {
        skill: 'g5-avg',
        question: `${subject}: ${values.join(', ')} 의 평균은?`,
        answer: int(avg),
        hint: '모두 더한 다음 자료의 개수로 나눠요.',
      };
    },
  },
];

export const SKILL_MAP: Record<string, MathSkill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function skillsForLevel(level: Level): MathSkill[] {
  return SKILLS.filter((s) => s.level === level);
}

/** 오답노트 화면 등에서 쓰는 정답 문자열 */
export function formatAnswer(p: MathProblem): string {
  const a = p.answer;
  switch (a.kind) {
    case 'int':
    case 'decimal':
      return String(a.value);
    case 'fraction':
      return showFrac({ num: a.num, den: a.den });
    case 'qr':
      return a.r === 0 ? `${a.q}` : `몫 ${a.q}, 나머지 ${a.r}`;
  }
}
