import type { Level, MathProblem } from '../../types';
import type { QueueItem } from './session';

export const WORD_PROBLEM_TIMEOUT_MS = 10000;
export interface WordProblemInput {
  id: string; skill: string; expression: string; numbers: string[];
  answerKind: MathProblem['answer']['kind']; interest: string; level: Level;
}
export interface WordProblemStory { id: string; story: string; question: string }
const numberTokens = (text: string): string[] => text.match(/\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?/g) ?? [];

/** 식에서 숫자의 원래 표기를 보존한다. 분수는 분자·분모를 나누지 않는다. */
export function extractNumbers(problem: MathProblem): string[] { return numberTokens(problem.question); }
export function normalizeWordProblemRatio(raw: unknown): number { return raw === 0 || raw === 20 || raw === 40 ? raw : 20; }
/** 대화 관심사는 그대로 재사용하되 문장제에 보낼 길이와 개수만 제한한다. */
export function normalizeWordInterests(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((value): value is string => typeof value === 'string')
    .map(value => value.replace(/[\r\n]/g, ' ').trim().slice(0, 20)).filter(Boolean))].slice(0, 5) : [];
}
/** 같은 숫자의 재등장은 허용하지만 원래 토큰의 누락·추가·표기 변형은 거부한다. */
export function validateStory(story: string, question: string, numbers: string[]): boolean {
  if (typeof story !== 'string' || typeof question !== 'string' || !story.trim() || !question.trim() || story.length > 1000 || question.length > 300 || !numbers.length) return false;
  const text = `${story}\n${question}`;
  // 음수·지수·천 단위 쉼표 표기는 원래 식에 없는 수를 만들 수 있어 받지 않는다.
  if (/(?:^|[^\d])[-−]\s*\d|\d\s*[eE]\s*[+-]?\s*\d|\d,\d/.test(text)) return false;
  const tokens = numberTokens(text), allowed = new Set(numbers);
  return tokens.every(token => allowed.has(token)) && numbers.every(number =>
    tokens.filter(token => token === number).length >= numbers.filter(token => token === number).length);
}
/** 정답·식·힌트는 유지하고 AI 이야기만 제거한다. 오답과 게임은 이 형태를 쓴다. */
export function withoutStory(problem: MathProblem): MathProblem {
  const original = { ...problem };
  delete original.story;
  return original;
}
/** 현재 문제는 변환하지 않고 뒤쪽의 새 문제만 최대 8개 고른다. */
export function planWordProblems(queue: readonly QueueItem[], ratio: unknown, interests: unknown, level: Level): WordProblemInput[] {
  const count = Math.min(8, Math.round(queue.length * normalizeWordProblemRatio(ratio) / 100));
  if (!count) return [];
  const topics = normalizeWordInterests(interests);
  return queue.map((item, index) => ({ item, index })).filter(({ item, index }) => index > 0 && !item.wrongId && !item.problem.story && extractNumbers(item.problem).length > 0)
    .slice(-count).map(({ item, index }, i) => ({ id: `word-${index}`, skill: item.problem.skill,
      expression: item.problem.question, numbers: extractNumbers(item.problem), answerKind: item.problem.answer.kind,
      interest: topics[i % topics.length] ?? '동물', level }));
}
/** 늦게 도착해도 현재·지난 문제와 오답 복습은 그대로 둔다. 검증 실패는 원래 식으로 남긴다. */
export function insertWordProblems(queue: readonly QueueItem[], plan: readonly WordProblemInput[], response: unknown, currentIndex: number): QueueItem[] {
  const rows = response && typeof response === 'object' && 'items' in response && Array.isArray(response.items) ? response.items as unknown[] : [];
  if (rows.length > 8) return [...queue];
  const stories = rows.filter((row): row is WordProblemStory => !!row && typeof row === 'object' && 'id' in row && typeof row.id === 'string' &&
    'story' in row && typeof row.story === 'string' && 'question' in row && typeof row.question === 'string');
  return queue.map((item, index) => {
    if (index <= currentIndex || item.wrongId || item.problem.story) return item;
    const input = plan.find(row => row.id === `word-${index}`);
    const matches = stories.filter(row => row.id === input?.id);
    if (!input || matches.length !== 1 || input.expression !== item.problem.question) return item;
    const candidate = matches[0];
    if (!validateStory(candidate.story, candidate.question, extractNumbers(item.problem)) ||
      (item.problem.answer.kind === 'qr' && (!candidate.question.includes('몫') || !candidate.question.includes('나머지')))) return item;
    return { ...item, problem: { ...item.problem, story: `${candidate.story.trim()}\n${candidate.question.trim()}` } };
  });
}
