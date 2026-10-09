import { describe, expect, it } from 'vitest';
import { generationInstructions } from '../src/personas';
import { inputSchemas, outputSchemas, generateSchema } from '../src/validation';

describe('기존 독서 질문 지시문 보강', () => {
  it('요약만 사용하고 개인정보를 질문과 답에 넣지 않는다', () => {
    const prompt = generationInstructions['reading-quiz'];
    for (const rule of ['only the supplied summary', 'never search or invent book facts', 'unless they are book characters or the author', 'friends, family or schools', 'addresses or contact information', 'in questions or answers']) expect(prompt).toContain(rule);
  });
  it('아이 학년 수준·안전·한 문장 답과 보호자 적용·종목 권유 금지를 명시한다', () => {
    const prompt = generationInstructions['reading-quiz'];
    for (const rule of ['mostly fact questions, one why question', 'short Korean appropriate for the specified grade', 'no frightening or violent questions', 'one-sentence answers', 'mix fact, why and apply', 'work or everyday life', 'never recommend buying or selling specific investment securities']) expect(prompt).toContain(rule);
  });
  it('기존 종류와 입력·출력 계약을 유지하고 아이와 보호자가 모두 호출한다', () => {
    for (const [profileId, level, count] of [['kid1', 'g5', 4], ['kid2', 'g3', 3], ['parent', 'adult', 5]]) {
      const input = { title: '책', author: '', summary: '가'.repeat(40), level, count };
      expect(inputSchemas['reading-quiz'].safeParse(input).success).toBe(true);
      expect(generateSchema.safeParse({ profileId, level, kind: 'reading-quiz', input }).success).toBe(true);
    }
    expect(outputSchemas['reading-quiz'].safeParse({ cards: [{ q: '질문', a: '답', type: 'fact' }, { q: '이유', a: '답', type: 'why' }, { q: '적용', a: '답', type: 'apply' }] }).success).toBe(true);
  });
});
