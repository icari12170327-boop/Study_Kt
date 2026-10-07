import { describe, expect, it } from 'vitest';
import { BUSINESS_SCENARIOS, businessMemorySummary, businessRequest, deletePhrase, isBizFeedback, isShortFeedback, normalizeBizSituations, normalizeCustomCards, rememberSituation, savePhrase } from './business';
import { getVocabCards, VOCAB_DECK_MAP } from '../content/english/vocab';
import { buildSpeakingSession, buildVocabSession } from '../content/english/session';
import { defaultState, emptyProfileData } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
import { seededRng } from './random';
import { defaultTalkSettings, maskSubtitle, talkRequest, talkSignals } from './talk';
import type { BizFeedback } from '../types';
const feedback: BizFeedback = { overallKo: '요점을 잘 전달했어요.', corrections: [{ said: 'We discuss tomorrow.', better: "Let's discuss this tomorrow.", why: '제안할 때 자연스러운 표현이에요.' }], nextExpressions: [{ en: 'Could we revisit the timeline?', ko: '일정을 다시 검토할까요?' }, { en: 'Let me clarify.', ko: '명확히 설명하겠습니다.' }, { en: 'That works for me.', ko: '저는 좋습니다.' }] };
const date = '2026-10-08', now = Date.parse(`${date}T03:00:00Z`);
function dataWithCards(count = 1) {
  const data = emptyProfileData('adult');
  for (let i = 0; i < count; i++) savePhrase(data, `Phrase ${i}`, `표현 ${i}`, '납품 단가 협상', now + i, seededRng(i));
  return data;
}
describe('내 표현과 덱 세션', () => {
  it('정적 덱과 내 표현을 같은 카드 형태로 조회하고 없는 덱은 빈 목록이다', () => {
    const data = dataWithCards();
    expect(getVocabCards('biz-ai', data)).toEqual(VOCAB_DECK_MAP['biz-ai'].cards);
    expect(getVocabCards('my-phrases', data)[0]).toMatchObject({ id: data.customCards![0].id, en: 'Phrase 0', ko: '표현 0' });
    expect(getVocabCards('my-phrases')).toEqual([]); expect(getVocabCards('missing')).toEqual([]);
  });
  it('영문 대소문자·앞뒤 공백 중복을 막고 같은 시각·난수에도 카드 ID가 겹치지 않는다', () => {
    const data = dataWithCards();
    expect(savePhrase(data, '  PHRASE 0 ', '다른 뜻', '다른 상황', now, () => 0)).toBe('duplicate');
    expect(savePhrase(data, 'Second phrase', '두 번째 표현', '다른 상황', now, () => 0)).toBe('saved');
    expect(savePhrase(data, 'Third phrase', '세 번째 표현', '다른 상황', now, () => 0)).toBe('saved');
    expect(new Set(data.customCards!.map(card => card.id)).size).toBe(3);
    for (const card of data.customCards!) expect(card.id).toMatch(/^mp-\d+-[a-z0-9]{4}$/);
    expect(savePhrase(data, '', '뜻', '상황', now, () => 0)).toBe('invalid');
    expect(savePhrase(data, 'en', '뜻', '상황', NaN, () => 0)).toBe('invalid');
  });
  it.each([1, 2, 3])('내 표현 %i장이어도 뜻·영어·듣기 보기 4개를 중복 없이 채운다', count => {
    const data = dataWithCards(count);
    for (let seed = 0; seed < 20; seed++) {
      const items = buildVocabSession(['my-phrases'], {}, date, count, seededRng(seed), data);
      for (const item of items) { expect(item.options).toHaveLength(4); expect(new Set(item.options).size).toBe(4); expect(item.options).toContain(item.card.ko); }
      for (const card of data.customCards!) data.srs[`vocab:my-phrases:${card.id}`] = { box: 2, seen: 2, due: date, lapses: 0 };
      const review = buildVocabSession(['my-phrases'], data.srs, date, count, seededRng(seed), data);
      for (const item of review) { expect(item.options).toHaveLength(4); expect(item.options).toContain(item.mode === 'meaning' ? item.card.ko : item.card.en); }
    }
  });
  it('밀린 정적 카드가 있어도 다음 단어·따라 말하기에 새 표현이 한 장 포함된다', () => {
    const data = dataWithCards(), id = data.customCards![0].id;
    for (const card of VOCAB_DECK_MAP['biz-ai'].cards) data.srs[`vocab:biz-ai:${card.id}`] = { box: 1, seen: 1, due: '2026-01-01', lapses: 0 };
    expect(buildVocabSession(['biz-ai', 'my-phrases'], data.srs, date, 10, seededRng(1), data).some(item => item.key === `vocab:my-phrases:${id}`)).toBe(true);
    expect(buildSpeakingSession(['biz-talk', 'my-phrases'], data.srs, date, 10, seededRng(1), data).some(item => item.key === `speak:my-phrases:${id}`)).toBe(true);
    expect(buildVocabSession(['biz-ai'], data.srs, date, 10, seededRng(1), data).some(item => item.key.includes('my-phrases'))).toBe(false);
    expect(buildSpeakingSession(['biz-talk'], data.srs, date, 10, seededRng(1), data).some(item => item.key.includes('my-phrases'))).toBe(false);
  });
  it('내 표현만으로 보기 네 개를 만들 수 있으면 다른 덱 보기를 섞지 않는다', () => {
    const data = dataWithCards(4);
    const meanings = new Set(data.customCards!.map(card => card.ko));
    for (const item of buildVocabSession(['my-phrases'], {}, date, 4, seededRng(1), data)) {
      expect(item.options).toHaveLength(4); expect(item.options.every(value => meanings.has(value))).toBe(true);
    }
  });
  it('삭제 시 해당 카드와 두 SRS 키만 정리하고 보상은 유지한다', () => {
    const data = dataWithCards(2), id = data.customCards![0].id, other = data.customCards![1].id;
    const row = { box: 2, seen: 2, due: date, lapses: 0 };
    data.stars = 30; data.streak = 5;
    data.srs = { [`vocab:my-phrases:${id}`]: row, [`speak:my-phrases:${id}`]: row, [`vocab:my-phrases:${other}`]: row, static: row };
    deletePhrase(data, id);
    expect(data.customCards!.map(card => card.id)).toEqual([other]); expect(Object.keys(data.srs)).toEqual([`vocab:my-phrases:${other}`, 'static']);
    expect(data.stars).toBe(30); expect(data.streak).toBe(5);
  });
});
describe('보호자 저장과 대화 요청', () => {
  it.each([1, 2])('새 선택 필드가 없는 v%i 백업에도 기존 기록·보상을 보존하고 빈 목록을 채운다', version => {
    const raw = { ...defaultState(), version };
    delete raw.settings.parent.bizTalkEnabledOnce;
    raw.settings.parent.vocabDecks = ['biz-ai']; raw.settings.parent.speakingDecks = ['biz-talk'];
    for (const data of Object.values(raw.data)) { delete data.customCards; delete data.bizSituations; }
    raw.data.parent.stars = 41; raw.data.parent.streak = 7; raw.data.parent.lastCompleted = date;
    raw.data.parent.coupons = [{ id: 'earned', earnedAt: date, label: '커피 한 잔' }];
    raw.data.parent.talks = [{ id: 'old', date, seconds: 65, lines: [{ role: 'kid', text: 'Hello.', at: now }], englishRatio: 1 }];
    const original = structuredClone(raw), restored = importState(JSON.stringify(raw));
    expect(restored.version).toBe(2);
    expect(restored.data.parent).toEqual({ ...original.data.parent, customCards: [], bizSituations: [] });
    for (const data of Object.values(restored.data)) { expect(data.customCards).toEqual([]); expect(data.bizSituations).toEqual([]); }
    normalizeState(raw); expect(raw).toEqual(original);
    expect(importState(exportState(restored))).toEqual(restored);
  });
  it('최근 상황은 중복 없이 최신 5개를 보존하고 다시 고르면 앞에 온다', () => {
    const data = emptyProfileData('adult');
    for (let i = 0; i < 7; i++) rememberSituation(data, `상황 ${i}`);
    expect(data.bizSituations).toEqual(['상황 6', '상황 5', '상황 4', '상황 3', '상황 2']);
    rememberSituation(data, ' 상황 3 '); expect(data.bizSituations).toEqual(['상황 3', '상황 6', '상황 5', '상황 4', '상황 2']);
    expect(normalizeBizSituations([null, '', 'x'.repeat(301), '정상', ' 정상 '])).toEqual(['정상']);
  });
  it.each([1, 2])('v%i 보호자 talk를 한 번만 15분으로 켜고 이후 꺼 둔 설정과 기존 기록은 유지한다', version => {
    const raw = { ...defaultState(), version }; delete raw.settings.parent.bizTalkEnabledOnce;
    raw.settings.parent.missions.find(row => row.type === 'talk')!.enabled = false;
    raw.settings.parent.missions.find(row => row.type === 'talk')!.target = 30;
    raw.data.parent.stars = 20; raw.data.parent.streak = 3;
    const before = structuredClone(raw.data), children = structuredClone(raw.settings.kid1);
    const first = normalizeState(raw);
    expect(first.version).toBe(2); expect(first.settings.parent.missions.find(row => row.type === 'talk')).toEqual({ type: 'talk', enabled: true, target: 15 });
    expect(first.settings.parent.talk!.dailyMinutes).toBe(15); expect(first.settings.parent.bizTalkEnabledOnce).toBe(true);
    expect(first.data).toEqual(before); expect(first.settings.kid1).toEqual({ ...children, missions: expect.arrayContaining(children.missions) });
    expect(first.settings.kid1.missions).toHaveLength(children.missions.length);
    first.settings.parent.missions.find(row => row.type === 'talk')!.enabled = false;
    first.settings.parent.vocabDecks = ['biz-ai']; first.settings.parent.speakingDecks = ['biz-talk'];
    const again = normalizeState(first);
    expect(again.settings.parent.missions.find(row => row.type === 'talk')!.enabled).toBe(false);
    expect(again.settings.parent.vocabDecks).toEqual(['biz-ai']); expect(again.settings.parent.speakingDecks).toEqual(['biz-talk']);
  });
  it('잘못된 카드·상황·피드백을 걸러내고 정상 값과 SRS·대화 기록을 백업 왕복한다', () => {
    const state = defaultState(); state.data.parent = dataWithCards(); state.data.parent.bizSituations = ['일정 지연 회의'];
    const id = state.data.parent.customCards![0].id;
    state.data.parent.srs[`vocab:my-phrases:${id}`] = { box: 2, seen: 1, lapses: 0, due: date };
    state.data.parent.talks = [{ id: 'log', date, seconds: 180, lines: [{ role: 'kid', text: 'Hello', at: now }], englishRatio: 1, scenarioId: 'biz-custom', situation: '일정 지연 회의', feedback }];
    expect(importState(exportState(state))).toEqual(state);
    const raw = JSON.parse(exportState(state));
    raw.data.parent.customCards.push(null, { ...raw.data.parent.customCards[0], en: ' PHRASE 0 ' }, { id: 'invalid', en: 'en', ko: 1, source: [], createdAt: 'bad' });
    raw.data.parent.bizSituations.push(null, '', 'x'.repeat(301)); raw.data.parent.talks.push({ ...raw.data.parent.talks[0], id: 'bad', feedback: { ...feedback, corrections: Array(6).fill(feedback.corrections[0]) } });
    const restored = importState(JSON.stringify(raw));
    expect(restored.data.parent.customCards).toEqual(state.data.parent.customCards); expect(restored.data.parent.bizSituations).toEqual(state.data.parent.bizSituations);
    expect(restored.data.parent.talks[1].feedback).toBeUndefined();
    expect(normalizeCustomCards(undefined)).toEqual([]); expect(normalizeBizSituations(undefined)).toEqual([]);
  });
  it('8개 요청은 고정 보호자 persona를 쓰고 직접 입력에서만 situation을 전달한다', () => {
    for (const scenario of BUSINESS_SCENARIOS) {
      const req = businessRequest(scenario.id, '일정 지연 회의', '지난 연습 기억');
      expect(req).toMatchObject({ profileId: 'parent', level: 'adult', mode: 'biz-talk', persona: { friendName: 'Alex', personaId: 'calm', voice: 'cedar' } });
      expect(req.situation).toBe(scenario.id === 'biz-custom' ? '일정 지연 회의' : undefined);
    }
    expect(() => businessRequest('biz-custom', ' ', '')).toThrow();
    expect(isBizFeedback(feedback)).toBe(true); expect(isBizFeedback({ ...feedback, nextExpressions: [] })).toBe(false);
    expect(isShortFeedback({ alternatives: ['One.', 'Two.'] })).toBe(true); expect(isShortFeedback({ alternatives: ['One.'] })).toBe(false);
    expect(businessMemorySummary({ id: 'x', date, seconds: 60, lines: [], englishRatio: 0, scenarioId: 'biz-negotiation' }, feedback)).toMatchObject({ topicsKo: ['납품 단가 협상'], newExpressions: feedback.nextExpressions });
  });
  it('아이 요청과 자막 가림·도움·마무리 신호는 기존 동작을 유지한다', () => {
    for (const [pid, level] of [['kid1', 'g5'], ['kid2', 'g3']] as const) {
      const settings = defaultTalkSettings(level, pid), req = talkRequest(pid, level, settings, 'memory', 'topic');
      expect(req.mode).toBe('kid-friend'); expect(req.scenarioId).toBeUndefined(); expect(req.situation).toBeUndefined();
      expect(req.persona.friendHobbies).toBe(settings.friendHobbies);
    }
    expect(maskSubtitle('This is a useful expression.', 50, 'id')).toContain('▢▢▢');
    expect(talkSignals({ remaining: 120, now: 10000, friendFinishedAt: 0, stuckSent: false, wrapSent: false, paused: false })).toEqual({ stuck: true, wrapUp: false });
  });
});
