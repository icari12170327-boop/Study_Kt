import { describe, expect, it } from 'vitest';
import { defaultState } from '../../store/defaults';
import { exportState, importState, normalizeState } from '../../store/storage';
import { emptyDay } from '../../lib/progress';
import { SMALL_ISLAND as story } from './smallIsland';
import { initialStoryProgress, normalizeStories, normalizeStorySettings, openNext, recordAnswer, startStory } from './progress';

describe('이야기 저장과 보상 분리', () => {
  it('이전 v2에 기본값만 추가하며 미션·기존 기록을 바꾸지 않는다', () => {
    const old = defaultState();
    delete old.settings.kid1.stories; delete old.settings.kid2.stories;
    delete old.data.kid1.stories; delete old.data.kid2.stories;
    delete old.settings.parent.stories; delete old.data.parent.stories;
    const migrated = normalizeState(old);
    expect(migrated.version).toBe(2);
    expect(migrated.settings.parent.stories).toEqual({ enabled: false });
    expect(migrated.data.parent.stories).toEqual({});
    for (const id of ['kid1', 'kid2'] as const) {
      expect(migrated.settings[id].stories).toEqual({ enabled: true });
      expect(migrated.data[id].stories).toEqual({});
      expect(migrated.settings[id].missions).toEqual(old.settings[id].missions);
      const data = structuredClone(migrated.data[id]); delete data.stories;
      expect(data).toEqual(old.data[id]);
    }
    migrated.settings.kid2.stories = { enabled: false };
    expect(normalizeState(migrated).settings.kid2.stories).toEqual({ enabled: false });
  });
  it('잘못된 형식과 화·문제 범위를 정리한다', () => {
    for (const bad of [null, [], 'bad', 1]) expect(normalizeStories(bad)).toEqual({});
    const result = normalizeStories({ unknown: { unlocked: 10 }, [story.id]: {
      unlocked: 99, finished: 100, lastUnlockDate: '2026-02-30',
      answers: { '1:0': [false, true, 'true', null], '0:0': [true], '11:0': [true], '1:3': [true], '10:2': [true], '1:1': 'bad' },
    } });
    expect(result).toEqual({ [story.id]: { unlocked: 10, finished: 10, answers: { '1:0': [false, true], '10:2': [true] } } });
    expect(normalizeStories({ [story.id]: { unlocked: -2, finished: -3 } })[story.id]).toEqual(initialStoryProgress());
    expect(normalizeStories({ [story.id]: { unlocked: 1, finished: 4, answers: { '2:0': [true] } } })[story.id]).toMatchObject({ unlocked: 1, finished: 1, answers: {} });
    expect(normalizeStories({ [story.id]: { unlocked: Infinity, finished: NaN } })[story.id]).toEqual(initialStoryProgress());
    expect(normalizeStorySettings({ enabled: 'false' })).toEqual({ enabled: true });
  });
  it('진도·재도전 이력·꺼 둔 설정·미리 열기가 백업 왕복 후 유지된다', () => {
    const state = defaultState();
    state.settings.kid1.stories = { enabled: false };
    let progress = startStory(initialStoryProgress(), '2026-10-08');
    progress = recordAnswer(progress, story, 1, 0, false, '2026-10-08');
    for (let i = 0; i < 3; i++) progress = recordAnswer(progress, story, 1, i, true, '2026-10-08');
    progress = openNext(progress, '2026-10-08', 10, true);
    state.data.kid1.stories = { [story.id]: progress };
    const normalized = normalizeState(state), restored = importState(exportState(state));
    for (const saved of [normalized, restored]) {
      expect(saved.version).toBe(2);
      expect(saved.data.kid1.stories).toEqual(state.data.kid1.stories);
      expect(saved.settings.kid1.stories).toEqual({ enabled: false });
      expect(saved.settings.kid1.missions).toEqual(state.settings.kid1.missions);
    }
  });
  it('모든 화의 오답·재도전·다시 읽기·미리 열기가 학습 기록과 보상을 바꾸지 않는다', () => {
    const state = defaultState(), today = '2026-10-08';
    const data = state.data.kid2;
    data.stars = 15; data.streak = 7; data.lastCompleted = today;
    data.coupons = [{ id: 'keep', label: '쿠폰', earnedAt: today }];
    data.days[today] = { ...emptyDay(today), completed: true, progress: { math: 20, science: 5 } };
    data.days[today].mathAttempts = [{ skill: 'g3-add', correct: true, activeMs: 4000, guessed: false }];
    const baseline = structuredClone(state);
    let progress = startStory(initialStoryProgress(), today);
    for (let n = 1; n <= 10; n++) {
      if (n > 1) progress = openNext(progress, today, 10, true);
      for (const correct of [false, true, false, true]) for (let q = 0; q < 3; q++) progress = recordAnswer(progress, story, n, q, correct, today);
    }
    data.stories = { [story.id]: progress };
    expect(data.stories[story.id].finished).toBe(10);
    const changed = structuredClone(state);
    delete changed.data.kid2.stories; delete baseline.data.kid2.stories;
    expect(changed).toEqual(baseline);
  });
});
