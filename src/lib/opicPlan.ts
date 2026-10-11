import type { OpicData, OpicScript } from './opic';
import type { OpicType } from '../../shared/opic';
import { addDays, parseDateKey } from './date';
import { weekRange, opicWeeklyStats } from './weeklyReport';
import { reusedExpression, updateRetrieval } from './retrieval';
import type { RetrievalItem } from '../types';
export const OPIC_FOCUS = [
  { label: '자기소개 · 서베이 묘사와 일상', types: ['self-intro', 'description', 'routine'] },
  { label: '서베이 과거 경험 · 돌발 묘사', types: ['past', 'description'] },
  { label: '롤플레이 · 비교와 변화', types: ['roleplay-questions', 'roleplay-solution', 'roleplay-experience', 'comparison'] },
  { label: '약한 유형 집중 · 실전 모의고사 주 2회', types: [] },
] as const;
const dayDistance = (a: string, b: string) => {
  const x = parseDateKey(a), y = parseDateKey(b);
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
};
/** 시험일에서 8주를 역산한다. 날짜가 없으면 저장한 시작일부터 8주다. */
export function opicPlan(data: OpicData, today: string) {
  const exam = data.settings.examDate;
  if (exam && exam < today) return undefined;
  const start = exam ? addDays(exam, -55) : data.planStartedAt ?? [...data.attempts.map(a => a.date), ...data.scripts.map(s => s.createdAt)].sort()[0] ?? today;
  const end = exam ?? addDays(start, 55), elapsed = Math.max(0, dayDistance(start, today));
  const phase = Math.min(3, Math.floor(elapsed / 14));
  const range = weekRange(today);
  const practices = opicWeeklyStats(data, range).practices;
  return { start, end, phase, daysLeft: exam ? dayDistance(today, exam) : null, week: Math.min(8, Math.floor(elapsed / 7) + 1), label: OPIC_FOCUS[phase].label, practices };
}
/** 범주 70/20/10과 유형 진도를 결정한 뒤 남은 후보 안에서만 가중치를 준다. */
export function opicFocusWeight(type: OpicType, topic: string, phase: number | undefined, survey: readonly string[], weak: readonly OpicType[] = []): number {
  if (phase === undefined) return 1;
  if (phase === 0) return survey.includes(topic) && ['description', 'routine'].includes(type) || type === 'self-intro' ? 3 : 1;
  if (phase === 1) return type === 'past' && survey.includes(topic) || type === 'description' && !survey.includes(topic) ? 3 : 1;
  if (phase === 2) return type.startsWith('roleplay') || type === 'comparison' ? 3 : 1;
  return weak.includes(type) ? 3 : 1;
}
/** 피드백이 사라진 오래된 노트에도 숫자·단어 한 개가 아닌 짧은 덩어리를 마련한다. */
export function scriptKeyPhrases(script: OpicScript, data: OpicData): string[] {
  const source = script.keyPhrases ?? data.attempts.find(a => a.id === script.id)?.feedback?.keyPhrases ?? [];
  const words = script.text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? [];
  const shortChunks = words.flatMap((_, i) => words.slice(i, i + 3).length === 3 ? [words.slice(i, i + 3).join(' ')] : []);
  const fallback = script.text.split(/[.!?]+/).map(line => line.trim().split(/\s+/).slice(0, 8).join(' '));
  return [...new Set([...source, ...fallback, ...shortChunks].filter(s => reusedExpression(s, [script.text]) && s.length <= 60 && (s.match(/[A-Za-z]+/g) ?? []).length >= 2))].slice(0, 3);
}
export function dueOpicScript(data: OpicData, today: string): OpicScript | undefined {
  return [...data.scripts].filter(s => (s.dueDate ?? addDays(s.createdAt, 1)) <= today && scriptKeyPhrases(s, data).length > 0).sort((a, b) => (a.dueDate ?? a.createdAt).localeCompare(b.dueDate ?? b.createdAt) || a.id.localeCompare(b.id))[0];
}
export function gradeScriptRetell(phrases: readonly string[], transcript: string) {
  const used = phrases.filter(phrase => reusedExpression(phrase, [transcript])).length;
  return { used, total: phrases.length, success: phrases.length > 0 && used >= Math.ceil(phrases.length * 2 / 3) };
}
export function reviewOpicScript(script: OpicScript, success: boolean, today: string): OpicScript {
  const stage = script.stage ?? 0;
  const target: RetrievalItem = { id: script.id, text: 'I practice my answer.', source: 'correction', mode: 'coach', stage, dueDate: script.dueDate ?? today, createdAt: script.createdAt, misses: 0 };
  const result = updateRetrieval([target], [target], success ? [target.text] : [], today).items[0];
  return { ...script, stage: result.stage, dueDate: result.learnedAt ? addDays(today, 7) : result.dueDate };
}
