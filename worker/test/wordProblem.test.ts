import { describe, expect, it } from 'vitest';
import { generationInstructions } from '../src/personas';
import { inputSchemas, outputSchemas } from '../src/validation';
const item = { id: 'word-16', skill: 'g3-div-rem', expression: '23 ÷ 4 =', numbers: ['23', '4'], answerKind: 'qr', interest: '공룡', level: 'g3' };
describe('기존 문장제 계약과 지시문 보강', () => {
  it('기존 묶음 스키마와 id·이야기·물음 출력만 재사용한다', () => {
    expect(inputSchemas['word-problem'].safeParse({ items: Array(8).fill(item) }).success).toBe(true);
    for (const items of [[], Array(9).fill(item), [{ ...item, answer: 5 }], [{ ...item, interest: '가'.repeat(21) }], [{ ...item, numbers: [] }]]) expect(inputSchemas['word-problem'].safeParse({ items }).success).toBe(false);
    expect(outputSchemas['word-problem'].safeParse({ items: [{ id: item.id, story: '23개를 4개씩 묶어요.', question: '몫과 나머지는?' }] }).success).toBe(true);
    expect(outputSchemas['word-problem'].safeParse({ items: [{ id: item.id, story: '23개예요.', question: '물음', answer: 5 }] }).success).toBe(false);
  });
  it('구매 장면·실제 이름·몫과 나머지·분수 표기 규칙이 지시문에 있다', () => {
    const prompt = generationInstructions['word-problem'];
    for (const rule of ['2-3 sentences', 'every given number exactly', 'no other numbers or Korean number words', 'Never give the answer or change the calculation', 'No violence or horror', 'Replace inappropriate interests', 'Never use game-currency purchase or top-up scenes', 'Do not use real people\'s names', 'both quotient (몫) and remainder (나머지)', 'original a/b notation', 'never convert them to decimals or percentages']) expect(prompt).toContain(rule);
  });
});
