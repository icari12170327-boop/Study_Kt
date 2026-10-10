import type { Difficulty } from './types';
import type { PatternAttribute, PatternTile, PatternView } from './pattern';

const attributes: PatternAttribute[] = ['shape', 'color', 'count', 'dir'];
const same = (a: PatternTile, b: PatternTile) => attributes.every(key => a[key] === b[key]);
const chance = (options: PatternTile[], answer: PatternTile) => options.some(tile => same(tile, answer)) ? 1 / options.length : 0;

/** 동점은 무작위로 고른 기대 적중률로 계산한다. 정답 위치는 점수에 사용하지 않는다. */
export function patternTricks(view: PatternView, answer: PatternTile) {
  const shown = view.cells.filter((tile): tile is PatternTile => tile !== null);
  const pastRemoved = view.options.filter(tile => !shown.some(previous => same(previous, tile)));
  const familiar = view.options.filter(tile => attributes.every(key => shown.some(previous => previous[key] === tile[key])));
  const combined = familiar.filter(tile => !shown.some(previous => same(previous, tile)));
  const similarity = (options: PatternTile[], source = options, least = false) => {
    const scores = options.map(tile => source.reduce((sum, other) => sum + attributes.filter(key => tile[key] === other[key]).length, 0));
    const extreme = least ? Math.min(...scores) : Math.max(...scores);
    return options.filter((_, i) => scores[i] === extreme);
  };
  const frequency = (least: boolean) => {
    const scores = view.options.map(tile => attributes.reduce((sum, key) => sum + shown.filter(previous => previous[key] === tile[key]).length, 0));
    const extreme = least ? Math.min(...scores) : Math.max(...scores);
    return chance(view.options.filter((_, i) => scores[i] === extreme), answer);
  };
  const center = similarity(view.options), remainingCenter = similarity(pastRemoved);
  return {
    center: chance(center, answer), centerFirst: Number(!!center[0] && same(center[0], answer)),
    pastCenter: chance(remainingCenter, answer), pastCenterFirst: Number(!!remainingCenter[0] && same(remainingCenter[0], answer)),
    originalPastCenter: chance(similarity(pastRemoved, view.options), answer),
    inverse: chance(similarity(view.options, view.options, true), answer),
    pastInverse: chance(similarity(pastRemoved, pastRemoved, true), answer),
    past: chance(pastRemoved, answer), familiar: chance(familiar, answer), combined: chance(combined, answer),
    leastFrequent: frequency(true), mostFrequent: frequency(false),
  };
}

/** 변하는 각 속성에 정답 값을 공유하는 오답이 있어야 하고, 두 규칙이 있는 판은 둘 다 확인해야 한다. */
export function requiresBothAttributes(view: PatternView, answer: PatternTile): boolean {
  const changed = attributes.filter(key => new Set(view.options.map(tile => tile[key])).size > 1);
  return changed.length === 2 && changed.every(key => view.options.filter(tile => tile[key] === answer[key]).length >= 2)
    && (Object.values(view.rules).filter(rule => rule.kind !== 'fixed').length < 2 || changed.every(key => !!view.rules[key] && view.rules[key]?.kind !== 'fixed'));
}

/** 판별 상한과 단계 평균 상한을 구분해 격자 위치를 살리면서 평균 검사는 유지한다. */
export function patternTrickLimits(level: Difficulty, scope: 'board' | 'average' = 'average') {
  const removed = level === 2 ? 0.5 : 0.4;
  const frequency = scope === 'board' && level >= 4 ? 0.5 : removed;
  return { center: 0.35, centerFirst: 0.35, pastCenter: removed, pastCenterFirst: removed, originalPastCenter: removed,
    inverse: 0.4, pastInverse: level >= 2 && level <= 4 ? 0.5 : 0.4,
    past: removed, familiar: removed, combined: removed, leastFrequent: frequency, mostFrequent: frequency };
}
