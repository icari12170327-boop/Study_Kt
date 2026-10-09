import type { VoiceStyle } from '../../shared/ai';
export const TALK_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'] as const;
export const CHILD_VOICES = [
  { voice: 'verse', voiceStyle: 'kid-boy', label: '👦 또래 남자아이' },
  { voice: 'shimmer', voiceStyle: 'kid-girl', label: '👧 또래 여자아이' },
] as const;
export const PARENT_VOICES = [
  { voice: 'coral', voiceStyle: 'young-woman', friendName: 'Emma', label: '👩 젊고 친절한 여성' },
  { voice: 'cedar', voiceStyle: 'calm-man', friendName: 'Alex', label: '🧑 차분한 남성' },
] as const;
export function parentPersona(settings?: { voice: string; voiceStyle?: VoiceStyle }) {
  const preset = PARENT_VOICES[settings?.voiceStyle === 'calm-man' || (!settings?.voiceStyle && settings?.voice === 'cedar') ? 1 : 0];
  return { friendName: preset.friendName, personaId: 'calm' as const, voice: settings?.voice ?? preset.voice, voiceStyle: preset.voiceStyle };
}
