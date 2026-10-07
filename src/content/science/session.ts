import type { AppState, Level, ProfileId, ScienceCard, ScienceData, ScienceRecord, ScienceTopic } from '../../types';
import { SCIENCE_CARDS, SCIENCE_CARD_MAP } from './cards';
import { applyProgress } from '../../lib/progress';
import { aiReady } from '../../lib/talk';
import { seededRng, shuffle, type Rng } from '../../lib/random';

export const SCIENCE_TOPICS: Record<ScienceTopic, { title: string; icon: string; museum: string }> = {
  'float-sink': { title: '뜨고 가라앉기', icon: '🐟', museum: '물고기 수조' },
  electricity: { title: '정전기와 전기', icon: '⚡', museum: '반짝 전시실' },
  light: { title: '빛과 그림자', icon: '🌈', museum: '빛 전시실' },
  sound: { title: '소리', icon: '🎵', museum: '소리 전시실' },
  magnet: { title: '자석', icon: '🧲', museum: '자석 전시실' },
  states: { title: '물질의 성질과 상태', icon: '🦴', museum: '화석 전시실' },
  mixing: { title: '섞기와 녹이기', icon: '🎨', museum: '색 전시실' },
  air: { title: '공기', icon: '🎈', museum: '공기 전시실' },
  living: { title: '생물', icon: '🐜', museum: '곤충 전시실' },
  heat: { title: '온도와 열', icon: '🌡️', museum: '온도 전시실' },
  weather: { title: '날씨', icon: '☁️', museum: '구름 전시실' },
  motion: { title: '힘과 운동', icon: '🚗', museum: '움직임 전시실' },
  'acid-base': { title: '산과 염기', icon: '🥬', museum: '색 변화 전시실' },
  space: { title: '해와 달', icon: '🌙', museum: '우주 전시실' },
};
export const OTHER_OBSERVATIONS = ['다르게 관찰했어요', '관찰이 어려웠어요'];

export function cardsFor(level: Level): ScienceCard[] {
  return SCIENCE_CARDS.filter(card => level !== 'adult' && (card.audience === 'both' || card.audience === level));
}
export function pendingCards(level: Level, data: ScienceData): ScienceCard[] {
  const eligible = cardsFor(level);
  const unseen = eligible.filter(card => !data.cycleDone.includes(card.id));
  return unseen.length ? unseen : eligible;
}
function dateSeed(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
/** 고정된 섞기 순서에서 날짜 시드를 순환시켜 연속 날짜의 중복을 피한다. */
function seededChoice(pool: ScienceCard[], date: string, rng: Rng): ScienceCard | undefined {
  const ordered = shuffle(pool, rng);
  return ordered.length ? ordered[((dateSeed(date) % ordered.length) + ordered.length) % ordered.length] : undefined;
}
export function chooseCard(level: Level, data: ScienceData, date: string, rng: Rng = seededRng(808)): ScienceCard | undefined {
  if (data.today?.date === date) {
    const kept = cardsFor(level).find(card => card.id === data.today?.cardId);
    if (kept) return kept;
  }
  return seededChoice(pendingCards(level, data), date, rng);
}
export function togetherCandidates(state: AppState): ScienceCard[] {
  const first = state.profiles.find(p => p.id === 'kid1')!;
  const second = state.profiles.find(p => p.id === 'kid2')!;
  const secondIds = new Set(pendingCards(second.level, state.data.kid2.science).map(c => c.id));
  return pendingCards(first.level, state.data.kid1.science).filter(c => c.audience === 'both' && secondIds.has(c.id));
}
export function togetherCard(state: AppState, date: string, rng: Rng = seededRng(808)): ScienceCard | undefined {
  return seededChoice(togetherCandidates(state), date, rng);
}
export function badgeThresholds(count: number): number[] {
  return [3, 6, 10].filter(n => count >= n);
}
export function scienceBadges(done: ScienceData['done']): string[] {
  const counts: Partial<Record<ScienceTopic, number>> = {};
  for (const id of Object.keys(done)) {
    const topic = SCIENCE_CARD_MAP[id]?.topic;
    if (topic) counts[topic] = (counts[topic] ?? 0) + 1;
  }
  return Object.keys(SCIENCE_TOPICS).flatMap(topic => badgeThresholds(counts[topic as ScienceTopic] ?? 0).map(n => `${topic}:${n}`));
}
export interface ScienceEntry { profileId: ProfileId; predicted: string; observed: string; thinkAnswer?: string }

/** 같은 날 같은 카드의 중복 저장·별 지급을 막고 형제 기록을 같은 draft에 반영한다. */
export function recordScience(state: AppState, cardId: string, date: string, entries: ScienceEntry[], together = false): boolean {
  const card = SCIENCE_CARD_MAP[cardId];
  if (!card || !entries.length || new Set(entries.map(row => row.profileId)).size !== entries.length) return false;
  if (together && (card.audience !== 'both' || entries.length !== 2 || !entries.some(e => e.profileId === 'kid1') || !entries.some(e => e.profileId === 'kid2'))) return false;
  if (!together && entries.length !== 1) return false;
  for (const entry of entries) {
    const profile = state.profiles.find(p => p.id === entry.profileId);
    if (!profile || !cardsFor(profile.level).some(c => c.id === cardId) || !card.predictions.includes(entry.predicted) ||
      ![...card.predictions, ...OTHER_OBSERVATIONS].includes(entry.observed) || (profile.level === 'g5' && !entry.thinkAnswer?.trim())) return false;
  }
  let changed = false;
  for (const entry of entries) {
    const data = state.data[entry.profileId];
    if (data.science.done[cardId]?.date === date) continue;
    const eligible = cardsFor(state.profiles.find(p => p.id === entry.profileId)!.level);
    if (eligible.every(c => data.science.cycleDone.includes(c.id))) data.science.cycleDone = [];
    const record: ScienceRecord = { date, predicted: entry.predicted, observed: entry.observed, together,
      ...(entry.thinkAnswer?.trim() ? { thinkAnswer: entry.thinkAnswer.trim().slice(0, 300) } : {}) };
    data.science.done[cardId] = record;
    if (!data.science.cycleDone.includes(cardId)) data.science.cycleDone.push(cardId);
    data.science.today = { date, cardId };
    data.science.badges = scienceBadges(data.science.done);
    applyProgress(data, state.settings[entry.profileId], date, { type: 'science', stars: 1 + Number(entry.predicted === entry.observed) }, { aiReady: aiReady(state.ai) });
    changed = true;
  }
  return changed;
}
/** 오늘 한 실험 제목만 데이터 칩으로 보낸다. 예상과 생각 답은 보내지 않는다. */
export function scienceTalkTopics(data: ScienceData, date: string): string[] {
  return Object.entries(data.done).filter(([, row]) => row.date === date).map(([id]) => SCIENCE_CARD_MAP[id]?.title)
    .filter((title): title is string => !!title).map(title => `오늘 실험: ${title}`.slice(0, 40));
}
export function normalizeScience(raw: unknown): ScienceData {
  if (!raw || typeof raw !== 'object') return { done: {}, badges: [], cycleDone: [] };
  const source = raw as Partial<ScienceData>;
  const done: ScienceData['done'] = {};
  if (source.done && typeof source.done === 'object' && !Array.isArray(source.done)) {
    for (const [id, row] of Object.entries(source.done)) {
      if (id === '__proto__' || id === 'constructor' || !row || typeof row !== 'object' || typeof row.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || typeof row.predicted !== 'string' || typeof row.observed !== 'string') continue;
      done[id] = { date: row.date, predicted: row.predicted.slice(0, 300), observed: row.observed.slice(0, 300),
        ...(typeof row.thinkAnswer === 'string' ? { thinkAnswer: row.thinkAnswer.slice(0, 300) } : {}),
        ...(typeof row.together === 'boolean' ? { together: row.together } : {}) };
    }
  }
  const cycleDone = Array.isArray(source.cycleDone) ? [...new Set(source.cycleDone.filter(id => typeof id === 'string' && !!done[id]))] : Object.keys(done);
  const today = source.today;
  return { done, badges: scienceBadges(done), cycleDone,
    ...(today && typeof today.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today.date) && typeof today.cardId === 'string' && !!SCIENCE_CARD_MAP[today.cardId]
      ? { today: { date: today.date, cardId: today.cardId } } : {}) };
}
