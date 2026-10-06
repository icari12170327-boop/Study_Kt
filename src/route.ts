import type { ProfileId } from './types';

export type Route =
  | { name: 'profiles' }
  | { name: 'home'; profileId: ProfileId }
  | { name: 'math'; profileId: ProfileId }
  | { name: 'vocab'; profileId: ProfileId }
  | { name: 'speaking'; profileId: ProfileId }
  | { name: 'reading'; profileId: ProfileId }
  | { name: 'rewards'; profileId: ProfileId }
  | { name: 'parent' };

export type Go = (route: Route) => void;

export const MISSION_META = {
  math: { icon: '🔢', title: '연산', unit: '문제', color: '#f97316' },
  vocab: { icon: '🔤', title: '영어 단어', unit: '단어', color: '#10b981' },
  speaking: { icon: '🗣️', title: '따라 말하기', unit: '문장', color: '#6366f1' },
  reading: { icon: '📚', title: '독서노트', unit: '회', color: '#ec4899' },
} as const;
