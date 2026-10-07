import { useRef, useState } from 'react';
import type { Go } from '../route';
import type { ProfileId, ScienceCard } from '../types';
import { useStore } from '../store/StoreContext';
import { PinGate } from '../components/PinGate';
import { ProgressBar, TopBar } from '../components/common';
import { chooseCard, pendingCards, OTHER_OBSERVATIONS, recordScience, SCIENCE_TOPICS, togetherCandidates, togetherCard } from '../content/science/session';
import { toDateKey } from '../lib/date';

type Phase = 'question' | 'prediction' | 'materials' | 'steps' | 'observation' | 'explain' | 'think' | 'done';

export function ScienceSession({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const profile = state.profiles.find(p => p.id === profileId)!;
  const [date] = useState(toDateKey);
  const [card, setCard] = useState<ScienceCard | undefined>(() => chooseCard(profile.level, state.data[profileId].science, date));
  const [phase, setPhase] = useState<Phase>('question');
  const [together, setTogether] = useState(false);
  const [predicted, setPredicted] = useState<Partial<Record<ProfileId, string>>>({});
  const [observed, setObserved] = useState<Partial<Record<ProfileId, string>>>({});
  const [think, setThink] = useState<Partial<Record<ProfileId, string>>>({});
  const [materials, setMaterials] = useState<string[]>([]);
  const [adult, setAdult] = useState(false);
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const saved = useRef(false);
  const participants = state.profiles.filter(p => together ? p.id === 'kid1' || p.id === 'kid2' : p.id === profileId);
  const thinkers = participants.filter(p => p.level === 'g5');
  const common = togetherCard(state, date);
  const alternatives = (together ? togetherCandidates(state) : pendingCards(profile.level, state.data[profileId].science)).filter(c => c.id !== card?.id);

  if (!card) return <div className="page"><TopBar title="🔬 오늘의 실험" onBack={() => go({ name: 'home', profileId })} /><p className="panel">실험은 초3·초5 어린이 프로필에서 시작해요.</p></div>;

  const finish = () => {
    if (saved.current) return;
    saved.current = true;
    update(draft => {
      recordScience(draft, card.id, toDateKey(), participants.map(p => ({ profileId: p.id, predicted: predicted[p.id]!, observed: observed[p.id]!,
        ...(p.level === 'g5' ? { thinkAnswer: think[p.id] } : {}) })), together);
    });
    setPhase('done');
  };
  const start = () => {
    update(draft => { for (const p of participants) draft.data[p.id].science.today = { date, cardId: card.id }; });
    setPhase('prediction');
  };
  const changeMode = () => {
    const next = together ? chooseCard(profile.level, state.data[profileId].science, date) : common;
    if (next) { setCard(next); setTogether(!together); }
  };

  return <div className="page science-page">
    <TopBar title="🔬 오늘의 실험" onBack={() => go({ name: 'home', profileId })} right={<button className="btn btn-ghost" onClick={() => go({ name: 'science-collection', profileId })}>도감</button>} />
    <div className="question-tag"><span className="badge">{SCIENCE_TOPICS[card.topic].title}</span><span className="badge badge-warn">보호자와 함께</span>{together && <span className="badge">같이 실험</span>}</div>
    <h2 className="science-title">{card.title}</h2><div className="hint" role="note">🛡️ {card.safety}</div>
    {phase === 'question' && <>
      <div className="question-card"><div className="science-hero" aria-hidden="true">{SCIENCE_TOPICS[card.topic].icon}</div><h3>{card.question}</h3><p className="muted">먼저 예상하고, 보호자와 관찰해요. 여러 날 걸리는 실험은 관찰을 마친 뒤 결과를 기록해요.</p></div>
      <button className="btn btn-primary" onClick={start}>예상해 볼래요</button>
      {(common || together) && <button className="btn btn-soft" onClick={changeMode}>{together ? '혼자 기록하기' : '👫 같이 실험'}</button>}
      {!common && !together && <p className="muted">두 아이에게 공통으로 남은 새 카드가 없어요. 각자 남은 카드를 모으면 다시 함께할 수 있어요.</p>}
      <button className="btn btn-ghost" onClick={() => setPin(true)}>🔒 오늘 다른 카드</button>
      {choosing && <section className="panel"><h3>준비할 수 있는 카드를 골라 주세요</h3>{alternatives.length ? alternatives.map(c => <button key={c.id} className="science-choice" onClick={() => {
        setCard(c); setChoosing(false);
        update(draft => { for (const p of participants) draft.data[p.id].science.today = { date, cardId: c.id }; });
      }}><strong>{c.title}</strong><span className="small muted">{c.materials.join(' · ')}</span></button>) : <p>이번 순환에서 남은 다른 카드가 없어요.</p>}</section>}
    </>}
    {phase === 'prediction' && <section className="panel"><h3>{card.question}</h3>{participants.map(p => <fieldset key={p.id}><legend>{p.name}의 예상</legend><div className="science-options">{card.predictions.map(value => <label className="science-choice" key={value}><input type="radio" name={`predict-${p.id}`} checked={predicted[p.id] === value} onChange={() => setPredicted({ ...predicted, [p.id]: value })} />{value}</label>)}</div></fieldset>)}<button className="btn btn-primary" disabled={!participants.every(p => predicted[p.id])} onClick={() => setPhase('materials')}>준비물 확인하기</button></section>}
    {phase === 'materials' && <section className="panel"><h3>준비물 확인</h3><p>함께라면 준비물은 한 번만 준비해요.</p>{card.materials.map(value => <label className="science-choice" key={value}><input type="checkbox" checked={materials.includes(value)} onChange={e => setMaterials(e.target.checked ? [...materials, value] : materials.filter(m => m !== value))} />{value}</label>)}<label className="science-choice"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} />보호자가 함께 있고, 주의 문구를 읽었어요</label><button className="btn btn-primary" disabled={materials.length !== card.materials.length || !adult} onClick={() => setPhase('steps')}>실험 시작</button></section>}
    {phase === 'steps' && <section className="question-card"><p>단계 {step + 1} / {card.steps.length}</p><ProgressBar value={step + 1} max={card.steps.length} /><h3>{card.steps[step]}</h3><button className="btn btn-primary wide" onClick={() => {
      if (step + 1 === card.steps.length) setPhase('observation'); else setStep(step + 1);
    }}>했어요</button></section>}
    {phase === 'observation' && <section className="panel"><h3>직접 본 결과를 골라요</h3><p className="muted">예상과 달라도 괜찮아요. 안 보였으면 솔직하게 기록해요.</p>{participants.map(p => <fieldset key={p.id}><legend>{p.name}이 관찰한 결과</legend><div className="science-options">{[...card.predictions, ...OTHER_OBSERVATIONS].map(value => <label className="science-choice" key={value}><input type="radio" name={`observe-${p.id}`} checked={observed[p.id] === value} onChange={() => setObserved({ ...observed, [p.id]: value })} />{value}</label>)}</div></fieldset>)}<button className="btn btn-primary" disabled={!participants.every(p => observed[p.id])} onClick={() => setPhase('explain')}>왜 그럴까?</button></section>}
    {phase === 'explain' && <section className="panel"><h3>왜 그럴까?</h3><p className="pre">{card.explain}</p><p className="muted">보통 기대하는 결과: {card.result}</p><p>다른 결과도 소중한 관찰이에요. 보호자와 조건을 다시 살펴봐요.</p><button className="btn btn-primary" onClick={() => thinkers.length ? setPhase('think') : finish()}>{thinkers.length ? '더 생각해 보기' : '도감에 넣기'}</button></section>}
    {phase === 'think' && card.deeper && <section className="panel form"><h3>더 생각해 보기</h3><p>{card.deeper.explain}</p><div className="hint">🔄 변인 바꿔 보기: {card.deeper.vary}</div><p className="muted">다시 실험할 때도 보호자와 함께하고 같은 주의 문구를 지켜요.</p>{thinkers.map(p => <label key={p.id}>{p.name} · {card.deeper!.think}<input maxLength={300} value={think[p.id] ?? ''} placeholder="내 생각 한 줄" onChange={e => setThink({ ...think, [p.id]: e.target.value })} /></label>)}<button className="btn btn-primary" disabled={!thinkers.every(p => think[p.id]?.trim())} onClick={finish}>도감에 넣기</button></section>}
    {phase === 'done' && <section className="done" aria-live="polite"><div className="science-acquired"><span className="science-hero">{SCIENCE_TOPICS[card.topic].icon}</span><strong>{card.title}</strong></div><h2>도감에 기록했어요!</h2>{participants.map(p => <p key={p.id}>{p.name}: {predicted[p.id]} → {observed[p.id]}<br /><span className="small muted">참여 ⭐ 1 · 예상과 관찰이 같으면 보너스 ⭐ 1 (같은 날 같은 카드는 한 번만)</span></p>)}{together && <p>두 아이의 도감에 각각 들어갔어요.</p>}<div className="done-actions"><button className="btn btn-primary" onClick={() => go({ name: 'science-collection', profileId })}>내 도감 보기</button><button className="btn btn-soft" onClick={() => go({ name: 'home', profileId })}>홈으로</button></div></section>}
    {pin && <PinGate onCancel={() => setPin(false)} onPass={() => { setPin(false); setChoosing(true); }} />}
  </div>;
}
