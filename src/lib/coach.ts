import { parentPersona } from './voices';
import type { CoachCheck, CoachSettings, CoachWrapup, ProfileData } from '../types';
import type { CoachTopic, SessionRequest } from '../../shared/ai';

export const COACH_TOPICS = [
  { id: 'daily', title: '☕ 일상 수다' },
  { id: 'work', title: '💼 업무·AI 이야기' },
  { id: 'money', title: '📈 투자 이야기' },
] as const;
export function coachTitle(topic?: CoachTopic): string { return `🌱 코치 · ${COACH_TOPICS.find(row => row.id === topic)?.title ?? '영어 대화'}`; }

/** 첫 번째 따옴표 안의 짧은 영어 한 문장만 따라 말하기로 사용한다. */
export function extractRepeatSentence(text: string): string | null {
  const match = text.match(/"([^"]*)"|“([^”]*)”/);
  const sentence = (match?.[1] ?? match?.[2] ?? '').trim();
  if (sentence.length < 2 || sentence.length > 120 || !/[A-Za-z]/.test(sentence) ||
    /[^\p{Script=Latin}\p{N}\p{P}\p{Zs}]/u.test(sentence) || /[.!?]\s+\S/.test(sentence)) return null;
  return sentence;
}
/** 완성된 텍스트가 아니라 실제 AI 음성 종료 여부로 표시를 결정한다. */
export function subtitleVisible(mode: CoachSettings['subtitle'], lineState: { audioDone: boolean; peeked?: boolean }): boolean {
  return mode === 'now' || (mode === 'after' && lineState.audioDone) || (mode === 'hidden' && lineState.peeked === true);
}
export function normalizeCoachSettings(raw: unknown): CoachSettings {
  const value = raw && typeof raw === 'object' ? raw as Partial<CoachSettings> : {};
  return {
    level: ['zero', 'words', 'short', 'daily'].includes(value.level ?? '') ? value.level! : 'zero',
    repeat: ['low', 'mid', 'high'].includes(value.repeat ?? '') ? value.repeat! : 'mid',
    speed: [0.85, 0.9, 1].includes(value.speed ?? 0) ? value.speed! : 0.85,
    subtitle: ['now', 'after', 'hidden'].includes(value.subtitle ?? '') ? value.subtitle! : 'after',
  };
}
export function normalizeCoachInterests(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter(value => typeof value === 'string').map(value => value.trim().slice(0, 80)).filter(Boolean))].slice(0, 5) : [];
}
export function coachRequest(topic: CoachTopic, settings: CoachSettings, memory: string, interests: string[], voiceSettings?: Parameters<typeof parentPersona>[0]): Omit<SessionRequest, 'offerSdp'> {
  return { profileId: 'parent', level: 'adult', mode: 'parent-coach', coachTopic: topic,
    coach: { level: settings.level, repeat: settings.repeat }, speed: settings.speed,
    persona: parentPersona(voiceSettings), memory: memory.slice(0, 1500), interests: normalizeCoachInterests(interests) };
}
const object = (raw: unknown): Record<string, unknown> => raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
const text = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
export function isCoachWrapup(raw: unknown): raw is CoachWrapup {
  const row = object(raw);
  return Array.isArray(row.sentences) && row.sentences.length <= 3 && row.sentences.every(raw => {
    const sentence = object(raw); return text(sentence.en, 120) && text(sentence.ko, 120);
  });
}
export function isCoachCheck(raw: unknown): raw is CoachCheck {
  const row = object(raw); return text(row.corrected, 200) && text(row.noteKo, 200);
}
/** 대화 중 저장한 빈 뜻만 채우고 기존 번역·ID·SRS는 보존한다. */
export function fillCoachMeanings(data: ProfileData, sentences: CoachWrapup['sentences']): void {
  for (const sentence of sentences) {
    const card = data.customCards?.find(card => card.en.trim().toLowerCase() === sentence.en.trim().toLowerCase());
    if (card && !card.ko.trim()) card.ko = sentence.ko.trim();
  }
}
