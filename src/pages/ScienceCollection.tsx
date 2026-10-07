import { useState } from 'react';
import type { Go } from '../route';
import type { ProfileId, ScienceTopic } from '../types';
import { useStore } from '../store/StoreContext';
import { cardsFor, SCIENCE_TOPICS } from '../content/science/session';
import { SCIENCE_CARD_MAP } from '../content/science/cards';
import { TopBar } from '../components/common';
import { outfitFor } from '../lib/outfit';
import { toDateKey } from '../lib/date';

export function ScienceCollection({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state } = useStore();
  const profile = state.profiles.find(p => p.id === profileId)!;
  const data = state.data[profileId].science;
  const [selected, setSelected] = useState<string>();
  const cards = cardsFor(profile.level);
  const first = profile.level === 'g5';
  const chosen = selected ? SCIENCE_CARD_MAP[selected] : undefined;
  const record = selected ? data.done[selected] : undefined;
  return <div className={`page science-page ${first ? 'science-lab' : 'science-museum'}`}>
    <TopBar title={first ? '🧱 실험실 빌드' : '🏛️ 나의 과학 박물관'} onBack={() => go({ name: 'home', profileId })} />
    <section className="panel"><div className="science-hero">{profile.avatar}<span aria-label="오늘의 소품">{outfitFor(toDateKey(), profileId)}</span></div><strong>{profile.name}의 카드 {cards.filter(c => data.done[c.id]).length} / {cards.length}장</strong><p className="muted">{first ? '카드를 모으면 주제별 실험실 방이 지어져요.' : '카드를 모아 곤충·물고기·화석 전시실을 채워요.'}</p></section>
    <section className="panel"><h2 className="section-title">🏅 나의 배지</h2><div className="chip-wrap">{data.badges.length ? data.badges.map(id => {
      const [topic, n] = id.split(':'); return <span className="badge" key={id}>{SCIENCE_TOPICS[topic as ScienceTopic].icon} {SCIENCE_TOPICS[topic as ScienceTopic].title} {n}장</span>;
    }) : <p className="muted">같은 주제 3장을 모으면 첫 배지가 생겨요.</p>}</div><p className="small muted">주제별 3장·6장·10장 배지 · 카드가 더 추가되면 높은 단계도 모을 수 있어요.</p></section>
    {Object.entries(SCIENCE_TOPICS).map(([topic, meta]) => {
      const group = cards.filter(c => c.topic === topic);
      if (!group.length) return null;
      const count = group.filter(c => data.done[c.id]).length;
      return <section className={`panel science-room ${count ? 'built' : ''}`} key={topic}>
        <h2 className="section-title">{meta.icon} {first ? `${meta.title} 연구실` : meta.museum} · {count}/{group.length}</h2>
        {first && <div className="science-blocks" aria-label={`지어진 블록 ${count}개`}>{group.map((c, i) => <span key={c.id} className={i < count ? 'built' : ''}>{i < count ? '🧱' : '▫️'}</span>)}</div>}
        <div className="science-card-grid">{group.map(c => <button className={`science-tile ${data.done[c.id] ? 'owned' : 'silhouette'}`} key={c.id} disabled={!data.done[c.id]} onClick={() => setSelected(c.id)}><span className="science-tile-icon">{meta.icon}</span><strong>{data.done[c.id] ? c.title : '아직 빈 자리'}</strong></button>)}</div>
      </section>;
    })}
    {chosen && record && <div className="modal-backdrop" onClick={() => setSelected(undefined)}><section className="modal science-detail" role="dialog" aria-modal="true" aria-label={chosen.title} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setSelected(undefined); }}><button className="btn btn-ghost" autoFocus onClick={() => setSelected(undefined)}>닫기</button><h2>{chosen.title}</h2><p>{record.date}{record.together ? ' · 같이 실험' : ''}</p><p>내 예상: {record.predicted}</p><p>내 관찰: {record.observed}</p><p>{chosen.explain}</p>{first && <><p>{chosen.deeper?.think}</p><p>내 생각: {record.thinkAnswer || '아직 기록하지 않았어요'}</p><p>변인 바꾸기: {chosen.deeper?.vary}</p></>}</section></div>}
  </div>;
}
