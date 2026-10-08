import { describe, expect, it } from 'vitest';
import { toDateKey } from '../../lib/date';
import { SMALL_ISLAND as story } from './smallIsland';
import { answerKey, answerRate, canOpenNext, initialStoryProgress, openNext, recordAnswer, startStory, storyCardState } from './progress';
import type { StoryProgress } from './types';

function finish(progress: StoryProgress, n: number, date: string): StoryProgress {
  return story.episodes[n - 1].questions.reduce((p, _q, i) => recordAnswer(p, story, n, i, true, date), progress);
}
describe('하루 한 화 잠금', () => {
  it('처음에는 1화만 열리고 세 문제를 모두 맞혀야 다음 화를 기다린다', () => {
    const initial = initialStoryProgress(), started = startStory(initial, '2026-10-08');
    expect(initial.lastUnlockDate).toBeUndefined(); expect(storyCardState(undefined, '2026-10-08')).toBe('new');
    expect(started.unlocked).toBe(1);
    const wrong = recordAnswer(started, story, 1, 0, false, '2026-10-08');
    expect(storyCardState(wrong, '2026-10-08')).toBe('reading');
    expect(canOpenNext(wrong, '2026-10-09')).toBe(false);
    expect(finish(wrong, 1, '2026-10-08').finished).toBe(1);
    expect(storyCardState(finish(wrong, 1, '2026-10-08'), '2026-10-08')).toBe('locked-until-tomorrow');
  });
  it.each([
    ['2026-10-08', '2026-10-09'], ['2026-10-31', '2026-11-01'],
    ['2026-12-31', '2027-01-01'], ['2028-02-28', '2028-02-29'], ['2028-02-29', '2028-03-01'],
  ])('%s에 완료하면 %s에 한 화만 열린다', (today, tomorrow) => {
    const completed = finish(initialStoryProgress(), 1, today);
    expect(canOpenNext(completed, today)).toBe(false);
    expect(openNext(completed, today)).toBe(completed);
    expect(storyCardState(completed, tomorrow)).toBe('new');
    const opened = openNext(completed, tomorrow);
    expect(opened).toMatchObject({ unlocked: 2, finished: 1, lastUnlockDate: tomorrow });
    expect(openNext(opened, tomorrow)).toBe(opened);
    const finished = finish(opened, 2, tomorrow);
    expect(openNext(finished, tomorrow)).toBe(finished);
  });
  it('기기 시계의 23:59:59와 00:00:00을 날짜 경계로 판정한다', () => {
    const before = toDateKey(new Date(2026, 9, 8, 23, 59, 59));
    const after = toDateKey(new Date(2026, 9, 9, 0, 0, 0));
    const progress = finish(initialStoryProgress(), 1, before);
    expect(canOpenNext(progress, before)).toBe(false); expect(canOpenNext(progress, after)).toBe(true);
  });
  it('며칠 쉬어도 안 읽은 화를 건너뛰지 않고 첫 완주일의 다음 날을 기다린다', () => {
    const started = startStory(initialStoryProgress(), '2026-10-08');
    const late = finish(started, 1, '2026-10-12');
    expect(canOpenNext(late, '2026-10-12')).toBe(false);
    expect(openNext(late, '2026-11-15').unlocked).toBe(2);
    expect(canOpenNext(late, '2026-10-07')).toBe(false);
  });
  it('다시 읽다 틀려도 완료는 사라지지 않고 대기일도 늘지 않는다', () => {
    const completed = finish(initialStoryProgress(), 1, '2026-10-08');
    const reread = recordAnswer(completed, story, 1, 0, false, '2026-10-09');
    expect(reread.finished).toBe(1); expect(reread.lastUnlockDate).toBe('2026-10-08');
    expect(reread.answers[answerKey(1, 0)]).toEqual([true, false]);
    expect(answerRate(reread.answers[answerKey(1, 0)])).toEqual({ correct: 1, total: 2, percent: 50 });
    expect(canOpenNext(reread, '2026-10-09')).toBe(true);
    expect(startStory(reread, '2026-10-09')).toBe(reread);
  });
  it('보호자는 미완료여도 다음 화를 열지만 같은 날 일반 해제는 늘지 않는다', () => {
    const preview = openNext(initialStoryProgress(), '2026-10-08', 10, true);
    expect(preview.unlocked).toBe(2);
    expect(openNext(preview, '2026-10-08')).toBe(preview);
    const secondFirst = finish(preview, 2, '2026-10-08');
    expect(secondFirst.finished).toBe(0);
    const both = finish(secondFirst, 1, '2026-10-08');
    expect(both.finished).toBe(2); expect(canOpenNext(both, '2026-10-08')).toBe(false);
  });
  it('10일에 10화가 끝나고 그 이상은 열리지 않는다', () => {
    let progress = initialStoryProgress();
    for (let n = 1; n <= 10; n++) {
      const today = `2026-10-${String(n).padStart(2, '0')}`;
      progress = openNext(progress, today);
      expect(progress.unlocked).toBe(n);
      progress = finish(progress, n, today);
      expect(canOpenNext(progress, today)).toBe(false);
    }
    expect(storyCardState(progress, '2026-10-11')).toBe('finished');
    expect(openNext(progress, '2026-10-11', 10, true)).toBe(progress);
    expect(story.episodes[9].teaser).toContain('다음 이야기는 보호자와 함께 정해요');
  });
  it('범위 밖 화·문제와 잘못된 날짜는 기록하지 않는다', () => {
    const progress = initialStoryProgress();
    for (const [n, q] of [[0, 0], [2, 0], [11, 0], [1, -1], [1, 3], [1, 0.5]]) expect(recordAnswer(progress, story, n, q, true, '2026-10-08')).toBe(progress);
    expect(recordAnswer(progress, story, 1, 0, true, 'invalid')).toBe(progress);
    expect(openNext(progress, '2026-02-30', 10, true)).toBe(progress);
    expect(answerRate([])).toEqual({ correct: 0, total: 0, percent: 0 });
  });
});
