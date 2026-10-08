import { parseDateKey, toDateKey } from '../../lib/date';
import { STORIES } from './index';
import type { Story, StoryEpisode, StoryProgress } from './types';

export const QUESTION_TYPE_LABEL = { fact: '내용 확인', infer: '추론', vocab: '낱말 뜻' } as const;
export const answerKey = (episode: number, index: number): string => `${episode}:${index}`;
export const initialStoryProgress = (): StoryProgress => ({ unlocked: 1, finished: 0, answers: {} });
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateKey(parseDateKey(value)) === value;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const bound = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;

export function normalizeStorySettings(raw: unknown): { enabled: boolean } {
  return { enabled: !object(raw) || typeof raw.enabled !== 'boolean' ? true : raw.enabled };
}
export function normalizeStories(raw: unknown): Record<string, StoryProgress> {
  if (!object(raw)) return {};
  return Object.fromEntries(STORIES.flatMap(story => {
    const entry = raw[story.id];
    if (!object(entry)) return [];
    const unlocked = bound(entry.unlocked, 1, story.episodes.length, 1);
    const answers: StoryProgress['answers'] = {};
    if (object(entry.answers)) for (const episode of story.episodes.slice(0, unlocked)) {
      episode.questions.forEach((_q, i) => {
        const key = answerKey(episode.n, i), history = entry.answers[key];
        if (Array.isArray(history)) answers[key] = history.filter((v): v is boolean => typeof v === 'boolean');
      });
    }
    return [[story.id, { unlocked, finished: bound(entry.finished, 0, unlocked, 0), answers,
      ...(validDate(entry.lastUnlockDate) ? { lastUnlockDate: entry.lastUnlockDate } : {}) }]];
  }));
}

/** 처음 시작할 때 날짜를 확보하고, 다시 읽을 때는 대기일을 늘리지 않는다. */
export function startStory(progress: StoryProgress, today: string): StoryProgress {
  return !progress.lastUnlockDate && validDate(today) ? { ...progress, lastUnlockDate: today } : progress;
}
export function canOpenNext(progress: StoryProgress, today: string, total = 10): boolean {
  return validDate(today) && validDate(progress.lastUnlockDate) && progress.lastUnlockDate < today &&
    progress.finished >= progress.unlocked && progress.unlocked < total;
}
/** 며칠 쉬었어도 한 화만 연다. force는 PIN을 통과한 보호자만 사용한다. */
export function openNext(progress: StoryProgress, today: string, total = 10, force = false): StoryProgress {
  if (!validDate(today) || progress.unlocked >= total || (!force && !canOpenNext(progress, today, total))) return progress;
  return { ...progress, unlocked: progress.unlocked + 1, lastUnlockDate: today };
}
export function episodeSolved(progress: StoryProgress, episode: StoryEpisode): boolean {
  return episode.questions.every((_q, index) => progress.answers[answerKey(episode.n, index)]?.includes(true));
}
/** 답만 기록하는 순수 함수. 미션과 보상에는 손대지 않는다. */
export function recordAnswer(progress: StoryProgress, story: Story, episode: number, qIndex: number, correct: boolean, today: string): StoryProgress {
  const row = story.episodes.find(e => e.n === episode);
  if (!row || episode > progress.unlocked || !Number.isInteger(qIndex) || !row.questions[qIndex] || !validDate(today)) return progress;
  const key = answerKey(episode, qIndex);
  const next = { ...startStory(progress, today), answers: { ...progress.answers, [key]: [...(progress.answers[key] ?? []), correct] } };
  while (next.finished < next.unlocked && episodeSolved(next, story.episodes[next.finished])) next.finished++;
  // 처음 완주한 날을 기준으로 기다린다. 예전 화를 다시 풀어도 잠금 날짜는 바뀌지 않는다.
  if (next.finished > progress.finished && next.finished === next.unlocked) next.lastUnlockDate =
    next.lastUnlockDate && next.lastUnlockDate > today ? next.lastUnlockDate : today;
  return next;
}
export type StoryCardState = 'new' | 'reading' | 'locked-until-tomorrow' | 'finished';
export function storyCardState(progress: StoryProgress | undefined, today: string, total = 10): StoryCardState {
  if (!progress) return 'new';
  if (progress.finished >= total) return 'finished';
  if (canOpenNext(progress, today, total)) return 'new';
  if (progress.finished >= progress.unlocked) return 'locked-until-tomorrow';
  return Object.keys(progress.answers).some(key => key.startsWith(`${progress.unlocked}:`)) ? 'reading' : 'new';
}
export function answerRate(history: readonly boolean[]): { correct: number; total: number; percent: number } {
  const correct = history.filter(Boolean).length;
  return { correct, total: history.length, percent: history.length ? Math.round(correct / history.length * 100) : 0 };
}
