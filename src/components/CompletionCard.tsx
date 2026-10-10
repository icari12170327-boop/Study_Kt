import type { DayLog, MissionConfig } from '../types';
import { MISSION_META } from '../route';
import { formatKoreanDate, minuteTime } from '../lib/date';
export function CompletionCard({ name, day, now, missions }: { name: string; day: DayLog; now: Date; missions: readonly MissionConfig[] }) {
  const week = formatKoreanDate(day.date).match(/\([일월화수목금토]\)$/)?.[0] ?? '';
  return <section className="completion-card" aria-label="오늘 학습 완료 확인">
    <h2>오늘 학습 완료 ✅</h2><strong className="completion-name">{name}</strong>
    <p><time dateTime={day.date}>{day.date} {week}</time></p>
    <div className="completion-times">{day.completedAt && <strong><time dateTime={`${day.date}T${day.completedAt}`}>{day.completedAt}</time> 완료</strong>}<span>지금 시각 <time dateTime={now.toISOString()}>{minuteTime(now)}</time></span></div>
    <p className="completion-missions">{missions.filter(m => (day.progress[m.type] ?? 0) >= m.target).map(m => `${MISSION_META[m.type].icon} ${MISSION_META[m.type].title} ${Math.min(day.progress[m.type] ?? 0, m.target)}${MISSION_META[m.type].unit}`).join(' · ')}</p>
  </section>;
}
