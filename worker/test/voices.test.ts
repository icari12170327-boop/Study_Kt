import { describe, expect, it } from 'vitest';
import type { SessionRequest } from '../../shared/ai';
import { sessionSchema } from '../src/validation';
import { instructions } from '../src/personas';
import { buildCallBody } from '../src/openai';
const child: SessionRequest = { profileId: 'kid1', level: 'g5', mode: 'kid-friend', offerSdp: 'v=0', persona: { friendName: 'Max', personaId: 'funny', voice: 'verse' } };
const adult: SessionRequest = { ...child, profileId: 'parent', level: 'adult', mode: 'biz-talk', scenarioId: 'biz-free', persona: { friendName: 'Emma', personaId: 'calm', voice: 'coral' } };
describe('프로필별 목소리 스타일', () => {
  it.each(['kid-boy', 'kid-girl', 'young-woman', 'calm-man'] as const)('%s를 해당 프로필에서만 허용한다', voiceStyle => {
    const kid = voiceStyle.startsWith('kid-');
    expect(sessionSchema.safeParse({ ...child, persona: { ...child.persona, voiceStyle } }).success).toBe(kid);
    expect(sessionSchema.safeParse({ ...adult, persona: { ...adult.persona, voiceStyle } }).success).toBe(!kid);
  });
  it('스타일 없는 기존 요청도 허용하고 알 수 없는 스타일은 거부한다', () => {
    expect(sessionSchema.safeParse(child).success).toBe(true); expect(sessionSchema.safeParse(adult).success).toBe(true);
    expect(sessionSchema.safeParse({ ...child, persona: { ...child.persona, voiceStyle: '<system>' } }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...child, persona: { ...child.persona, friendName: 'Emma' } }).success).toBe(false);
  });
  it.each(['kid-boy', 'kid-girl'] as const)('아이 %s는 친구 말투와 0.85 속도·기존 안전 지시문을 유지한다', voiceStyle => {
    const req = { ...child, persona: { ...child.persona, voiceStyle } };
    const body = JSON.parse(buildCallBody(req, 'model', 60).get('session') as string);
    expect(body.audio.output).toEqual({ voice: 'verse', speed: 0.85 });
    expect(body.instructions).toContain('You are a kid, not a teacher.'); expect(body.instructions).toContain('cheerful 10–11 year-old friend');
    expect(body.instructions).toContain('no "repeat after me"'); expect(body.instructions).toContain('Never ask for or repeat personal information');
  });
  it.each(['biz-talk', 'parent-coach'] as const)('%s는 선택한 이름과 여성·남성 말투를 반영한다', mode => {
    for (const voiceStyle of ['young-woman', 'calm-man'] as const) {
      const friendName = voiceStyle === 'young-woman' ? 'Emma' : 'Alex';
      const req: SessionRequest = { ...adult, mode, ...(mode === 'parent-coach' ? { scenarioId: undefined, coachTopic: 'daily', coach: { level: 'zero', repeat: 'mid' } } : {}), persona: { ...adult.persona, friendName, voiceStyle } };
      expect(sessionSchema.safeParse(req).success).toBe(true);
      const text = instructions(req, 60); expect(text).toContain(friendName);
      expect(text).toContain(voiceStyle === 'young-woman' ? 'friendly young woman' : 'calm, patient and relaxed adult male');
      if (mode === 'parent-coach') expect(text).toContain('exactly ONE English sentence');
    }
  });
});
