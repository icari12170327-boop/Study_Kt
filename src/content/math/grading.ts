import type { Answer } from '../../types';
import { gcd } from './fraction';

/** 사용자 입력 (모든 칸은 문자열) */
export interface AnswerInput {
  value?: string;
  whole?: string;
  num?: string;
  den?: string;
  q?: string;
  r?: string;
}

const toNum = (s: string | undefined): number | undefined => {
  if (s === undefined || s.trim() === '') return undefined;
  const n = Number(s.trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

export type GradeResult = { correct: boolean; reason?: string };

export function gradeAnswer(answer: Answer, input: AnswerInput): GradeResult {
  switch (answer.kind) {
    case 'int':
    case 'decimal': {
      const v = toNum(input.value);
      if (v === undefined) return { correct: false, reason: '답을 입력해 주세요.' };
      return { correct: Math.abs(v - answer.value) < 1e-9 };
    }
    case 'qr': {
      const q = toNum(input.q);
      const r = toNum(input.r) ?? 0;
      if (q === undefined) return { correct: false, reason: '몫을 입력해 주세요.' };
      return { correct: q === answer.q && r === answer.r };
    }
    case 'fraction': {
      const whole = toNum(input.whole) ?? 0;
      const num = toNum(input.num);
      const den = toNum(input.den);
      const fracBlank = (num === undefined && den === undefined) || num === 0;
      if (fracBlank) {
        // 자연수만 입력: 답이 자연수일 때만 정답
        if (input.whole === undefined || input.whole.trim() === '') return { correct: false, reason: '답을 입력해 주세요.' };
        return { correct: answer.den === 1 && whole === answer.num };
      }
      if (num === undefined || den === undefined || den === 0) return { correct: false, reason: '분자와 분모를 모두 입력해 주세요.' };
      const totalNum = whole * den + num;
      const sameValue = totalNum * answer.den === answer.num * den;
      if (!sameValue) return { correct: false };
      if (gcd(num, den) !== 1) return { correct: false, reason: '값은 맞았어요! 기약분수로 약분해 보세요.' };
      return { correct: true };
    }
  }
}
