import { useState } from 'react';
import type { Go } from '../route';
import type { ProfileId } from '../types';
import { useStore } from '../store/StoreContext';
import { questionsFor, experimentsFor } from '../content/science/session';
import { SCIENCE_UNITS, badgeLabel } from '../content/science/units';
import { SCIENCE_QUESTION_MAP } from '../content/science/questions';
import { SCIENCE_CARD_MAP } from '../content/science/experiments';
import { ScienceExperiment } from '../components/ScienceExperiment';
import { TopBar } from '../components/common';
import { outfitFor } from '../lib/outfit';
import { toDateKey } from '../lib/date';

export function ScienceCollection({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state } = useStore();
  const profile = state.profiles.find(p => p.id === profileId)!;
  const data = state.data[profileId].science;
  const [selected, setSelected] = useState<string>(), [experiment, setExperiment] = useState<string>();
  const cards = profile.level === 'adult' ? [] : questionsFor(profile.level);
  const experiments = profile.level === 'adult' ? [] : experimentsFor(profile.level);
  const first = profile.level === 'g5', chosen = selected ? SCIENCE_QUESTION_MAP[selected] : undefined;
  return <div className={`page science-page ${first ? 'science-lab' : 'science-museum'}`}>
    <TopBar title={first ? '🧱 실험실 빌드' : '🏛️ 나의 과학 박물관'} onBack={() => go({ name: 'home', profileId })} />
    <section className="panel"><div className="science-hero">{profile.avatar}<span aria-label="오늘의 소품">{outfitFor(toDateKey(), profileId)}</span></div><strong>{profile.name}의 카드 {cards.filter(c => data.collected[c.id]).length} / {cards.length}장</strong><p className="muted">처음 맞힌 문제가 도감에 들어가요. {first ? '단원별 실험실 방을 지어요.' : '단원별 전시실을 채워요.'}</p></section>
    <section className="panel"><h2 className="section-title">🏅 나의 배지</h2><div className="chip-wrap">{data.badges.length ? data.badges.map(id => <span className="badge" key={id}>{badgeLabel(id)}</span>) : <p className="muted">같은 단원의 카드를 모으면 배지가 생겨요.</p>}</div><p className="small muted">단원별 5장·10장·단원 전체 배지</p><p className="small muted">문제가 5개 미만인 단원은 전체 배지만 있어요. 10장 배지는 문제가 10개 이상인 단원에서 얻어요.</p></section>
    {Object.entries(SCIENCE_UNITS).map(([unit, meta]) => {
      const group = cards.filter(c => c.unit === unit);
      if (!group.length) return null;
      const count = group.filter(c => data.collected[c.id]).length;
      return <section className={`panel science-room ${count ? 'built' : ''}`} key={unit}>
        <h2 className="section-title">{meta.emoji} {meta.title} {first ? '연구실' : '전시실'} · {count}/{group.length}</h2>
        {first && <div className="science-blocks" aria-label={`지어진 블록 ${count}개`}>{group.map((c, i) => <span key={c.id} className={i < count ? 'built' : ''}>{i < count ? '🧱' : '▫️'}</span>)}</div>}
        <div className="science-card-grid">{group.map(c => <button className={`science-tile ${data.collected[c.id] ? 'owned' : 'silhouette'}`} key={c.id} disabled={!data.collected[c.id]} onClick={() => setSelected(c.id)}><span className="science-tile-icon">{data.collected[c.id] ? c.emoji : '🔒'}</span><strong>{data.collected[c.id] ? c.card : '아직 빈 자리'}</strong>{data.collected[c.id] && <span className="small muted">{data.collected[c.id]} {c.experimentId && data.experiments[c.experimentId] ? '🧪' : ''}</span>}</button>)}</div>
      </section>;
    })}
    <details className="panel"><summary>🧪 집에서 해 보기 · 실험 기록 {Object.keys(data.experiments).length}장</summary><p className="muted">문제 미션과 별개예요. 예전에 마친 실험 기록도 그대로 남아 있어요.</p>{experiments.map(card => <button className="science-choice" key={card.id} onClick={() => setExperiment(card.id)}>{card.title}<span className="small muted">{data.experiments[card.id] ? `🧪 ${data.experiments[card.id].date}` : '보호자와 함께 · 첫 완료 ⭐ 1'}</span></button>)}</details>
    {chosen && !experiment && <div className="modal-backdrop"><section className="modal science-detail" role="dialog" aria-modal="true" aria-label={chosen.card} onKeyDown={event => { if (event.key === 'Escape') setSelected(undefined); }}><button className="btn btn-ghost" autoFocus onClick={() => setSelected(undefined)}>닫기</button><h2>{chosen.emoji} {chosen.card}</h2><p>처음 맞힌 날: {data.collected[chosen.id]}</p><p>{chosen.explain}</p>{chosen.experimentId && <><p>{data.experiments[chosen.experimentId] ? `🧪 실험 완료: ${data.experiments[chosen.experimentId].date}` : '아직 실험하지 않았어요.'}</p><button className="btn btn-soft" onClick={() => setExperiment(chosen.experimentId)}>🧪 집에서 해 보기</button></>}</section></div>}
    {experiment && <ScienceExperiment key={experiment} card={SCIENCE_CARD_MAP[experiment]} profileId={profileId} onClose={() => setExperiment(undefined)} />}
  </div>;
}
