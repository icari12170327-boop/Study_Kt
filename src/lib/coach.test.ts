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
  it('400자 뜻도 내 표현에 저장·채우기·정규화·백업 후 카드와 복습 기록을 보존한다', async () => {
    const { defaultState } = await import('../store/defaults');
    const { normalizeState, importState, exportState } = await import('../store/storage');
    const { savePhrase } = await import('./business');
    const state = defaultState(), data = state.data.parent, now = Date.parse('2026-10-08T01:00:00Z');
    expect(savePhrase(data, 'First phrase.', '가'.repeat(400), '코치', now, () => 0)).toBe('saved');
    expect(savePhrase(data, 'Second phrase.', '', '코치', now, () => 0)).toBe('saved');
    const id = data.customCards![1].id;
    data.srs[`vocab:my-phrases:${id}`] = { box: 2, seen: 4, due: '2026-10-10', lapses: 1 };
    const original = structuredClone(state);
    fillCoachMeanings(data, [{ en: 'Second phrase.', ko: '나'.repeat(400) }]);
    expect(data).toEqual({ ...original.data.parent, customCards: [original.data.parent.customCards![0], { ...original.data.parent.customCards![1], ko: '나'.repeat(400) }] });
    expect(normalizeState(state)).toEqual(state); expect(importState(exportState(state))).toEqual(state); expect(state.version).toBe(2);
    const before = structuredClone(data);
    expect(savePhrase(data, 'Invalid phrase.', '다'.repeat(401), '코치', now, () => 0)).toBe('invalid'); expect(data).toEqual(before);
  });
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

describe('T20c 뜻 묶음과 오류 안내', () => {
  it.each([299, 300, 301])('%s자 경계에서 상한을 지키고 모든 내용을 보존한다', async length => {
    const { splitForGloss } = await import('./coach');
    const text = 'a'.repeat(length), chunks = splitForGloss(text);
    expect(chunks.map(row => row.length)).toEqual(length <= 300 ? [length] : [300, 1]);
    expect(chunks.join('')).toBe(text);
  });
  it('문장 경계와 따옴표를 먼저 존중하고 가능한 문장을 같은 묶음에 넣는다', async () => {
    const { splitForGloss } = await import('./coach');
    const first = `${'a'.repeat(179)}.`, second = `${'b'.repeat(119)}!`, third = 'Hello?';
    expect(splitForGloss(`${first} ${second} ${third}`)).toEqual([first, `${second} ${third}`]);
    expect(splitForGloss('Hi. Bye! Okay?', 10)).toEqual(['Hi. Bye!', 'Okay?']);
    expect(splitForGloss('"Hello!" Another sentence.', 20)).toEqual(['"Hello!"', 'Another sentence.']);
  });
  it('문장 없는 긴 글은 공백·글자 경계로 나누고 3묶음 초과는 거부한다', async () => {
    const { splitForGloss } = await import('./coach');
    expect(splitForGloss('a'.repeat(900)).map(row => row.length)).toEqual([300, 300, 300]);
    expect(splitForGloss('a'.repeat(901))).toEqual([]);
    expect(splitForGloss(Array(4).fill(`${'a'.repeat(179)}.`).join(' '))).toEqual([]);
    const words = Array(60).fill('hello world').join(' '), chunks = splitForGloss(words);
    expect(chunks.every(row => row.length <= 300)).toBe(true); expect(chunks.join(' ')).toBe(words);
    const emoji = `${'a'.repeat(299)}😀${'b'.repeat(3)}`;
    expect(splitForGloss(emoji).join('')).toBe(emoji);
    expect(splitForGloss(emoji).every(row => !/[\uD800-\uDBFF]$|^[\uDC00-\uDFFF]/.test(row))).toBe(true);
  });
  it('빈 입력과 잘못된 상한을 유한하게 처리한다', async () => {
    const { splitForGloss } = await import('./coach');
    expect(splitForGloss(' \n ')).toEqual([]);
    for (const max of [0, -1, 0.5, Infinity, NaN]) expect(() => splitForGloss('text', max)).toThrow(RangeError);
  });
  it('일시 실패는 다시 누르기, 인증 오류만 Worker 설정 안내를 표시한다', async () => {
    const { coachErrorMessage } = await import('./coach'), { AiError } = await import('./ai');
    for (const kind of ['server', 'network'] as const) expect(coachErrorMessage(new AiError(kind))).toBe('뜻을 받지 못했어요. 한 번 더 눌러 주세요.');
    expect(coachErrorMessage(new Error('private text'))).toBe('뜻을 받지 못했어요. 한 번 더 눌러 주세요.');
    expect(coachErrorMessage(new AiError('unauthorized'))).toContain('Worker 설정을 확인');
    for (const action of ['gloss', 'wrapup', 'check', 'connection'] as const) {
      expect(coachErrorMessage(new AiError('server'), action)).toContain('한 번 더 눌러 주세요.');
      expect(coachErrorMessage(new AiError('server'), action)).not.toContain('Worker');
      expect(coachErrorMessage(new AiError('unauthorized'), action)).toContain('Worker');
    }
    for (const kind of ['limit', 'busy', 'unsafe', 'mic-denied'] as const) expect(coachErrorMessage(new AiError(kind))).toBe(new AiError(kind).message);
  });
});
