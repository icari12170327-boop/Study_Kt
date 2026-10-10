import type { TalkLog } from '../types';
import { GROWTH_METRICS, parentGrowthWeeks } from '../lib/talkGrowth';
export function ParentEnglishReport({ logs, today, offset }: { logs: readonly TalkLog[]; today: string; offset: number }) {
  const weeks = parentGrowthWeeks(logs, today, offset), current = weeks[3], previous = weeks[2];
  const show = (value: number | null, unit: string) => value === null ? '기록 없음' : `${(value * (unit === '%' ? 100 : 1)).toFixed(unit === '%' ? 0 : 1)}${unit}`;
  return <section className="t22b-growth" aria-label="보호자 영어 성장 지표">
    <h2>보호자 영어</h2><p>{current.range.start} ~ {current.range.end}</p>
    <p className="small muted">대화별 수치의 평균이에요. 최근 4주를 살펴봐요. 교정 비율은 대화 내용에 따라 달라지며 평가 점수가 아니에요.</p>
    <div className="t22b-growth-grid">{GROWTH_METRICS.map(metric => {
      const value = current.stats[metric.key], old = previous.stats[metric.key], trend = value === null || old === null ? '' : value > old ? '▲' : value < old ? '▼' : '–';
      const maximum = Math.max(metric.scale, ...weeks.map(week => week.stats[metric.key] ?? 0));
      return <article className="panel" key={metric.key}><h3>{metric.label}</h3><strong>{show(value, metric.unit)} {trend && <span aria-label={`지난주 대비 ${trend === '▲' ? '증가' : trend === '▼' ? '감소' : '동일'}`}>{trend}</span>}</strong>
        <ol className="t22b-growth-bars">{weeks.map(week => <li key={week.range.start}><span>{week.range.start.slice(5)}</span><div className="t22b-growth-track" aria-hidden="true"><span style={{ width: `${(week.stats[metric.key] ?? 0) / maximum * 100}%` }} /></div><span>{show(week.stats[metric.key], metric.unit)}</span></li>)}</ol>
      </article>;
    })}</div>
    <p className="small muted">교정 수는 영어 문장 수로 나눠요. 먼저 고쳐 보기는 시도한 카드만, 다시 쓰기는 오늘의 교정·미리 보기 표현만 세어요. 기록이 없는 주에는 화살표를 표시하지 않아요.</p>
  </section>;
}
