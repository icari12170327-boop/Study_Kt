import type { AppState, Level, ProfileData, ProfileId, ProfileSettings, TalkLine, TalkLog, TalkSettings, TalkSummary } from '../types';
import { normalizeAiConfig, type AiConfig, type SessionRequest } from './ai';
import { seededRng } from './random';
import { applyProgress, ensureDay } from './progress';
export const TALK_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'] as const;
type LegacyState = Omit<AppState, 'version' | 'data'> & {
  version: 1;
  data: Record<ProfileId, Omit<ProfileData, 'talks' | 'friendMemory'> & Partial<Pick<ProfileData, 'talks' | 'friendMemory'>>>;
};
export function aiReady(cfg: AiConfig): boolean {
  try { normalizeAiConfig(cfg); return true; } catch { return false; }
}
export function defaultTalkSettings(level: Level, id?: ProfileId): TalkSettings {
  const first = id ? id === 'kid1' : level === 'g5';
  return {
    friendName: level === 'adult' ? 'Alex' : first ? 'Max' : 'Lily',
    personaId: first ? 'funny' : 'cheerful',
    voice: first ? 'marin' : 'coral',
    dailyMinutes: level === 'adult' ? 30 : level === 'g5' ? 20 : 15,
    interests: first ? ['Roblox', 'building games', 'science experiments'] : ['Animal Crossing', 'animals', 'fishing and bug catching', 'decorating my island'],
    friendHobbies: first ? 'loves Roblox obbies and building tycoon games, always trying to beat a hard level' : 'loves Animal Crossing, decorating an island, catching bugs and fish, and taking care of animals',
    subtitleHidePercent: 0,
    pushToTalk: false,
  };
}
const bounded = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(min, Math.min(max, value))) : fallback;
export function normalizeTalkSettings(raw: unknown, level: Level, id?: ProfileId): TalkSettings {
  const base = defaultTalkSettings(level, id);
  const s = raw && typeof raw === 'object' ? raw as Partial<TalkSettings> : {};
  return {
    friendName: ['Max', 'Lily', 'Alex'].includes(s.friendName ?? '') ? s.friendName! : base.friendName,
    personaId: ['cheerful', 'calm', 'funny'].includes(s.personaId ?? '') ? s.personaId! : base.personaId,
    voice: TALK_VOICES.some((v) => v === s.voice) ? s.voice! : base.voice,
    dailyMinutes: bounded(s.dailyMinutes, base.dailyMinutes, 1, 100),
    interests: Array.isArray(s.interests) ? s.interests.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim().slice(0, 80)).slice(0, 8) : base.interests,
    friendHobbies: typeof s.friendHobbies === 'string' ? s.friendHobbies.slice(0, 400) : base.friendHobbies,
    subtitleHidePercent: bounded(s.subtitleHidePercent, 0, 0, 100),
    pushToTalk: typeof s.pushToTalk === 'boolean' ? s.pushToTalk : false,
  };
}
/** 텍스트와 item ID가 같으면 렌더링 횟수와 무관하게 같은 단어를 가린다. */
export function maskSubtitle(text: string, percent: number, seed: string | number, complete = true): string {
  // 스트리밍 중에는 그대로 보여 주고 완성 후 한 번만 가려 후보 변경의 깜빡임을 막는다.
  if (!complete) return text;
  const words = [...text.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)];
  let hash = 2166136261;
  for (const ch of String(seed)) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  const rng = seededRng(hash);
  const ranked = words.map((word, index) => ({ index, long: word[0].length >= 3, rank: rng() }))
    .sort((a, b) => Number(b.long) - Number(a.long) || a.rank - b.rank);
  const count = Math.round(words.length * (Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0) / 100);
  const hidden = new Set(ranked.slice(0, count).map((word) => word.index));
  let index = 0;
  return text.replace(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu, (word) => hidden.has(index++) ? '▢▢▢' : word);
}
export function englishRatio(lines: TalkLine[]): number {
  const text = lines.filter((line) => line.role === 'kid').map((line) => line.text).join(' ');
  const english = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
  const korean = text.match(/[가-힣]+/g)?.length ?? 0;
  return english + korean ? english / (english + korean) : 0;
}
export function talkSignals(input: { remaining: number; now: number; friendFinishedAt?: number; stuckSent: boolean; wrapSent: boolean; paused: boolean }): { wrapUp: boolean; stuck: boolean } {
  return {
    wrapUp: input.remaining > 0 && input.remaining <= 60 && !input.wrapSent,
    stuck: !input.paused && !input.wrapSent && !input.stuckSent && input.friendFinishedAt !== undefined && input.now - input.friendFinishedAt >= 10000 && input.remaining > 0,
  };
}
/** 미션에 아직 반영되지 않은 초도 보존한다. 같은 실행에서 새로 지난 초만 전달한다. */
export function recordTalkSeconds(data: ProfileData, settings: ProfileSettings, date: string, amount: number, ready: boolean): void {
  const day = ensureDay(data, date);
  const before = day.talkSeconds ?? (day.progress.talk ?? 0) * 60;
  day.talkSeconds = before + Math.max(0, Math.floor(amount));
  const minutes = Math.floor(day.talkSeconds / 60) - Math.floor(before / 60);
  if (minutes > 0) applyProgress(data, settings, date, { type: 'talk', amount: minutes }, { aiReady: ready });
}
export function talkTopics(settings: TalkSettings, logs: TalkLog[]): string[] {
  const latest = [...logs].reverse().find((log) => log.summary);
  return [...new Set([...(latest?.summary?.nextTopics ?? []), ...settings.interests])].slice(0, 12);
}
export function talkRequest(profileId: ProfileId, level: Level, settings: TalkSettings, memory: string, topic: string): Omit<SessionRequest, 'offerSdp'> {
  return { profileId, level, mode: 'kid-friend', persona: { friendName: settings.friendName, personaId: settings.personaId, voice: settings.voice, friendHobbies: settings.friendHobbies }, memory: memory.slice(0, 1500), interests: settings.interests, topic: topic.slice(0, 40), pushToTalk: settings.pushToTalk };
}
/** 긴 대화의 전체 기록은 로컬에 두고 요약 요청만 본문 상한 아래로 줄인다. */
export function summaryLines(lines: TalkLine[]): TalkLine[] {
  let bytes = 0;
  const encoder = new TextEncoder();
  const selected: TalkLine[] = [];
  for (const line of [...lines].reverse()) {
    if (!line.text.trim()) continue;
    let text = line.text.slice(0, 2000);
    let size = encoder.encode(JSON.stringify({ ...line, text })).length;
    while (text && size > 90000 - bytes) {
      text = text.slice(0, Math.floor(text.length / 2));
      size = encoder.encode(JSON.stringify({ ...line, text })).length;
    }
    if (!text) break;
    selected.push({ ...line, text });
    bytes += size;
    if (selected.length === 300) break;
  }
  return selected.reverse();
}
export function isTalkSummary(value: unknown): value is TalkSummary & { flagged?: boolean } {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<TalkSummary> & { flagged?: unknown };
  const strings = (v: unknown, max: number, length: number): v is string[] => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string' && x.length <= length);
  return typeof s.highlightKo === 'string' && s.highlightKo.length <= 300 && strings(s.topicsKo, 8, 100) && strings(s.nextTopics, 3, 40) &&
    Array.isArray(s.newExpressions) && s.newExpressions.length <= 5 && s.newExpressions.every((e) => e && typeof e.en === 'string' && e.en.length <= 200 && typeof e.ko === 'string' && e.ko.length <= 200) && (s.flagged === undefined || typeof s.flagged === 'boolean');
}
export function normalizeTalkLogs(raw: unknown): TalkLog[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s: TalkLog) => s && typeof s.id === 'string' && typeof s.date === 'string' && Number.isFinite(s.seconds) && s.seconds >= 0 && Array.isArray(s.lines)).slice(-60).map((log: TalkLog) => {
    const lines = log.lines.filter((l) => l && ['kid', 'friend'].includes(l.role) && typeof l.text === 'string' && Number.isFinite(l.at) && l.at >= 0).map((l) => ({ role: l.role, text: l.text, at: l.at, ...(l.peeked ? { peeked: true } : {}) }));
    return {
    id: log.id, date: log.date, seconds: Math.floor(log.seconds),
    lines,
    englishRatio: Math.max(0, Math.min(1, Number.isFinite(log.englishRatio) ? log.englishRatio : englishRatio(lines))),
    ...(isTalkSummary(log.summary) ? { summary: structuredClone(log.summary) } : {}),
    ...(typeof log.flagged === 'boolean' ? { flagged: log.flagged } : {}),
  }; });
}
/** 정규화된 v1을 깊은 복사해 미션만 전환한다. 기존 학습 기록은 수정하지 않는다. */
export function migrateV1toV2(state: LegacyState): AppState {
  const next: AppState = {
    ...structuredClone(state), version: 2,
    data: Object.fromEntries(Object.entries(state.data).map(([id, data]) => [id, {
      ...structuredClone(data), talks: normalizeTalkLogs(data.talks), friendMemory: typeof data.friendMemory === 'string' ? data.friendMemory.slice(0, 1500) : '',
    }])) as Record<ProfileId, ProfileData>,
  };
  for (const profile of next.profiles) {
    const settings = next.settings[profile.id];
    const child = profile.level !== 'adult';
    settings.talk = normalizeTalkSettings(settings.talk, profile.level, profile.id);
    settings.missions = settings.missions.filter((m) => m.type !== 'talk').map((m) => child && ['vocab', 'speaking'].includes(m.type) ? { ...m, enabled: false } : m);
    settings.missions.push({ type: 'talk', enabled: child, target: settings.talk.dailyMinutes });
  }
  return next;
}
