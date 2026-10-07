import type { ProfileId } from '../types';

/** 날짜와 프로필이 같으면 같은 소품, 다음 날짜에는 다음 소품을 표시한다. */
export function outfitFor(date: string, profileId: ProfileId): string {
  const outfits = ['🎩', '🧢', '👓', '🎀', '🦺', '🧣', '🎧'];
  const [y, m, d] = date.split('-').map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const offset = { kid1: 0, kid2: 2, parent: 4 }[profileId];
  return outfits[((day + offset) % outfits.length + outfits.length) % outfits.length];
}
