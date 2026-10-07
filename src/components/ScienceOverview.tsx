import type { ScienceData } from '../types';
import { SCIENCE_CARD_MAP } from '../content/science/cards';

export function ScienceOverview({ data }: { data: ScienceData }) {
  const rows = Object.entries(data.done).sort((a, b) => b[1].date.localeCompare(a[1].date));
  return <details className="science-overview"><summary>🔬 실험한 카드 {rows.length}장 · 배지 {data.badges.length}개</summary>{rows.length ? rows.map(([id, row]) => <article className="science-record" key={id}><strong>{SCIENCE_CARD_MAP[id]?.title ?? id}</strong><span className="small muted">{row.date}{row.together ? ' · 같이 실험' : ''}</span><span>예상: {row.predicted}</span><span>관찰: {row.observed}</span>{row.thinkAnswer && <span>생각: {row.thinkAnswer}</span>}</article>) : <p className="muted">아직 실험 기록이 없어요.</p>}</details>;
}
