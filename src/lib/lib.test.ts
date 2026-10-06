import { describe, expect, it } from 'vitest';
import { addDays, lastNDays } from './date';
import { pickSessionKeys, reviewCard } from './srs';
import { applyProgress, currentStreak, isDayComplete } from './progress';
import { scoreSpeech } from './similarity';
import { defaultSettings, emptyProfileData } from '../store/defaults';
import { normalizeState } from '../store/storage';

describe('날짜', () => {
  it('월말을 넘어 날짜를 더한다', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('최근 n일', () => {
    expect(lastNDays(3, '2026-10-06')).toEqual(['2026-10-04', '2026-10-05', '2026-10-06']);
  });
});

describe('간격 반복 (Leitner)', () => {
  const today = '2026-10-06';
  it('맞히면 상자가 올라가고 간격이 늘어난다', () => {
    let c = reviewCard(undefined, true, today);
    expect(c).toMatchObject({ box: 1, due: '2026-10-07', seen: 1 });
    c = reviewCard(c, true, today);
    expect(c).toMatchObject({ box: 2, due: '2026-10-09' });
  });
  it('틀리면 상자 1로 돌아간다', () => {
    const c = reviewCard({ box: 4, due: today, seen: 5, lapses: 0 }, false, today);
    expect(c).toMatchObject({ box: 1, due: '2026-10-07', lapses: 1 });
  });
  it('복습 예정 카드를 먼저, 그다음 새 카드를 고른다', () => {
    const srs = {
      a: { box: 2, due: '2026-10-01', seen: 2, lapses: 0 },
      b: { box: 3, due: '2026-10-20', seen: 3, lapses: 0 },
    };
    expect(pickSessionKeys(['a', 'b', 'c', 'd'], srs, today, 3)).toEqual(['a', 'c', 'd']);
  });
  it('모두 학습했으면 덜 익숙한 카드로 채운다', () => {
    const srs = {
      a: { box: 5, due: '2026-11-01', seen: 9, lapses: 0 },
      b: { box: 2, due: '2026-10-20', seen: 3, lapses: 0 },
    };
    expect(pickSessionKeys(['a', 'b'], srs, today, 1)).toEqual(['b']);
  });
});

describe('미션 진행과 보상', () => {
  const settings = {
    ...defaultSettings('g3'),
    missions: [
      { type: 'math' as const, enabled: true, target: 2 },
      { type: 'vocab' as const, enabled: true, target: 1 },
      { type: 'speaking' as const, enabled: false, target: 5 },
      { type: 'reading' as const, enabled: false, target: 1 },
    ],
  };

  it('모든 미션을 채우면 한 번만 쿠폰을 주고 연속 학습일을 올린다', () => {
    const data = emptyProfileData();
    const day = '2026-10-06';
    expect(applyProgress(data, settings, day, { type: 'math', correct: 1, total: 1 }).justCompleted).toBe(false);
    expect(applyProgress(data, settings, day, { type: 'math', correct: 0, total: 1 }).justCompleted).toBe(false);
    expect(applyProgress(data, settings, day, { type: 'vocab', correct: 1, total: 1 }).justCompleted).toBe(true);
    expect(applyProgress(data, settings, day, { type: 'vocab', correct: 1, total: 1 }).justCompleted).toBe(false);
    expect(data.coupons).toHaveLength(1);
    expect(data.stars).toBe(3);
    expect(data.streak).toBe(1);
    expect(isDayComplete(data.days[day], settings)).toBe(true);
  });

  it('연속으로 완료하면 연속 학습일이 늘고, 하루 빠지면 다시 1부터', () => {
    const data = emptyProfileData();
    const finish = (d: string) => {
      applyProgress(data, settings, d, { type: 'math', amount: 2 });
      applyProgress(data, settings, d, { type: 'vocab' });
    };
    finish('2026-10-01');
    finish('2026-10-02');
    expect(data.streak).toBe(2);
    expect(currentStreak(data, '2026-10-03')).toBe(2);
    expect(currentStreak(data, '2026-10-04')).toBe(0);
    finish('2026-10-04');
    expect(data.streak).toBe(1);
  });

  it('연산 단원별 통계를 기록한다', () => {
    const data = emptyProfileData();
    applyProgress(data, settings, '2026-10-06', { type: 'math', correct: 1, total: 1, skill: 'g3-add3' });
    applyProgress(data, settings, '2026-10-06', { type: 'math', correct: 0, total: 1, skill: 'g3-add3' });
    expect(data.days['2026-10-06'].mathBySkill['g3-add3']).toEqual({ correct: 1, total: 2 });
  });
});

describe('말하기 채점', () => {
  it('완벽히 말하면 1점', () => {
    expect(scoreSpeech("I'm fine, thank you.", 'I am fine thank you').score).toBe(1);
  });
  it('빠진 단어를 표시한다', () => {
    const r = scoreSpeech('Go straight and turn left.', 'go straight turn left');
    expect(r.score).toBeCloseTo(0.8);
    expect(r.matched.find((w) => w.word === 'and')?.ok).toBe(false);
    expect(r.matched.find((w) => w.word === 'left.')?.ok).toBe(true);
  });
  it("축약형 n't 를 펼쳐서 비교한다", () => {
    expect(scoreSpeech("I don't like snakes.", 'I do not like snakes').score).toBe(1);
  });
});

describe('저장 데이터 복원', () => {
  it('일부 필드가 없어도 기본값으로 채운다', () => {
    const s = normalizeState({ version: 1, profiles: [{ id: 'kid1', name: '민준' }], data: { kid1: { stars: 5 } } });
    expect(s.profiles.find((p) => p.id === 'kid1')?.name).toBe('민준');
    expect(s.profiles.find((p) => p.id === 'kid1')?.avatar).toBe('🦁');
    expect(s.data.kid1.stars).toBe(5);
    expect(s.data.kid1.coupons).toEqual([]);
    expect(s.settings.kid2.missions.length).toBe(4);
  });
  it('알 수 없는 버전은 기본 상태', () => {
    expect(normalizeState({ version: 99 }).profiles).toHaveLength(3);
  });
});
