import { describe, expect, it } from 'vitest';
import { coachRequest, extractRepeatSentence, fillCoachMeanings, isCoachCheck, isCoachWrapup, normalizeCoachInterests, normalizeCoachSettings, subtitleVisible } from './coach';
import { emptyProfileData } from '../store/defaults';

describe('코치 순수 로직', () => {
  it.each([
    ['Nice! 따라 해 볼까? "I had a busy day."', 'I had a busy day.'],
    ['“I’m fine.”', 'I’m fine.'], ['"First sentence." "Second sentence."', 'First sentence.'],
    ['"  I like tea.  "', 'I like tea.'], ['따옴표 없음', null], ['"오늘 I am busy."', null],
    ['"I like tea. You like coffee."', null], ['"日本 tea"', null], ['"a"', null],
    ['"" "I am fine."', null], [`"${'a'.repeat(121)}"`, null], ['"I\nam fine."', null],
  ])('따라 할 문장: %s', (input, expected) => { expect(extractRepeatSentence(input)).toBe(expected); });
  it('2~120자 영어 문장 경계를 허용한다', () => {
    expect(extractRepeatSentence('"Hi"')).toBe('Hi'); expect(extractRepeatSentence(`"${'a'.repeat(120)}"`)).toHaveLength(120);
  });
  it('즉시·음성 종료 후·눌러 보기 규칙을 구분한다', () => {
    for (const audioDone of [false, true]) for (const peeked of [false, true]) {
      expect(subtitleVisible('now', { audioDone, peeked })).toBe(true);
      expect(subtitleVisible('after', { audioDone, peeked })).toBe(audioDone);
      expect(subtitleVisible('hidden', { audioDone, peeked })).toBe(peeked);
    }
  });
  it('기본값과 허용 값만 정규화하고 원본을 바꾸지 않는다', () => {
    const defaults = { level: 'zero', repeat: 'mid', speed: 0.85, subtitle: 'after' };
    for (const raw of [null, undefined, [], 1, { level: 'bad', repeat: 'bad', speed: 2, subtitle: 'bad' }]) expect(normalizeCoachSettings(raw)).toEqual(defaults);
    for (const speed of [0.85, 0.9, 1]) expect(normalizeCoachSettings({ level: 'daily', repeat: 'low', speed, subtitle: 'hidden' })).toEqual({ level: 'daily', repeat: 'low', speed, subtitle: 'hidden' });
  });
  it('보호자 요청에만 코치 설정·속도·최근 관심사 최대 5개를 넣는다', () => {
    expect(normalizeCoachInterests([' AI ', 'AI', null, '여행', '음식', '연금', '취미', '독서'])).toEqual(['AI', '여행', '음식', '연금', '취미']);
    const req = coachRequest('money', normalizeCoachSettings(null), '기억', ['연금']);
    expect(req).toMatchObject({ profileId: 'parent', mode: 'parent-coach', coachTopic: 'money', speed: 0.85, coach: { level: 'zero', repeat: 'mid' }, interests: ['연금'] });
    expect(req.scenarioId).toBeUndefined(); expect(req.situation).toBeUndefined(); expect(req).not.toHaveProperty('instructions');
  });
  it('뜻 채우기는 빈 뜻만 바꾸고 카드 ID·중복·복습·기존 뜻을 보존한다', () => {
    const data = emptyProfileData('adult');
    data.customCards = [{ id: 'mp-1-abcd', en: 'I like tea.', ko: '', source: '코치', createdAt: '2026-10-08T01:00:00Z' }, { id: 'mp-2-abcd', en: 'I like coffee.', ko: '내 뜻', source: '코치', createdAt: '2026-10-08T01:00:00Z' }];
    data.srs = { 'speak:my-phrases:mp-1-abcd': { box: 1, seen: 1, due: '2026-10-09', lapses: 0 } };
    const original = structuredClone(data);
    fillCoachMeanings(data, [{ en: ' I LIKE TEA. ', ko: '차를 좋아해요.' }, { en: 'I like coffee.', ko: '새 뜻' }, { en: 'New phrase.', ko: '새 표현' }]);
    expect(data).toEqual({ ...original, customCards: [{ ...original.customCards![0], ko: '차를 좋아해요.' }, original.customCards![1]] });
    expect(isCoachWrapup({ sentences: [{ en: 'Hi.', ko: '안녕.' }] })).toBe(true);
    expect(isCoachWrapup({ sentences: Array(4).fill({ en: 'Hi.', ko: '안녕.' }) })).toBe(false);
    expect(isCoachCheck({ corrected: 'Hi.', noteKo: '잘했어요.' })).toBe(true); expect(isCoachCheck({ corrected: '', noteKo: '설명' })).toBe(false);
  });
});

describe('코치 저장·이전과 복습', () => {
  it('뜻 없이 저장한 문장은 단어에서 기다리고 따라 말하기에는 나오며, 같은 카드에 뜻을 채운다', async () => {
    const { savePhrase } = await import('./business');
    const { buildSpeakingSession, buildVocabSession } = await import('../content/english/session');
    const { seededRng } = await import('./random');
    const data = emptyProfileData('adult'), now = Date.parse('2026-10-08T01:00:00Z');
    expect(savePhrase(data, 'I like tea.', '', '코치', now, seededRng(1))).toBe('saved');
    const original = structuredClone(data.customCards![0]);
    expect(buildVocabSession(['my-phrases'], {}, '2026-10-08', 5, seededRng(1), data)).toEqual([]);
    expect(buildSpeakingSession(['my-phrases'], {}, '2026-10-08', 5, seededRng(1), data)[0].sentence.en).toBe('I like tea.');
    expect(savePhrase(data, ' I LIKE TEA. ', '차를 좋아해요.', '다른 곳', now + 1, seededRng(2))).toBe('updated');
    expect(data.customCards).toEqual([{ ...original, ko: '차를 좋아해요.' }]);
    expect(buildVocabSession(['my-phrases'], {}, '2026-10-08', 5, seededRng(1), data)[0].options).toHaveLength(4);
    expect(savePhrase(data, 'I like tea.', '다른 뜻', '코치', now, seededRng(1))).toBe('duplicate');
  });
  it('이전 v2의 보호자에 기본 코치 설정을 채우고 아이 설정과 보상·기록은 유지한다', async () => {
    const { defaultState } = await import('../store/defaults');
    const { normalizeState, importState, exportState } = await import('../store/storage');
    const state = defaultState(); delete state.settings.parent.coach;
    state.data.parent.stars = 30; state.data.parent.streak = 4;
    state.data.parent.coupons = [{ id: 'c', label: '기존 쿠폰', earnedAt: '2026-10-07' }];
    state.settings.parent.missions.find(row => row.type === 'talk')!.enabled = false;
    state.settings.parent.talk!.interests = ['하나', '둘', '셋', '넷', '다섯', '기존 여섯'];
    const original = structuredClone(state), restored = normalizeState(state);
    expect(restored.version).toBe(2); expect(restored.data).toEqual(original.data);
    expect(restored.settings.kid1).toEqual(original.settings.kid1); expect(restored.settings.kid2).toEqual(original.settings.kid2);
    expect(restored.settings.parent.coach).toEqual(normalizeCoachSettings(null));
    expect(restored.settings.parent.talk!.interests).toEqual(original.settings.parent.talk!.interests);
    expect(restored.settings.parent.missions.find(row => row.type === 'talk')!.enabled).toBe(false); expect(state).toEqual(original);
    restored.settings.parent.coach = { level: 'short', repeat: 'high', speed: 0.9, subtitle: 'hidden' };
    restored.data.parent.customCards = [{ id: 'mp-1-abcd', en: 'I like tea.', ko: '', source: '코치', createdAt: '2026-10-08T01:00:00Z' }];
    restored.data.parent.talks = [{ id: 'coach', date: '2026-10-08', seconds: 300, lines: [], englishRatio: 0, mode: 'coach', coachTopic: 'money', coachWrapup: { sentences: [{ en: 'I like tea.', ko: '차를 좋아해요.' }] }, coachCheck: { text: 'I like 차.', corrected: 'I like tea.', noteKo: 'tea로 말해요.' } }];
    expect(importState(exportState(restored))).toEqual(restored);
    const raw = JSON.parse(exportState(restored)); raw.settings.parent.coach.speed = 99; raw.settings.kid1.coach = raw.settings.parent.coach;
    raw.data.parent.talks[0].coachTopic = 'bad'; raw.data.parent.talks[0].coachWrapup.sentences[0].en = 'a'.repeat(121); raw.data.parent.talks[0].coachCheck.noteKo = 1;
    const safe = normalizeState(raw);
    expect(safe.settings.parent.coach!.speed).toBe(0.85); expect(safe.settings.kid1.coach).toBeUndefined();
    expect(safe.data.parent.talks[0].coachTopic).toBeUndefined(); expect(safe.data.parent.talks[0].coachWrapup).toBeUndefined(); expect(safe.data.parent.talks[0].coachCheck).toBeUndefined();
  });
});
