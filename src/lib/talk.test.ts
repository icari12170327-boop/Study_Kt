import { describe, expect, it } from 'vitest';
import { defaultState, emptyProfileData } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
import { aiReady, defaultTalkSettings, englishRatio, maskSubtitle, migrateV1toV2, normalizeTalkSettings, recordTalkSeconds, summaryLines, talkRequest, talkSignals, talkTopics } from './talk';
import { applyProgress, dayRatio, emptyDay, enabledMissions, isDayComplete } from './progress';
import type { TalkLine } from '../types';

describe('대화 저장 마이그레이션', () => {
  it('세 프로필의 v1 형식 기록을 정규화·백업 복원해도 오답·SRS·독서·연산 기록을 유지한다', () => {
    const state = defaultState(), date = '2026-10-06';
    for (const profile of state.profiles) {
      const data = state.data[profile.id], settings = state.settings[profile.id];
      settings.missions = settings.missions.filter((mission) => mission.type !== 'talk');
      Reflect.deleteProperty(settings, 'talk');
      data.stars = 31; data.streak = 3; data.lastCompleted = date;
      data.wrongNotes = [{ id: 'wrong-1', addedAt: date, given: '3', problem: { skill: 'g3-add3', question: '123 + 456', answer: { kind: 'int', value: 579 } } }];
      data.srs = { '기존 카드 id': { box: 4, due: '2026-10-08', seen: 5, lapses: 1 } };
      data.coupons = [{ id: 'used-coupon', label: '기존 쿠폰', earnedAt: date, usedAt: date }];
      data.notes = [{ id: 'reading-1', title: '기존 책', author: '저자', date, summary: '기존 독서 기록', cards: [{ id: 'qa-1', q: '질문', a: '답' }] }];
      data.math.lastEvaluated = date;
      data.math.history = [{ date, level: data.math.level, counted: 20, correct: 18, guesses: 1, medianSec: 9 }];
      data.days[date] = { ...emptyDay(date), progress: { math: 20, vocab: 8 }, completed: true, correct: 18, total: 20,
        mathBySkill: { 'g3-add3': { correct: 18, total: 20 } }, mathAttempts: [{ skill: 'g3-add3', correct: true, activeMs: 9000, guessed: false }] };
      Reflect.deleteProperty(data.days[date], 'talkSeconds');
      Reflect.deleteProperty(data, 'talks'); Reflect.deleteProperty(data, 'friendMemory');
    }
    const legacy = { ...state, version: 1 as const }, before = structuredClone(legacy);
    const normalized = normalizeState(legacy), restored = importState(JSON.stringify(legacy));
    for (const next of [normalized, restored, importState(exportState(normalized))]) {
      expect(next.version).toBe(2);
      for (const profile of state.profiles) {
        const data = next.data[profile.id], old = before.data[profile.id];
        for (const field of ['stars', 'streak', 'lastCompleted', 'wrongNotes', 'srs', 'coupons', 'notes', 'math'] as const)
          expect(data[field]).toEqual(old[field]);
        expect(data.days[date]).toEqual({ ...old.days[date], talkSeconds: 0 });
        expect(data.talks).toEqual([]); expect(data.friendMemory).toBe('');
      }
    }
    expect(legacy).toEqual(before);
  });
  it('대화 필드가 없는 실제 v1 구조에도 빈 기록과 기억을 채운다', () => {
    const state = defaultState();
    const oldData = { ...state.data.kid1 };
    Reflect.deleteProperty(oldData, 'talks'); Reflect.deleteProperty(oldData, 'friendMemory');
    const legacy = { ...state, version: 1 as const, data: { ...state.data, kid1: oldData } };
    const restored = migrateV1toV2(legacy);
    expect(restored.data.kid1.talks).toEqual([]);
    expect(restored.data.kid1.friendMemory).toBe('');
    expect(legacy.data.kid1).not.toHaveProperty('talks');
    expect(legacy.data.kid1).not.toHaveProperty('friendMemory');
  });
  it('v1을 복사해 아이 미션만 전환하고 별·연속일·오답·SRS·쿠폰·독서 기록을 보존한다', () => {
    const state = defaultState();
    state.settings.kid1.missions = state.settings.kid1.missions.filter((m) => m.type !== 'talk').map((m) => ({ ...m, enabled: true }));
    state.data.kid1 = { ...state.data.kid1, stars: 31, streak: 3, srs: { word: { box: 4, due: '2026-10-08', seen: 5, lapses: 1 } }, coupons: [{ id: 'c', label: '기존 쿠폰', earnedAt: '2026-10-06' }] };
    const legacy = { ...state, version: 1 as const };
    const before = structuredClone(legacy);
    const migrated = migrateV1toV2(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.data).toEqual(legacy.data);
    expect(migrated.settings.kid1.missions.find((m) => m.type === 'vocab')?.enabled).toBe(false);
    expect(migrated.settings.kid1.missions.find((m) => m.type === 'speaking')?.enabled).toBe(false);
    expect(migrated.settings.kid1.missions.find((m) => m.type === 'talk')).toEqual({ type: 'talk', enabled: true, target: 20 });
    expect(migrated.settings.kid2.missions.find((m) => m.type === 'talk')?.target).toBe(15);
    expect(migrated.settings.parent.missions.find((m) => m.type === 'talk')?.enabled).toBe(false);
    expect(legacy).toEqual(before);
    const v2 = normalizeState(migrated);
    v2.settings.kid1.missions.find((m) => m.type === 'vocab')!.enabled = true;
    v2.settings.kid1.missions.find((m) => m.type === 'talk')!.enabled = false;
    expect(normalizeState(v2)).toEqual(v2);
  });
  it('대화 기록·기억·설정을 백업하고 최근 60개·1500자·범위를 복원한다', () => {
    const state = defaultState();
    state.data.kid1.friendMemory = '로봇 이야기를 좋아함';
    state.data.kid1.talks = Array.from({ length: 62 }, (_, i) => ({ id: `${i}`, date: '2026-10-07', seconds: 60, lines: [{ role: 'kid', text: 'Hello 안녕', at: 0 }], englishRatio: 0.5, flagged: true }));
    state.settings.kid1.talk!.subtitleHidePercent = 10;
    const restored = importState(exportState(state));
    expect(restored.data.kid1.talks).toEqual(state.data.kid1.talks.slice(-60));
    expect(restored.data.kid1.friendMemory).toBe(state.data.kid1.friendMemory);
    expect(restored.settings.kid1.talk).toEqual(state.settings.kid1.talk);
    state.data.kid1.friendMemory = '가'.repeat(1600);
    expect(normalizeState(state).data.kid1.friendMemory).toHaveLength(1500);
    expect(normalizeTalkSettings({ subtitleHidePercent: 200, dailyMinutes: -1, voice: 'unknown' }, 'g3')).toMatchObject({ subtitleHidePercent: 100, dailyMinutes: 1, voice: 'coral' });
  });
});
describe('자막 가림과 영어 비율', () => {
  const text = 'I am building amazing little castles with colorful blocks today.';
  it('10%의 단어를 시드로 고정해 가리고 짧은 단어·공백·문장부호는 우선 보존한다', () => {
    const masked = maskSubtitle(text, 10, 'item-1');
    expect(masked.match(/▢▢▢/g)).toHaveLength(1);
    expect(masked.startsWith('I am ')).toBe(true);
    expect(masked.endsWith('.')).toBe(true);
    expect(maskSubtitle(text, 10, 'item-1')).toBe(masked);
    expect(new Set(Array.from({ length: 10 }, (_, i) => maskSubtitle(text, 20, `${i}`))).size).toBeGreaterThan(1);
    expect(maskSubtitle(text, 0, 'item-1')).toBe(text);
    expect(maskSubtitle(text, 100, 'item-1').match(/▢▢▢/g)).toHaveLength(10);
    expect(maskSubtitle('', 100, 'item-1')).toBe('');
    expect(maskSubtitle(text, NaN, 'item-1')).toBe(text);
  });
  it('스트리밍 중에는 이미 보인 단어를 유지하고 문장이 완성되면 한 번만 가린다', () => {
    const phrase = 'No way that is so cool tell me more about your awesome';
    for (const text of [phrase, `${phrase} world`, `${phrase} world today`]) {
      expect(maskSubtitle(text, 10, 'stream-1', false)).toBe(text);
    }
    const complete = `${phrase} world today`;
    expect(maskSubtitle(complete, 10, 'stream-1', true)).toBe(maskSubtitle(complete, 10, 'stream-1'));
    expect(maskSubtitle(complete, 10, 'stream-1', true)).toContain('▢▢▢');
  });
  it('아이의 라틴 단어와 한글 어절만 세며 친구 말·숫자·구두점은 제외한다', () => {
    const lines: TalkLine[] = [{ role: 'friend', text: 'many English words here', at: 0 }, { role: 'kid', text: "I'm happy 오늘 학교에서 123!", at: 1 }];
    expect(englishRatio(lines)).toBe(0.5);
    expect(englishRatio([{ role: 'kid', text: '안녕 친구야', at: 0 }])).toBe(0);
    expect(englishRatio([{ role: 'kid', text: 'Hello friend', at: 0 }])).toBe(1);
    expect(englishRatio([])).toBe(0);
  });
});
describe('대화 미션과 보상', () => {
  it.each([false, true])('AI 연결 상태 %s를 목록·완료·비율·보상에 같은 기준으로 반영한다', (ready) => {
    const state = defaultState(), settings = state.settings.kid1, data = emptyProfileData('g5');
    const options = { aiReady: ready }, date = '2026-10-07';
    applyProgress(data, settings, date, { type: 'science', amount: 5 }, options);
    expect(enabledMissions(settings, options).some((m) => m.type === 'talk')).toBe(ready);
    expect(applyProgress(data, settings, date, { type: 'math', amount: 20 }, options).justCompleted).toBe(!ready);
    expect(isDayComplete(data.days[date], settings, options)).toBe(!ready);
    expect(dayRatio(data.days[date], settings, options)).toBe(ready ? 2 / 3 : 1);
    expect(data.coupons.length).toBe(ready ? 0 : 1);
  });
  it('30초씩 끊어 대화해도 누적 1분마다 진행과 별을 한 번만 기록하고 백업한다', () => {
    const state = defaultState(), data = state.data.kid1, settings = state.settings.kid1, day = '2026-10-07';
    recordTalkSeconds(data, settings, day, 30, true);
    expect(data.days[day].talkSeconds).toBe(30);
    expect(data.days[day].progress.talk).toBeUndefined();
    const restored = importState(exportState(state));
    recordTalkSeconds(restored.data.kid1, restored.settings.kid1, day, 30, true);
    expect(restored.data.kid1.days[day].talkSeconds).toBe(60);
    expect(restored.data.kid1.days[day].progress.talk).toBe(1);
    expect(restored.data.kid1.stars).toBe(1);
  });
  it('작별 신호와 10초 막힘 신호는 한 번만 보내고 멈춤·말 시작·종료 시에는 기다린다', () => {
    const current = { remaining: 60, now: 10000, friendFinishedAt: 0, stuckSent: false, wrapSent: false, paused: false };
    expect(talkSignals(current)).toEqual({ wrapUp: true, stuck: true });
    expect(talkSignals({ ...current, remaining: 61, now: 9999 })).toEqual({ wrapUp: false, stuck: false });
    expect(talkSignals({ ...current, stuckSent: true, wrapSent: true })).toEqual({ wrapUp: false, stuck: false });
    expect(talkSignals({ ...current, paused: true }).stuck).toBe(false);
    expect(talkSignals({ ...current, wrapSent: true }).stuck).toBe(false);
    expect(talkSignals({ ...current, friendFinishedAt: undefined }).stuck).toBe(false);
    expect(talkSignals({ ...current, remaining: 0 })).toEqual({ wrapUp: false, stuck: false });
  });
  it('AI 설정이 없으면 대화를 완료 조건·진행 비율에서 빼고 쿠폰은 한 번 지급한다', () => {
    const state = defaultState(), settings = state.settings.kid1, data = emptyProfileData('g5');
    applyProgress(data, settings, '2026-10-07', { type: 'science', amount: 5 }, { aiReady: false });
    expect(aiReady({})).toBe(false);
    expect(aiReady({ endpoint: 'https://worker.example', token: 'x'.repeat(32) })).toBe(true);
    expect(applyProgress(data, settings, '2026-10-07', { type: 'math', amount: 20 }, { aiReady: false }).justCompleted).toBe(true);
    expect(isDayComplete(data.days['2026-10-07'], settings, { aiReady: true })).toBe(false);
    expect(dayRatio(data.days['2026-10-07'], settings, { aiReady: false })).toBe(1);
    expect(dayRatio(data.days['2026-10-07'], settings, { aiReady: true })).toBe(2 / 3);
    applyProgress(data, settings, '2026-10-07', { type: 'math' }, { aiReady: false });
    expect(data.coupons).toHaveLength(1);
  });
  it('대화 진행은 분마다 오르고 목표를 초과한 추가 대화에는 별을 더 주지 않는다', () => {
    const state = defaultState(), settings = state.settings.kid2, data = emptyProfileData('g3');
    const day = '2026-10-07';
    applyProgress(data, settings, day, { type: 'science', amount: 5 }, { aiReady: true });
    applyProgress(data, settings, day, { type: 'math', amount: 20 }, { aiReady: true });
    for (let i = 0; i < 14; i++) applyProgress(data, settings, day, { type: 'talk', amount: 1 }, { aiReady: true });
    expect(data.stars).toBe(14);
    expect(data.days[day].completed).toBe(false);
    expect(applyProgress(data, settings, day, { type: 'talk' }, { aiReady: true }).justCompleted).toBe(true);
    applyProgress(data, settings, day, { type: 'talk', amount: 5 }, { aiReady: true });
    expect(data.stars).toBe(15);
    expect(data.coupons).toHaveLength(1);
    expect(data.days[day].progress.talk).toBe(20);
    expect(isDayComplete(emptyDay(day), settings, { aiReady: false })).toBe(false);
  });
  it('Worker 요청에 프로필 실명 없이 친구 설정·학년·기억만 넣고 다음 주제를 이어 간다', () => {
    const settings = defaultTalkSettings('g3', 'kid2');
    const request = talkRequest('kid2', 'g3', settings, 'm'.repeat(1600), 'My island');
    expect(request).not.toHaveProperty('name');
    expect(request).not.toHaveProperty('instructions');
    expect(request.persona.friendName).toBe('Lily');
    expect(request.memory).toHaveLength(1500);
    expect(request.interests).toContain('fishing and bug catching');
    expect(talkTopics(settings, [{ id: 'a', date: '2026-10-07', seconds: 60, lines: [], englishRatio: 0, summary: { highlightKo: '', topicsKo: [], newExpressions: [], nextTopics: ['Tomorrow'] } }])[0]).toBe('Tomorrow');
    const lines: TalkLine[] = Array.from({ length: 300 }, (_, i) => ({ role: 'kid', text: '한'.repeat(2000), at: i }));
    const selected = summaryLines(lines);
    expect(selected.length).toBeLessThanOrEqual(300);
    expect(new TextEncoder().encode(JSON.stringify({ lines: selected })).length).toBeLessThan(100000);
    expect(selected.at(-1)?.at).toBe(299);
    expect(lines[0].text).toHaveLength(2000);
    const short: TalkLine[] = Array.from({ length: 150 }, (_, i) => ({ role: 'kid', text: 'Hello!', at: i }));
    expect(summaryLines(short)).toEqual(short);
  });
});
