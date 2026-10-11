import { OPIC_BANDS, OPIC_TARGETS, filterOpicFeedback, type OpicFeedback, type OpicType } from '../../shared/opic';
import { CORRECTION_PATTERNS } from '../../shared/corrections';
import { QUESTION_MAP, SURVEY_TOPICS, type OpicQuestion } from '../content/opic/questions';
import { seededRng, type Rng } from './random';
import { addDays } from './date';
import { validRetrievalDate } from './retrieval';
import { englishWordCount } from './talkGrowth';
import { englishRatio } from './talk';
export interface OpicSettings { targetLevel: typeof OPIC_TARGETS[number]; examDate?: string; difficulty: 1 | 2 | 3 | 4 | 5 | 6; survey: string[] }
export interface OpicAttempt { id: string; date: string; questionId: string; type: OpicType; topic: string; transcript: string; durationSec: number; words: number; wpm: number; koreanRatio: number; feedback?: OpicFeedback; retell?: { transcript: string; durationSec: number; words: number; wpm: number } }
export interface OpicScript { id: string; questionId: string; type: OpicType; topic: string; text: string; createdAt: string; updatedAt: string }
export interface OpicData { settings: OpicSettings; attempts: OpicAttempt[]; scripts: OpicScript[]; skipsByDate?: Record<string, number> }
export const defaultOpicSettings = (): OpicSettings => ({ targetLevel: 'IM2', difficulty: 4, survey: SURVEY_TOPICS.map(row => row[0]) });
export const emptyOpic = (settings = defaultOpicSettings()): OpicData => ({ settings, attempts: [], scripts: [], skipsByDate: {} });
export function opicMetrics(text: string, durationSec: number) {
  const words = englishWordCount(text), ratio = englishRatio([{ role: 'kid', text, at: 0 }]);
  return { words, wpm: words * 60 / Math.max(1, durationSec), koreanRatio: /[A-Za-z가-힣]/.test(text) ? 1 - ratio : 0 };
}
const hash = (text: string) => [...text].reduce((n, char) => Math.imul(n ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
export function pickOpicQuestion(bank: readonly OpicQuestion[], settings: OpicSettings, attempts: readonly OpicAttempt[], today: string, options: { change?: boolean; rng?: Rng } = {}): OpicQuestion {
  const todays = attempts.filter(attempt => attempt.date === today), last = todays.at(-1);
  if (!options.change && last) { const same = bank.find(q => q.id === last.questionId); if (same) return same; }
  const rng = options.rng ?? seededRng(hash(`${today}:${todays.length}`)), roll = rng();
  const category = (q: OpicQuestion) => q.type.startsWith('roleplay') || ['comparison', 'issue'].includes(q.type) ? 'special' : SURVEY_TOPICS.some(row => row[0] === q.topic) ? 'survey' : 'unexpected';
  const eligible = bank.filter(q => q.minLevel <= settings.difficulty && (settings.difficulty >= 5 || !['comparison', 'issue'].includes(q.type)) && (category(q) !== 'survey' || settings.survey.includes(q.topic)));
  if (!eligible.length) throw new Error('연습 가능한 문항이 없어요.');
  const wanted = roll < .7 ? 'survey' : roll < .9 ? 'unexpected' : 'special';
  const recent = new Set(attempts.filter(a => a.date >= addDays(today, -13) && a.date <= today).map(a => a.questionId));
  const categoryPool = eligible.filter(q => category(q) === wanted && (wanted !== 'survey' || settings.survey.includes(q.topic)));
  const candidates = categoryPool.length ? categoryPool : eligible;
  const pool = candidates.filter(q => !recent.has(q.id));
  if (!pool.length) {
    const lastDate = (q: OpicQuestion) => attempts.filter(a => a.questionId === q.id).map(a => a.date).sort().at(-1) ?? '';
    return [...candidates].sort((a, b) => lastDate(a).localeCompare(lastDate(b)) || a.id.localeCompare(b.id))[0];
  }
  const ordinary = ['description', 'routine', 'past'];
  const previous = attempts.filter(a => a.date < today && a.transcript.trim()).at(-1);
  const topics = [...new Set(pool.map(q => q.topic))];
  const topic = previous && topics.includes(previous.topic) && ordinary.includes(previous.type) && previous.type !== 'past' ? previous.topic : topics[Math.min(topics.length - 1, Math.floor(rng() * topics.length))];
  const topicPool = pool.filter(q => q.topic === topic);
  const counts = ordinary.map(type => attempts.filter(a => a.topic === topic && a.type === type && a.transcript.trim()).length);
  const stage = ordinary.find((type, i) => counts[i] === Math.min(...counts) && topicPool.some(q => q.type === type));
  const stages = topicPool.filter(q => q.type === stage);
  const final = stages.length ? stages : topicPool;
  return final[Math.min(final.length - 1, Math.floor(rng() * final.length))];
}
export function reserveOpicQuestion(data: OpicData, question: OpicQuestion, today: string, change = false): OpicAttempt | undefined {
  if (change && (data.skipsByDate?.[today] ?? 0) >= 2) return undefined;
  if (change) data.skipsByDate = { ...data.skipsByDate, [today]: (data.skipsByDate?.[today] ?? 0) + 1 };
  const existing = data.attempts.at(-1);
  if (existing?.date === today && existing.questionId === question.id) return existing;
  const attempt: OpicAttempt = { id: `${today}:${question.id}:${data.attempts.filter(a => a.date === today).length}`, date: today, questionId: question.id, type: question.type, topic: question.topic, transcript: '', durationSec: 1, ...opicMetrics('', 1) };
  data.attempts = [...data.attempts, attempt].slice(-200);
  return attempt;
}
const object = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown, max: number, min = 1): value is string => typeof value === 'string' && value.length >= min && value.length <= max;
const strings = (value: unknown, max: number, minCount: number, maxCount: number): value is string[] => Array.isArray(value) && value.length >= minCount && value.length <= maxCount && value.every(s => text(s, max));
export function isOpicFeedback(value: unknown): value is OpicFeedback {
  const r = object(value); if (!r) return false;
  return typeof r.taskDone === 'boolean' && text(r.taskNoteKo, 160) && ['words', 'sentences', 'strings', 'paragraph'].includes(String(r.textType)) && OPIC_BANDS.includes(r.levelBand as OpicFeedback['levelBand']) && strings(r.strengthsKo, 120, 1, 2) && text(r.nextStepKo, 160) && text(r.modelAnswer, 1400) && strings(r.keyPhrases, 60, 2, 5) && Array.isArray(r.corrections) && r.corrections.length <= 3 && r.corrections.every(value => { const c = object(value); return c && text(c.said, 200) && text(c.better, 160) && text(c.focus, 40) && text(c.whyKo, 120) && CORRECTION_PATTERNS.includes(c.pattern as typeof CORRECTION_PATTERNS[number]); }) && Array.isArray(r.upgrades) && r.upgrades.length <= 4 && r.upgrades.every(value => { const u = object(value); return u && text(u.from, 120) && text(u.to, 160); });
}
export function normalizeOpic(raw: unknown, today: string): OpicData | undefined {
  const row = object(raw); if (!row) return undefined;
  const r = object(row.settings) ?? {}, defaults = defaultOpicSettings();
  const settings: OpicSettings = { targetLevel: OPIC_TARGETS.includes(r.targetLevel as OpicSettings['targetLevel']) ? r.targetLevel as OpicSettings['targetLevel'] : defaults.targetLevel, difficulty: typeof r.difficulty === 'number' && Number.isInteger(r.difficulty) && r.difficulty >= 1 && r.difficulty <= 6 ? r.difficulty as OpicSettings['difficulty'] : defaults.difficulty, survey: Array.isArray(r.survey) ? [...new Set(r.survey.filter((s): s is string => typeof s === 'string' && SURVEY_TOPICS.some(topic => topic[0] === s)))] : defaults.survey, ...(validRetrievalDate(r.examDate) ? { examDate: r.examDate } : {}) };
  const attempts: OpicAttempt[] = [];
  if (Array.isArray(row.attempts)) for (const value of row.attempts) {
    const a = object(value), q = a && QUESTION_MAP.get(String(a.questionId));
    if (!a || !q || !text(a.id, 150) || !validRetrievalDate(a.date) || a.type !== q.type || a.topic !== q.topic || !text(a.transcript, 6000, 0) || typeof a.durationSec !== 'number' || !Number.isFinite(a.durationSec) || a.durationSec < 1 || a.durationSec > 150) continue;
    const attempt: OpicAttempt = { id: a.id, date: a.date, questionId: q.id, type: q.type, topic: q.topic, transcript: a.transcript, durationSec: a.durationSec, ...opicMetrics(a.transcript, a.durationSec) };
    if (isOpicFeedback(a.feedback)) {
      const f = a.feedback;
      attempt.feedback = filterOpicFeedback({ taskDone: f.taskDone, taskNoteKo: f.taskNoteKo, textType: f.textType, levelBand: f.levelBand, strengthsKo: [...f.strengthsKo], nextStepKo: f.nextStepKo, modelAnswer: f.modelAnswer, keyPhrases: [...f.keyPhrases], corrections: f.corrections.map(c => ({ said: c.said, better: c.better, focus: c.focus, whyKo: c.whyKo, pattern: c.pattern })), upgrades: f.upgrades.map(u => ({ from: u.from, to: u.to })) }, attempt.transcript);
    }
    const retell = object(a.retell);
    if (retell && text(retell.transcript, 6000, 0) && typeof retell.durationSec === 'number' && Number.isFinite(retell.durationSec) && retell.durationSec >= 1 && retell.durationSec <= 150) attempt.retell = { transcript: retell.transcript, durationSec: retell.durationSec, words: englishWordCount(retell.transcript), wpm: englishWordCount(retell.transcript) * 60 / retell.durationSec };
    attempts.push(attempt);
  }
  const scripts: OpicScript[] = [];
  if (Array.isArray(row.scripts)) for (const value of row.scripts) {
    const s = object(value), q = s && QUESTION_MAP.get(String(s.questionId));
    if (s && q && text(s.id, 150) && s.type === q.type && s.topic === q.topic && text(s.text, 1600) && validRetrievalDate(s.createdAt) && validRetrievalDate(s.updatedAt)) scripts.push({ id: s.id, questionId: q.id, type: q.type, topic: q.topic, text: s.text, createdAt: s.createdAt, updatedAt: s.updatedAt });
  }
  const skips = object(row.skipsByDate) ?? {};
  return { settings, attempts: attempts.sort((a, b) => a.date.localeCompare(b.date)).slice(-200), scripts: scripts.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).slice(-150), skipsByDate: Object.fromEntries(Object.entries(skips).filter(([date, count]) => validRetrievalDate(date) && date >= addDays(today, -6) && date <= today && typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 2)) as Record<string, number> };
}
export function modelAnswerParts(feedback: OpicFeedback): { text: string; changed: boolean }[] {
  const targets = feedback.upgrades.map(item => item.to).filter(Boolean).sort((a, b) => b.length - a.length);
  const parts: { text: string; changed: boolean }[] = []; let index = 0, plain = '';
  while (index < feedback.modelAnswer.length) {
    const target = targets.find(text => feedback.modelAnswer.startsWith(text, index));
    if (target) { if (plain) parts.push({ text: plain, changed: false }); plain = ''; parts.push({ text: target, changed: true }); index += target.length; }
    else plain += feedback.modelAnswer[index++];
  }
  if (plain) parts.push({ text: plain, changed: false }); return parts;
}
