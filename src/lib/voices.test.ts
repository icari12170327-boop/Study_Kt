import { describe, expect, it } from 'vitest';
import { CHILD_VOICES, PARENT_VOICES, parentPersona } from './voices';
import { defaultTalkSettings, talkRequest } from './talk';
import { businessRequest } from './business';
import { coachRequest, normalizeCoachSettings } from './coach';
import { defaultState } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
describe('목소리 선택과 저장 호환', () => {
  it.each(['kid1', 'kid2'] as const)('%s 예전 기본값만 한 번 옮기며 기록과 version 2를 보존한다', id => {
    const state = defaultState(); state.settings[id].talk!.voice = id === 'kid1' ? 'marin' : 'coral'; delete state.settings[id].talk!.voiceStyle;
    const original = structuredClone(state); const next = normalizeState(state);
    const preset = CHILD_VOICES[id === 'kid1' ? 0 : 1];
    expect(next.settings[id].talk).toMatchObject({ voice: preset.voice, voiceStyle: preset.voiceStyle });
    expect(next.data).toEqual(original.data); expect(state).toEqual(original); expect(next.version).toBe(2);
    expect(normalizeState(next)).toEqual(next);
  });
  it.each(['kid1', 'kid2', 'parent'] as const)('%s 직접 고른 목소리와 스타일은 백업 후에도 보존한다', id => {
    const state = defaultState(); state.settings[id].talk!.voice = 'ash';
    const next = normalizeState(state); expect(next.settings[id].talk!.voice).toBe('ash');
    expect(importState(exportState(next)).settings[id].talk).toEqual(next.settings[id].talk);
    if (id !== 'parent') { delete state.settings[id].talk!.voiceStyle; expect(normalizeState(state).settings[id].talk!.voice).toBe('ash'); }
  });
  it('스타일이 명시된 예전 기본 목소리는 덮어쓰지 않는다', () => {
    const state = defaultState(); state.settings.kid1.talk!.voice = 'marin'; state.settings.kid2.talk!.voice = 'coral';
    expect(normalizeState(state).settings.kid1.talk!.voice).toBe('marin'); expect(normalizeState(state).settings.kid2.talk!.voice).toBe('coral');
  });
  it('아이 선택은 목소리와 스타일을 함께 보내고 원래 대화 설정을 유지한다', () => {
    for (const preset of CHILD_VOICES) {
      const settings = { ...defaultTalkSettings('g3', 'kid2'), voice: preset.voice, voiceStyle: preset.voiceStyle, pushToTalk: true, subtitleHidePercent: 70 };
      expect(talkRequest('kid2', 'g3', settings, '기억', '동물')).toMatchObject({ persona: { voice: preset.voice, voiceStyle: preset.voiceStyle }, pushToTalk: true, topic: '동물', memory: '기억' });
    }
  });
  it('보호자 두 모드는 선택한 목소리·스타일·Emma/Alex를 함께 반영한다', () => {
    for (const preset of PARENT_VOICES) {
      const persona = parentPersona(preset);
      expect(persona).toMatchObject({ voice: preset.voice, voiceStyle: preset.voiceStyle, friendName: preset.friendName });
      expect(businessRequest('biz-free', '', '', 0.9, preset).persona).toEqual(persona);
      expect(coachRequest('daily', normalizeCoachSettings(undefined), '', [], preset).persona).toEqual(persona);
    }
    expect(parentPersona().friendName).toBe('Emma');
    const old = defaultState(); old.settings.parent.talk!.voice = 'cedar'; delete old.settings.parent.talk!.voiceStyle;
    expect(normalizeState(old).settings.parent.talk).toMatchObject({ voice: 'cedar', voiceStyle: 'calm-man', friendName: 'Alex' });
  });
});
