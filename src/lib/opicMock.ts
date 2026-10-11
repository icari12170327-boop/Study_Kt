import type { OpicAttempt, OpicSettings } from './opic';
import { OPIC_QUESTIONS, QUESTION_MAP, SURVEY_TOPICS, UNEXPECTED_TOPICS, TYPE_NAMES } from '../content/opic/questions';
import { OPIC_BANDS, type OpicType } from '../../shared/opic';
import type { Rng } from './random';
import { validRetrievalDate } from './retrieval';
export interface OpicMock {
  id: string; date: string; difficulty: OpicSettings['difficulty']; questionIds: string[];
  answers: OpicAttempt[]; elapsedSec: number; adjustment?: 'easier' | 'same' | 'harder'; adjustedDifficulty?: OpicSettings['difficulty']; feedbackAttempted?: boolean;
}
/** 완료 기록은 마지막 답변부터 보관하고 이후 피드백도 같은 ID에 갱신한다. */
export function archiveCompletedMock(mocks: readonly OpicMock[], mock: OpicMock): OpicMock[] {
  if (mock.answers.length !== 15) return [...mocks];
  const index = mocks.findIndex(row => row.id === mock.id), result = [...mocks], saved = structuredClone(mock);
  if (index < 0) result.push(saved); else {
    const previous = result[index];
    saved.elapsedSec = Math.max(saved.elapsedSec, previous.elapsedSec);
    saved.answers = saved.answers.map((answer, i) => {
      const prior = previous.answers[i];
      return !answer.feedback && prior?.questionId === answer.questionId && prior.transcript === answer.transcript && prior.feedback ? { ...answer, feedback: structuredClone(prior.feedback) } : answer;
    });
    result[index] = saved;
  }
  return result.sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
}
const choose = <T,>(items: readonly T[], rng: Rng): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
function question(topic: string, type: OpicType, level: number, rng: Rng, used: Set<string>): string {
  const all = OPIC_QUESTIONS.filter(q => q.topic === topic && q.type === type);
  const fresh = all.filter(q => !used.has(q.id)), pool = fresh.length ? fresh : all;
  if (!pool.length) throw new Error('유형에 맞는 문항이 없어요.');
  const distance = Math.min(...pool.map(q => Math.abs(q.minLevel - level)));
  const id = choose(pool.filter(q => Math.abs(q.minLevel - level) === distance), rng).id; used.add(id); return id;
}
export function buildOpicMock(settings: OpicSettings, today: string, rng: Rng, id: string): OpicMock {
  const used = new Set<string>(), ids: string[] = [question('home', 'self-intro', settings.difficulty, rng, used)];
  const surveys = SURVEY_TOPICS.map(t => t[0]).filter(t => settings.survey.includes(t));
  if (!surveys.length) throw new Error('서베이 주제를 하나 이상 골라 주세요.');
  const first = choose(surveys, rng), second = choose(surveys.filter(t => t !== first).length ? surveys.filter(t => t !== first) : surveys, rng);
  const combo = (topic: string, types: OpicType[] = ['description', 'routine', 'past']) => types.forEach(type => ids.push(question(topic, type, settings.difficulty, rng, used)));
  combo(first); combo(second); combo(choose(UNEXPECTED_TOPICS, rng)[0]);
  const roles = [...new Set(OPIC_QUESTIONS.filter(q => q.type === 'roleplay-questions').map(q => q.topic))];
  const selected = roles.filter(topic => settings.survey.includes(topic)), role = choose(selected.length ? selected : roles, rng);
  for (const type of ['roleplay-questions', 'roleplay-solution', 'roleplay-experience'] as const) ids.push(question(role, type, settings.difficulty, rng, used));
  if (settings.difficulty >= 5) {
    for (const type of ['comparison', 'issue'] as const) {
      const all = OPIC_QUESTIONS.filter(q => q.type === type), own = all.filter(q => settings.survey.includes(q.topic));
      const next = choose(own.length ? own : all, rng); ids.push(next.id);
    }
  } else combo(choose(surveys, rng), ['routine', 'past']);
  return { id, date: today, difficulty: settings.difficulty, questionIds: ids, answers: [], elapsedSec: 0 };
}
/** 처음 7문항은 유지하고, 같은 주제·유형의 실제 은행 문항으로만 바꾼다. */
export function adjustOpicMock(mock: OpicMock, adjustment: NonNullable<OpicMock['adjustment']>): OpicMock {
  if (mock.answers.length !== 7 || mock.adjustment) return { ...mock };
  const target = Math.max(1, Math.min(6, mock.difficulty + (adjustment === 'easier' ? -1 : adjustment === 'harder' ? 1 : 0)));
  const questionIds = mock.questionIds.map((id, index) => {
    if (index < 7 || adjustment === 'same') return id;
    const original = QUESTION_MAP.get(id)!;
    const candidates = OPIC_QUESTIONS.filter(q => q.topic === original.topic && q.type === original.type);
    const changed = candidates.filter(q => adjustment === 'easier' ? q.minLevel < original.minLevel : q.minLevel > original.minLevel);
    return [...(changed.length ? changed : candidates)].sort((a, b) => Math.abs(a.minLevel - target) - Math.abs(b.minLevel - target) || a.id.localeCompare(b.id))[0]?.id ?? id;
  });
  return { ...mock, questionIds, adjustment, adjustedDifficulty: target as OpicSettings['difficulty'] };
}
export function resumeOpicMock(mock: OpicMock | undefined, today: string): OpicMock | undefined { return mock?.date === today ? mock : undefined; }
export function mockAllowance(remaining: { transcribes: number; transcribeSeconds: number; generates: number } | undefined, questions = 15): string | undefined {
  if (!remaining) return '서버의 남은 한도를 확인하지 못했어요. AI 연결과 Worker 업데이트를 확인해 주세요.';
  if (remaining.transcribes < questions) return `받아쓰기 ${questions}회가 필요해요. 오늘은 ${remaining.transcribes}회 남았어요.`;
  if (remaining.transcribeSeconds < questions * 150) return `최대 ${questions * 150 / 60}분의 받아쓰기 시간이 필요해요. 오늘은 ${Math.floor(remaining.transcribeSeconds / 60)}분 남았어요.`;
  if (remaining.generates < questions) return `피드백 ${questions}회가 필요해요. 오늘은 ${remaining.generates}회 남았어요.`;
}
export function opicMockResult(mock: OpicMock) {
  const measured = mock.answers.filter(a => a.feedback), bands = measured.map(a => OPIC_BANDS.indexOf(a.feedback!.levelBand)).sort((a, b) => a - b);
  const types = [...new Set(measured.map(a => a.type))].map(type => { const rows = measured.filter(a => a.type === type); return { type, total: rows.length, achieved: rows.filter(a => a.feedback!.taskDone).length }; });
  const weak = types.filter(row => row.achieved < row.total).sort((a, b) => a.achieved / a.total - b.achieved / b.total || b.total - a.total || a.type.localeCompare(b.type)).slice(0, 3);
  return { band: bands.length ? OPIC_BANDS[bands[Math.floor((bands.length - 1) / 2)]] : undefined, weak, nextFocus: weak.length ? weak.map(row => TYPE_NAMES[row.type]).join(' · ') : '유형별 답변 유지 · 실전 흐름 연습', measured: measured.length };
}
export function normalizeOpicMock(raw: unknown, today: string, normalizeAttempt: (raw: unknown) => OpicAttempt | undefined, ongoing = false): OpicMock | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || r.id.length > 100 || !validRetrievalDate(r.date) || r.date > today || (ongoing && r.date !== today) || !Number.isInteger(r.difficulty) || Number(r.difficulty) < 1 || Number(r.difficulty) > 6 || !Array.isArray(r.questionIds) || r.questionIds.length !== 15 || !r.questionIds.every(id => typeof id === 'string' && QUESTION_MAP.has(id)) || !Array.isArray(r.answers) || r.answers.length > 15 || typeof r.elapsedSec !== 'number' || !Number.isFinite(r.elapsedSec) || r.elapsedSec < 0 || r.elapsedSec > 86400) return undefined;
  const ids = r.questionIds as string[];
  const answers = r.answers.map(normalizeAttempt);
  if (answers.some((a, i) => !a || a.questionId !== ids[i] || a.date !== r.date || !a.transcript.trim()) || new Set(answers.map(a => a?.id)).size !== answers.length) return undefined;
  const expected: OpicType[] = ['self-intro', 'description', 'routine', 'past', 'description', 'routine', 'past', 'description', 'routine', 'past', 'roleplay-questions', 'roleplay-solution', 'roleplay-experience', ...(Number(r.difficulty) >= 5 ? ['comparison', 'issue'] as const : ['routine', 'past'] as const)];
  if (ids.some((id, i) => QUESTION_MAP.get(id)!.type !== expected[i])) return undefined;
  return { ...(r.feedbackAttempted === true ? { feedbackAttempted: true } : {}), ...(typeof r.adjustedDifficulty === 'number' && Number.isInteger(r.adjustedDifficulty) && r.adjustedDifficulty >= 1 && r.adjustedDifficulty <= 6 ? { adjustedDifficulty: r.adjustedDifficulty as OpicSettings['difficulty'] } : {}), id: r.id, date: r.date, difficulty: r.difficulty as OpicSettings['difficulty'], questionIds: [...r.questionIds] as string[], answers: answers as OpicAttempt[], elapsedSec: r.elapsedSec, ...(['easier', 'same', 'harder'].includes(String(r.adjustment)) && answers.length >= 7 ? { adjustment: r.adjustment as OpicMock['adjustment'] } : {}) };
}
