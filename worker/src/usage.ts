import type { AiProfileId } from '../../shared/ai';
import type { Env } from './env';
import { profiles } from './validation';
export interface DayUsage {
  talkSeconds: number;
  generates: number;
  sessionId?: string;
  startedAt?: number;
}
export interface Session {
  id: string;
  profileId: AiProfileId;
  start: number;
  remaining: number;
  day: string;
  month: string;
  callId?: string;
  ended?: boolean;
  endedAt?: number;
  charged?: number;
  /** 종료된 예약 뒤 늦게 도착한 통화도 서버에서 정리한다. */
  needsHangup?: boolean;
  hangupFailures?: number;
  nextHangupAt?: number;
}
export interface Ledger {
  days: Record<string, Record<AiProfileId, DayUsage>>;
  months: Record<string, number>;
  sessions: Record<string, Session>;
}
export const emptyLedger = (): Ledger => ({ days: {}, months: {}, sessions: {} });
export function dateKeys(now: number): { day: string; month: string; midnight: number } {
  const day = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  return { day, month: day.slice(0, 7), midnight: Date.parse(`${day}T00:00:00+09:00`) + 86400000 };
}
export function todayUsage(ledger: Ledger, day: string): Record<AiProfileId, DayUsage> {
  return (ledger.days[day] ??= Object.fromEntries(
    profiles.map((id) => [id, { talkSeconds: 0, generates: 0 }]),
  ) as Record<AiProfileId, DayUsage>);
}
export const setting = (value: string, fallback: number): number =>
  Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;
export function remainingSeconds(ledger: Ledger, env: Env, profile: AiProfileId, now: number): number {
  const { day, month, midnight } = dateKeys(now);
  const reservations = Object.values(ledger.sessions)
    .filter((s) => !s.ended && s.month === month)
    .reduce((n, s) => n + s.remaining, 0);
  return Math.max(
    0,
    Math.floor(
      Math.min(
        setting(env[`TALK_MINUTES_${profile}`], 0) * 60 - todayUsage(ledger, day)[profile].talkSeconds,
        setting(env.TALK_MINUTES_MONTH_TOTAL, 0) * 60 - (ledger.months[month] ?? 0) - reservations,
        (midnight - now) / 1000,
      ),
    ),
  );
}
// 클라이언트 축소 보고로 상한을 우회하지 못하도록 서버가 실제 경과 시간을 센다.
export const elapsedSeconds = (session: Session, now: number): number =>
  Math.min(session.remaining, Math.max(0, Math.floor((now - session.start) / 1000)));
export function chargeSession(ledger: Ledger, session: Session, now: number): void {
  if (session.ended) return;
  session.charged = elapsedSeconds(session, now);
  session.ended = true;
  session.endedAt = now;
  todayUsage(ledger, session.day)[session.profileId].talkSeconds += session.charged;
  ledger.months[session.month] = (ledger.months[session.month] ?? 0) + session.charged;
}
/** 예전 저장값은 이미 확정된 사용 시간으로 종료 시각을 복원한다. */
export const hangupDeadline = (session: Session): number =>
  (session.endedAt ?? session.start + (session.charged ?? session.remaining) * 1000) + 86400000;
export function abandonHangup(session: Session, now: number): boolean {
  if (!session.ended || !session.needsHangup || ((session.hangupFailures ?? 0) < 8 && now < hangupDeadline(session))) return false;
  session.needsHangup = false;
  delete session.hangupFailures;
  delete session.nextHangupAt;
  return true;
}
export function pruneLedger(ledger: Ledger, now: number): void {
  const cutoff = dateKeys(now - 90 * 86400000).day;
  ledger.days = Object.fromEntries(Object.entries(ledger.days).filter(([day]) => day >= cutoff));
  const monthCutoff = dateKeys(now - 400 * 86400000).month;
  ledger.months = Object.fromEntries(Object.entries(ledger.months).filter(([month]) => month >= monthCutoff));
  ledger.sessions = Object.fromEntries(
    Object.entries(ledger.sessions).filter(([, s]) => !s.ended || s.needsHangup || s.start >= now - 86400000),
  );
}
