import type { ProfileData } from '../types';
import { SCIENCE_QUESTION_MAP } from '../content/science/questions';
import { scienceSummary } from '../content/science/session';
import { toDateKey } from '../lib/date';

export function ScienceOverview({ data }: { data: ProfileData }) {
  const summary = scienceSummary(data, toDateKey());
  return <details className="science-overview"><summary>🔬 과학 문제 · 최근 7일 정답률 {summary.total ? `${Math.round(summary.correct / summary.total * 100)}% (${summary.correct}/${summary.total})` : '아직 기록 없음'}</summary><p>도감 {Object.keys(data.science.collected).length}장 · 배지 {data.science.badges.length}개 · 실험 {Object.keys(data.science.experiments).length}장</p><h4>자주 틀린 문제 5개</h4><p className="small muted">최근 오답 30개에서 집계해요. 고른 답은 해당 문제의 가장 최근 오답이에요.</p>{summary.frequentWrong.length ? summary.frequentWrong.map(row => {
    const q = SCIENCE_QUESTION_MAP[row.id];
    return <article className="science-record" key={row.id}><strong>{q?.question ?? `현재 문제 은행에 없는 문제: ${row.id}`}</strong><span className="small muted">{row.date} · {row.count}번 틀림</span><span>고른 답: {q?.choices[row.chosen] ?? `${row.chosen + 1}번`}</span>{q && <span>정답: {q.choices[q.answer]}</span>}</article>;
  }) : <p className="muted">아직 틀린 문제가 없어요.</p>}</details>;
}
