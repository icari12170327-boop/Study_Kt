import type { DayLog, MissionType, ProfileData, ProfileSettings } from '../types';
import { addDays } from './date';
import { uid } from './random';

export function emptyDay(date: string): DayLog {
  return { date, progress: {}, correct: 0, total: 0, completed: false, mathBySkill: {}, mathAttempts: [] };
}

/** draft를 직접 수정한다. */
export function ensureDay(data: ProfileData, date: string): DayLog {
  if (!data.days[date]) data.days[date] = emptyDay(date);
  return data.days[date];
}

export function enabledMissions(settings: ProfileSettings) {
  return settings.missions.filter((m) => m.enabled && m.target > 0);
}

export function isDayComplete(day: DayLog | undefined, settings: ProfileSettings): boolean {
  const missions = enabledMissions(settings);
  if (!day || missions.length === 0) return false;
  return missions.every((m) => (day.progress[m.type] ?? 0) >= m.target);
}

/** 0~1 */
export function dayRatio(day: DayLog | undefined, settings: ProfileSettings): number {
  const missions = enabledMissions(settings);
  if (missions.length === 0) return 0;
  const sum = missions.reduce((s, m) => s + Math.min(1, (day?.progress[m.type] ?? 0) / m.target), 0);
  return sum / missions.length;
}

/** 표시용 연속 학습일: 마지막 완료일이 오늘이나 어제가 아니면 끊긴 것으로 본다. */
export function currentStreak(data: ProfileData, today: string): number {
  if (!data.lastCompleted) return 0;
  if (data.lastCompleted === today || data.lastCompleted === addDays(today, -1)) return data.streak;
  return 0;
}

export interface ProgressEvent {
  type: MissionType;
  amount?: number;
  correct?: number;
  total?: number;
  /** 연산 단원별 통계 */
  skill?: string;
}

export interface ProgressResult {
  /** 이번 기록으로 하루 미션을 처음 완료했는지 */
  justCompleted: boolean;
}

/**
 * 학습 기록을 반영하고, 하루 미션을 처음 완료하면 연속 학습일을 올리고 쿠폰을 지급한다.
 * data를 직접 수정한다.
 */
export function applyProgress(
  data: ProfileData,
  settings: ProfileSettings,
  today: string,
  ev: ProgressEvent,
): ProgressResult {
  const day = ensureDay(data, today);
  day.progress[ev.type] = (day.progress[ev.type] ?? 0) + (ev.amount ?? 1);
  const correct = ev.correct ?? 0;
  const total = ev.total ?? 0;
  day.correct += correct;
  day.total += total;
  data.stars += correct;
  if (ev.skill) {
    const s = (day.mathBySkill[ev.skill] ??= { correct: 0, total: 0 });
    s.correct += correct;
    s.total += total;
  }

  if (!day.completed && isDayComplete(day, settings)) {
    day.completed = true;
    data.streak = data.lastCompleted === addDays(today, -1) ? data.streak + 1 : 1;
    data.lastCompleted = today;
    data.coupons.push({ id: uid(), label: settings.rewardLabel, earnedAt: today });
    return { justCompleted: true };
  }
  return { justCompleted: false };
}
