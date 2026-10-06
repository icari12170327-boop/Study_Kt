import type { ProfileData } from '../types';
import { mathTimeline } from '../content/math/adaptive';
import { formatKoreanDate } from '../lib/date';

export function MathOverview({ data, today }: { data: ProfileData; today: string }) {
  const timeline = mathTimeline(data.math, data.days, today);
  const points = timeline.flatMap((row, i) =>
    row.level === undefined ? [] : [`${28 + i * 28},${112 - row.level * 11}`],
  );
  return (
    <div className="math-overview">
      <strong>수학 도전 · 현재 레벨 {data.math.level}</strong>
      <svg className="math-chart" viewBox="0 0 420 124" role="img" aria-label="최근 14일 수학 레벨 변화">
        <title>최근 14일 수학 레벨 변화 (1~9)</title>
        {[1, 5, 9].map((level) => (
          <g key={level}>
            <line x1="24" x2="410" y1={112 - level * 11} y2={112 - level * 11} className="math-chart-grid" />
            <text x="4" y={116 - level * 11} className="math-chart-label">
              {level}
            </text>
          </g>
        ))}
        <polyline points={points.join(' ')} className="math-chart-line" />
        {timeline.map(
          (row, i) =>
            row.level !== undefined && (
              <circle key={row.date} cx={28 + i * 28} cy={112 - row.level * 11} r="3" className="math-chart-point">
                <title>
                  {formatKoreanDate(row.date)} · 레벨 {row.level}
                </title>
              </circle>
            ),
        )}
      </svg>
      <div className="math-history-scroll" tabIndex={0} aria-label="날짜별 수학 기록, 가로로 이동할 수 있어요">
        <table className="math-history-table">
          <caption>최근 14일 레벨과 찍기 횟수</caption>
          <thead>
            <tr>
              <th scope="col">날짜</th>
              {timeline.map((row) => (
                <th key={row.date} scope="col">
                  {row.date.slice(5).replace('-', '/')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">레벨</th>
              {timeline.map((row) => (
                <td key={row.date}>{row.level ?? '—'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">찍기</th>
              {timeline.map((row) => (
                <td key={row.date}>{row.guesses}회</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted">5초 안에 틀린 답은 레벨 평가에서 제외돼요. — 표시는 레벨 기록이 없는 날이에요.</p>
    </div>
  );
}
