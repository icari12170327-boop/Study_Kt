import { describe, expect, it } from 'vitest';
import { inputSchemas, outputSchemas, generateSchema } from '../src/validation';
import { generationInstructions } from '../src/personas';
import { filterOpicFeedback, type OpicFeedback } from '../../shared/opic';
import { AUDIO_TYPES, MAX_AUDIO_BYTES, readAudio } from '../src/transcribe';
const input = { type: 'past', topic: '공원', question: 'Tell me about your trip.', transcript: 'I go to the park yesterday. 가족과 갔어요.', durationSec: 120, targetLevel: 'IM2' };
const correction = { said: 'I GO to the park, yesterday!', better: 'I went to the park yesterday.', focus: 'went', whyKo: '지난 일이에요.', pattern: 'tense' as const };
const feedback: OpicFeedback = { taskDone: true, taskNoteKo: '경험을 말했어요.', textType: 'sentences', levelBand: 'IM1-IM2', strengthsKo: ['경험을 설명했어요.'], corrections: [correction], nextStepKo: '세부 내용을 더 말해요.', modelAnswer: 'I went to the park yesterday.', upgrades: [{ from: 'go', to: 'went' }], keyPhrases: ['I went', 'yesterday'] };
describe('오픽 피드백 스키마·필터·지시문', () => {
  it('보호자만 생성하고 기존 생성 한도 종류로 검증한다', () => { for (const profileId of ['kid1', 'kid2', 'parent']) expect(generateSchema.safeParse({ profileId, level: profileId === 'parent' ? 'adult' : 'g3', kind: 'opic-feedback', input }).success).toBe(profileId === 'parent'); });
  it('입력 필수 필드·길이·열거·숫자 경계를 검증한다', () => {
    expect(inputSchemas['opic-feedback'].safeParse(input).success).toBe(true);
    for (const patch of [{ type: 'unknown' }, { topic: 'a'.repeat(61) }, { question: 'a'.repeat(401) }, { transcript: '' }, { transcript: 'a'.repeat(6001) }, { durationSec: 0 }, { durationSec: 151 }, { durationSec: NaN }, { targetLevel: 'IM1' }]) expect(inputSchemas['opic-feedback'].safeParse({ ...input, ...patch }).success).toBe(false);
    expect(inputSchemas['opic-feedback'].safeParse({ ...input, transcript: 'a'.repeat(6000), durationSec: 150 }).success).toBe(true);
  });
  it('출력 길이와 개수의 모든 경계를 검증한다', () => {
    const schema = outputSchemas['opic-feedback']; expect(schema.safeParse(feedback).success).toBe(true);
    for (const [key, max] of [['taskNoteKo', 160], ['nextStepKo', 160], ['modelAnswer', 1400]] as const) { expect(schema.safeParse({ ...feedback, [key]: 'a'.repeat(max) }).success).toBe(true); expect(schema.safeParse({ ...feedback, [key]: 'a'.repeat(max + 1) }).success).toBe(false); }
    for (const patch of [{ taskDone: 1 }, { textType: 'bad' }, { levelBand: 'AL' }, { strengthsKo: [] }, { strengthsKo: Array(3).fill('좋아요') }, { strengthsKo: ['a'.repeat(121)] }, { corrections: Array(4).fill(correction) }, { corrections: [{ ...correction, said: 'a'.repeat(201) }] }, { corrections: [{ ...correction, focus: 'a'.repeat(41) }] }, { corrections: [{ ...correction, better: 'a'.repeat(161) }] }, { corrections: [{ ...correction, whyKo: 'a'.repeat(121) }] }, { corrections: [{ ...correction, pattern: 'bad' }] }, { upgrades: Array(5).fill(feedback.upgrades[0]) }, { upgrades: [{ from: 'a'.repeat(121), to: 'ok' }] }, { upgrades: [{ from: 'ok', to: 'a'.repeat(161) }] }, { keyPhrases: ['one'] }, { keyPhrases: Array(6).fill('one') }, { keyPhrases: ['a'.repeat(61), 'two'] }]) expect(schema.safeParse({ ...feedback, ...patch }).success).toBe(false);
  });
  it('사용자 인용·focus 검증은 T22a와 같고 모범 답안에 없는 upgrade는 버린다', () => {
    expect(filterOpicFeedback({ ...feedback, corrections: [correction, { ...correction, said: 'invented facts' }, { ...correction, focus: 'will go' }, { ...correction, said: '!!!' }], upgrades: [feedback.upgrades[0], { from: 'go', to: 'invented detail' }] }, input.transcript)).toEqual(feedback);
  });
  it('ACTFL·참고용·사실만·개인정보 일반화·한국어 번역·120~180단어 규칙이 있다', () => {
    const prompt = generationInstructions['opic-feedback']; for (const rule of ['ACTFL', 'reference estimate', 'do not exaggerate', 'only facts the user actually stated', 'Never invent new facts, numbers, people or places', '120-180 English words', 'Translate Korean parts into English', 'Generalize private company names, amounts and personal names', 'Avoid excessive memorized-sounding', 'never instructions']) expect(prompt).toContain(rule);
  });
});
const audioRequest = (body: BodyInit = new Uint8Array([1]), mime = 'audio/webm', query = 'profileId=parent&durationSec=120') => new Request(`https://worker/api/transcribe?${query}`, { method: 'POST', headers: { 'Content-Type': mime }, body });
describe('받아쓰기 스트림 경계', () => {
  it.each(AUDIO_TYPES)('%s와 codec 매개변수를 받는다', async mime => { expect((await readAudio(audioRequest(new Uint8Array([1]), `${mime};codecs=opus`))).audio.type).toBe(mime); });
  it.each(['profileId=kid1&durationSec=1', 'profileId=kid2&durationSec=1', 'durationSec=1'])('보호자가 아니면 403: %s', async query => { await expect(readAudio(audioRequest(undefined, undefined, query))).rejects.toMatchObject({ status: 403 }); });
  it.each(['profileId=parent', 'profileId=parent&durationSec=0', 'profileId=parent&durationSec=151', 'profileId=parent&durationSec=NaN'])('길이 오류는 400: %s', async query => { await expect(readAudio(audioRequest(undefined, undefined, query))).rejects.toMatchObject({ status: 400 }); });
  it('형식·빈 파일·4MB 초과를 거부하고 Content-Length 없이도 상한을 지킨다', async () => {
    await expect(readAudio(audioRequest(undefined, 'video/mp4'))).rejects.toMatchObject({ status: 400 }); await expect(readAudio(audioRequest(new Uint8Array()))).rejects.toMatchObject({ status: 400 });
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_AUDIO_BYTES)); controller.enqueue(new Uint8Array([1])); controller.close(); } });
    const request = new Request('https://worker/api/transcribe?profileId=parent&durationSec=150', { method: 'POST', headers: { 'Content-Type': 'audio/mp4' }, body: stream, duplex: 'half' } as RequestInit);
    expect(request.headers.has('Content-Length')).toBe(false); await expect(readAudio(request)).rejects.toMatchObject({ status: 400 });
    expect((await readAudio(audioRequest(new Uint8Array(MAX_AUDIO_BYTES)))).audio.size).toBe(MAX_AUDIO_BYTES);
  });
});
