/** 2022 개정 목차: 출처·판본·명세와의 차이는 docs/T08b-content-review.md 참조. */
export const SCIENCE_UNITS = {
  life: { title: '생활 속 과학', emoji: '🌈', semester: 0 },
  'g3-force': { title: '힘과 우리 생활', emoji: '🛝', semester: 1 },
  'g3-animals': { title: '동물의 생활', emoji: '🐟', semester: 1 },
  'g3-plants': { title: '식물의 생활', emoji: '🌵', semester: 1 },
  'g3-growth': { title: '생물의 한살이', emoji: '🦋', semester: 1 },
  'g3-material': { title: '물체와 물질', emoji: '🧊', semester: 2 },
  'g3-earth': { title: '지구와 바다', emoji: '🏝️', semester: 2 },
  'g3-sound': { title: '소리의 성질', emoji: '🎵', semester: 2 },
  'g3-health': { title: '감염병과 건강한 생활', emoji: '🧼', semester: 2 },
  'g5-rocks': { title: '지층과 화석', emoji: '🦴', semester: 1 },
  'g5-light': { title: '빛의 성질', emoji: '🔦', semester: 1 },
  'g5-solution': { title: '용해와 용액', emoji: '🧂', semester: 1 },
  'g5-body': { title: '우리 몸의 구조와 기능', emoji: '🫁', semester: 1 },
  'g5-mixture': { title: '혼합물의 분리', emoji: '🧺', semester: 2 },
  'g5-heat': { title: '열과 우리 생활', emoji: '🌡️', semester: 2 },
  'g5-weather': { title: '날씨와 우리 생활', emoji: '☁️', semester: 2 },
  'g5-energy': { title: '자원과 에너지', emoji: '☀️', semester: 2 },
  'g5-life': { title: '생활 속 과학 · 초5 보충', emoji: '🧪', semester: 0 },
} as const;
export type ScienceUnit = keyof typeof SCIENCE_UNITS;
export function badgeLabel(id: string): string {
  const [unit, count] = id.split(':');
  const meta = SCIENCE_UNITS[unit as ScienceUnit];
  return meta ? `${meta.emoji} ${meta.title} ${count === 'all' ? '전체' : `${count}장`}` : id;
}
