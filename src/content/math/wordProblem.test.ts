import { describe, expect, it } from 'vitest';
import type { MathProblem } from '../../types';
import { extractNumbers, insertWordProblems, normalizeWordInterests, normalizeWordProblemRatio, planWordProblems, validateStory, withoutStory } from './wordProblem';
import type { QueueItem } from './session';
const problem: MathProblem = { skill: 'g3-mul2x1', question: '23 × 4 =', answer: { kind: 'int', value: 92 } };
const queue: QueueItem[] = Array.from({ length: 20 }, () => ({ problem: { ...problem } }));
const valid = { story: '공룡 스티커가 23개씩 담긴 봉투가 4개 있어요.', question: '스티커는 모두 몇 개인가요?' };
describe('숫자 토큰과 이야기 검증', () => {
  it.each([
    ['23 × 4 =', ['23', '4']], ['1.25 × 0.4 =', ['1.25', '0.4']],
    ['3/4 + 1/2 =', ['3/4', '1/2']], ['23 ÷ 4 =', ['23', '4']], ['□ + 8 = 23', ['8', '23']],
  ])('식 %s의 표기를 유지한다', (question, expected) => expect(extractNumbers({ ...problem, question })).toEqual(expected));
  it('정답은 토큰에 포함하지 않고 올바른 이야기는 받는다', () => {
    expect(extractNumbers(problem)).not.toContain('92'); expect(validateStory(valid.story, valid.question, ['23', '4'])).toBe(true);
  });
  it.each(['23개 있어요.', '23개씩 4묶음과 5개 있어요.', '32개씩 4묶음이에요.', '023개씩 4묶음이에요.', '-23개씩 4묶음이에요.', '2.3e1개씩 4묶음이에요.', '2,300개와 4개예요.'])('누락·추가·변형을 거부: %s', story => expect(validateStory(story, valid.question, ['23', '4'])).toBe(false));
  it('소수는 소수점·끝자리까지, 분수는 분수 그대로 비교한다', () => {
    expect(validateStory('끈 1.25m와 0.4m가 있어요.', '전체 길이는?', ['1.25', '0.4'])).toBe(true);
    expect(validateStory('끈 1.25m와 0.40m가 있어요.', '전체 길이는?', ['1.25', '0.4'])).toBe(false);
    expect(validateStory('리본 3/4m와 1/2m가 있어요.', '전체 길이는?', ['3/4', '1/2'])).toBe(true);
    for (const story of ['0.75m와 1/2m예요.', '3 / 4m와 1/2m예요.', '6/8m와 1/2m예요.']) expect(validateStory(story, '전체 길이는?', ['3/4', '1/2'])).toBe(false);
  });
  it('중복 피연산자의 누락은 막고 물음에서 같은 수를 다시 말하는 것은 허용한다', () => {
    expect(validateStory('23개가 있어요.', '전체는?', ['23', '23'])).toBe(false);
    expect(validateStory('23개가 있고 23개를 더 받았어요.', '23개보다 얼마나 많을까요?', ['23', '23'])).toBe(true);
  });
  it('빈 문장·너무 긴 출력도 거부한다', () => {
    for (const [story, question] of [['', '23 4'], ['23 4', ' '], ['가'.repeat(1001)+'23 4', '물음'], ['23 4', '가'.repeat(301)]]) expect(validateStory(story, question, ['23','4'])).toBe(false);
  });
});
describe('기다리지 않는 문장제 삽입', () => {
  it.each([[0, 0], [20, 4], [40, 8]])('비율 %s에서 %s개를 한 묶음으로, 정답 없이 계획한다', (ratio, count) => {
    const plan = planWordProblems(queue, ratio, ['공룡'], 'g3'); expect(plan).toHaveLength(count);
    for (const row of plan) { expect(row).not.toHaveProperty('answer'); expect(row).not.toHaveProperty('hint'); expect(row.numbers).toEqual(['23', '4']); }
  });
  it('대기 중에는 원래 문제이고 응답 후에도 현재·지난 문제는 바꾸지 않는다', () => {
    const original = structuredClone(queue), plan = planWordProblems(queue, 40, ['공룡'], 'g3');
    const rows = plan.map(row => ({ id: row.id, ...valid }));
    expect(insertWordProblems(queue, plan, undefined, 0)).toEqual(queue);
    const next = insertWordProblems(queue, plan, { items: rows }, 15);
    expect(next.slice(0, 16)).toEqual(queue.slice(0, 16)); expect(next.slice(16).every(item => !!item.problem.story)).toBe(true);
    expect(next.map(item => item.problem.answer)).toEqual(queue.map(item => item.problem.answer)); expect(queue).toEqual(original);
    expect(insertWordProblems(queue, plan, { items: rows }, 20)).toEqual(queue);
  });
  it('오답 복습·검증 실패·요청 밖 id·중복 id는 변환하지 않는다', () => {
    const reviewQueue = queue.map((item, i) => i === 19 ? { ...item, wrongId: 'kept' } : item);
    const plan = planWordProblems(reviewQueue, 20, ['공룡'], 'g3'); expect(plan.some(row => row.id === 'word-19')).toBe(false);
    const id = plan[0].id;
    for (const rows of [[{ id, ...valid, story: '32개와 4개예요.' }], [{ id: 'word-19', ...valid }], [{ id, ...valid }, { id, ...valid }]]) expect(insertWordProblems(reviewQueue, plan, { items: rows }, 0)).toEqual(reviewQueue);
  });
  it('몫과 나머지를 모두 묻지 않는 이야기와 분수 변환을 거부한다', () => {
    const qr = queue.map(item => ({ ...item, problem: { ...item.problem, question: '23 ÷ 4 =', answer: { kind: 'qr' as const, q: 5, r: 3 } } }));
    const plan = planWordProblems(qr, 20, [], 'g3');
    expect(insertWordProblems(qr, plan, { items: [{ id: plan[0].id, story: '스티커 23개를 4개씩 나눠요.', question: '몫은 얼마인가요?' }] }, 0)).toEqual(qr);
    expect(insertWordProblems(qr, plan, { items: [{ id: plan[0].id, story: '스티커 23개를 4개씩 나눠요.', question: '몫과 나머지는 얼마인가요?' }] }, 0).filter(item => item.problem.story)).toHaveLength(1);
  });
  it('새 관심사 필드 없이 길이·줄바꿈·개수를 제한하고 식만 복원한다', () => {
    expect(normalizeWordInterests(['공룡\n동물', '가'.repeat(30), '축구','축구','우주','바다','로봇'])).toEqual(['공룡 동물', '가'.repeat(20), '축구', '우주','바다']);
    expect(normalizeWordProblemRatio(undefined)).toBe(20); expect(normalizeWordProblemRatio(13)).toBe(20);
    expect(withoutStory({ ...problem, story: valid.story })).toEqual(problem);
  });
});
