import type { BizFeedback, CustomCard, ProfileData, ProfileSettings, TalkLog, TalkSummary } from '../types';
import type { SessionRequest } from './ai';
import type { ParentSpeed } from '../../shared/ai';
import type { Rng } from './random';
export const MY_PHRASES = 'my-phrases';
export const BUSINESS_SCENARIOS = [
  { id: 'biz-standup', title: '주간 업무 공유 회의', role: '해외 팀 매니저' },
  { id: 'biz-negotiation', title: '납품 단가 협상', role: '공급업체 영업 담당' },
  { id: 'biz-presentation-qa', title: '발표 후 질의응답', role: '까다로운 임원' },
  { id: 'biz-ai-adoption', title: '사내 AI 도입 논의', role: '회의적인 동료' },
  { id: 'biz-smalltalk', title: '해외 출장 첫 미팅 전 스몰토크', role: '거래처 담당자' },
  { id: 'biz-escalation', title: '문제 상황 보고', role: '고객사 담당자' },
  { id: 'biz-free', title: 'AI, 테크 이야기 자유 대화', role: '업계 동료' },
  { id: 'biz-custom', title: '✍️ 내 상황 직접 입력', role: '입력한 상황의 상대방' },
] as const;
export function scenarioTitle(id?: string): string { return BUSINESS_SCENARIOS.find(row => row.id === id)?.title ?? '비즈니스 대화'; }
const object = (raw: unknown): Record<string, unknown> => raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
const text = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
const englishKey = (value: string) => value.trim().toLowerCase();
export function isBizFeedback(raw: unknown): raw is BizFeedback {
  const row = object(raw);
  return text(row.overallKo, 300) && Array.isArray(row.corrections) && row.corrections.length <= 5 && row.corrections.every(raw => {
    const correction = object(raw); return text(correction.said, 300) && text(correction.better, 300) && text(correction.why, 300);
  }) && Array.isArray(row.nextExpressions) && row.nextExpressions.length === 3 && row.nextExpressions.every(raw => {
    const expression = object(raw); return text(expression.en, 200) && text(expression.ko, 200);
  });
}
export function isShortFeedback(raw: unknown): raw is { alternatives: string[] } {
  const row = object(raw);
  return Array.isArray(row.alternatives) && row.alternatives.length === 2 && row.alternatives.every(value => text(value, 300));
}
export function normalizeCustomCards(raw: unknown): CustomCard[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>(), expressions = new Set<string>(), result: CustomCard[] = [];
  for (const item of raw) {
    const row = object(item);
    if (!text(row.id, 100) || !/^mp-\d+-[a-z0-9]{4}$/.test(row.id) || !text(row.en, 300) || typeof row.ko !== 'string' || row.ko.length > 300 || !text(row.source, 300) ||
      typeof row.createdAt !== 'string' || row.createdAt.length > 40 || !Number.isFinite(Date.parse(row.createdAt)) || ids.has(row.id) || expressions.has(englishKey(row.en))) continue;
    ids.add(row.id); expressions.add(englishKey(row.en));
    result.push({ id: row.id, en: row.en.trim(), ko: row.ko.trim(), source: row.source.trim(), createdAt: row.createdAt });
  }
  return result;
}
export function normalizeBizSituations(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter(value => text(value, 300)).map(value => value.trim()))].slice(0, 5) : [];
}
export function rememberSituation(data: ProfileData, situation: string): void {
  if (text(situation, 300)) data.bizSituations = normalizeBizSituations([situation.trim(), ...(data.bizSituations ?? [])]);
}
export function savePhrase(data: ProfileData, en: string, ko: string, source: string, now: number, rng: Rng): 'saved' | 'updated' | 'duplicate' | 'invalid' {
  if (!text(en, 300) || typeof ko !== 'string' || ko.length > 300 || !text(source, 300) || !Number.isSafeInteger(now) || now < 0 || !Number.isFinite(new Date(now).getTime())) return 'invalid';
  const cards = data.customCards ?? [];
  const existing = cards.find(card => englishKey(card.en) === englishKey(en));
  if (existing) {
    if (!existing.ko.trim() && ko.trim()) { existing.ko = ko.trim(); return 'updated'; }
    return 'duplicate';
  }
  const suffix = Math.floor(rng() * 36 ** 4), ids = new Set(cards.map(card => card.id));
  for (let offset = 0; offset <= cards.length; offset++) {
    const id = `mp-${now}-${((suffix + offset) % (36 ** 4)).toString(36).padStart(4, '0')}`;
    if (ids.has(id)) continue;
    data.customCards = [...cards, { id, en: en.trim(), ko: ko.trim(), source: source.trim(), createdAt: new Date(now).toISOString() }];
    return 'saved';
  }
  return 'invalid';
}
export function deletePhrase(data: ProfileData, id: string): void {
  data.customCards = (data.customCards ?? []).filter(card => card.id !== id);
  delete data.srs[`vocab:${MY_PHRASES}:${id}`]; delete data.srs[`speak:${MY_PHRASES}:${id}`];
}
/** 표시가 없는 이전 보호자 설정만 한 번 전환하며, 사용자가 나중에 끈 설정은 유지한다. */
export function enableBusinessTalkOnce(settings: ProfileSettings, alreadyEnabled: boolean): void {
  if (!alreadyEnabled) {
    const mission = settings.missions.find(row => row.type === 'talk');
    if (mission) { mission.enabled = true; mission.target = 15; }
    else settings.missions.push({ type: 'talk', enabled: true, target: 15 });
    if (settings.talk) settings.talk.dailyMinutes = 15;
    for (const field of ['vocabDecks', 'speakingDecks'] as const) if (!settings[field].includes(MY_PHRASES)) settings[field] = [...settings[field], MY_PHRASES];
  }
  settings.bizTalkEnabledOnce = true;
}
export function businessRequest(scenarioId: string, situation: string, memory: string, speed?: ParentSpeed): Omit<SessionRequest, 'offerSdp'> {
  if (!BUSINESS_SCENARIOS.some(row => row.id === scenarioId) || (scenarioId === 'biz-custom' && !text(situation, 300))) throw new Error('대화 상황을 확인해 주세요.');
  return { profileId: 'parent', level: 'adult', mode: 'biz-talk', scenarioId,
    ...(scenarioId === 'biz-custom' ? { situation: situation.trim() } : {}),
    persona: { friendName: 'Alex', personaId: 'calm', voice: 'cedar' }, memory: memory.slice(0, 1500), ...(speed !== undefined ? { speed } : {}) };
}
/** 기존 기억 합치기 API의 요약 형태로 표현과 연습 상황을 전달한다. */
export function businessMemorySummary(log: TalkLog, feedback: BizFeedback): TalkSummary {
  return { highlightKo: feedback.overallKo, topicsKo: [scenarioTitle(log.scenarioId)], newExpressions: feedback.nextExpressions, nextTopics: [scenarioTitle(log.scenarioId)] };
}
