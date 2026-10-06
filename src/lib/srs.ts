import type { SrsCard } from '../types';
import { addDays } from './date';

/**
 * Leitner 5단계 간격 반복.
 * 상자 1~5, 맞히면 다음 상자로 이동하고 상자별 간격(일) 뒤에 다시 나온다.
 * 틀리면 상자 1로 돌아가 다음 날 다시 나온다.
 */
export const BOX_INTERVALS = [1, 3, 7, 14, 30] as const;
export const MAX_BOX = BOX_INTERVALS.length;

export function reviewCard(card: SrsCard | undefined, correct: boolean, today: string): SrsCard {
  const prev = card ?? { box: 0, due: today, seen: 0, lapses: 0 };
  const box = correct ? Math.min(prev.box + 1, MAX_BOX) : 1;
  return {
    box,
    due: addDays(today, BOX_INTERVALS[box - 1]),
    seen: prev.seen + 1,
    lapses: prev.lapses + (correct ? 0 : 1),
  };
}

export function isDue(card: SrsCard | undefined, today: string): boolean {
  return card !== undefined && card.due <= today;
}

/**
 * 오늘 학습할 카드 키를 고른다.
 * 복습 예정 카드(오래 밀린 순)를 먼저, 남은 자리는 처음 보는 카드로 채운다.
 */
export function pickSessionKeys(
  allKeys: readonly string[],
  srs: Record<string, SrsCard>,
  today: string,
  count: number,
): string[] {
  const due = allKeys
    .filter((k) => isDue(srs[k], today))
    .sort((a, b) => (srs[a].due < srs[b].due ? -1 : srs[a].due > srs[b].due ? 1 : srs[a].box - srs[b].box));
  const fresh = allKeys.filter((k) => srs[k] === undefined);
  const picked = [...due, ...fresh].slice(0, count);
  if (picked.length < count) {
    // 모두 학습했고 복습할 것도 없으면 상자 번호가 낮은(덜 익숙한) 카드로 추가 연습
    const rest = allKeys
      .filter((k) => !picked.includes(k))
      .sort((a, b) => (srs[a]?.box ?? 0) - (srs[b]?.box ?? 0));
    picked.push(...rest.slice(0, count - picked.length));
  }
  return picked;
}

export function countMastered(keys: readonly string[], srs: Record<string, SrsCard>): number {
  return keys.filter((k) => (srs[k]?.box ?? 0) >= 4).length;
}
