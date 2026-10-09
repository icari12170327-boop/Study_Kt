import { parentPersona } from './voices';
import { AiError } from './ai';
import type { CoachCheck, CoachSettings, CoachWrapup, ProfileData } from '../types';
import type { CoachTopic, SessionRequest } from '../../shared/ai';

export const COACH_TOPICS = [
  { id: 'daily', title: '☕ 일상 수다' },
  { id: 'work', title: '💼 업무·AI 이야기' },
  { id: 'money', title: '📈 투자 이야기' },
] as const;
export function coachTitle(topic?: CoachTopic): string { return `🌱 코치 · ${COACH_TOPICS.find(row => row.id === topic)?.title ?? '영어 대화'}`; }

/** 문장 경계를 우선하고, 한 문장이 상한보다 길 때만 공백 또는 글자 경계에서 나눈다. 초과하면 빈 배열을 반환한다. */
export function splitForGloss(text: string, max = 300): string[] {
  if (!Number.isInteger(max) || max < 1) throw new RangeError('묶음 길이가 올바르지 않아요.');
  const chunks: string[] = [];
  let current = '';
  for (const sentence of text.trim().split(/(?<=[.!?])\s+|(?<=[.!?]["”’'])\s+/u)) {
    let rest = sentence.trim();
    if (!rest) continue;
    if (current && current.length + 1 + rest.length > max) { chunks.push(current); current = ''; }
    while (rest.length > max) {
      let end = rest.lastIndexOf(' ', max);
      if (end <= 0) end = max;
      // 이모지 등 서로게이트 쌍을 중간에서 잘라 요청하지 않는다.
      if (/[\uD800-\uDBFF]/.test(rest[end - 1]) && /[\uDC00-\uDFFF]/.test(rest[end] ?? '')) end--;
      if (!end) return [];
      chunks.push(rest.slice(0, end)); rest = rest.slice(end).trim();
      if (chunks.length > 3) return [];
    }
    current = current ? `${current} ${rest}` : rest;
    if (chunks.length >= 3 && current) return [];
  }
  if (current) chunks.push(current);
  return chunks.length <= 3 ? chunks : [];
}
export function coachErrorMessage(error: unknown, action: 'gloss' | 'wrapup' | 'check' | 'connection' = 'gloss'): string {
  if (error instanceof AiError) {
    if (error.kind === 'unauthorized') return 'AI 연결 권한이 없어요. Worker 설정을 확인하고 다시 시도해 주세요.';
    if (!['server', 'network'].includes(error.kind)) return error.message;
  }
  const message = { gloss: '뜻을 받지 못했어요.', wrapup: '마무리를 받지 못했어요.', check: '문장을 확인하지 못했어요.', connection: '대화를 연결하지 못했어요.' };
  return `${message[action]} 한 번 더 눌러 주세요.`;
}

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
