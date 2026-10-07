import { useRef, useState } from 'react';
import type { ProfileId, ScienceCard } from '../types';
import { useStore } from '../store/StoreContext';
import { OTHER_OBSERVATIONS, recordExperiment } from '../content/science/session';
import { toDateKey } from '../lib/date';
import { ProgressBar } from './common';

/** 문제 풀이 위치를 유지한 채 선택 실험을 연다. */
export function ScienceExperiment({ card, profileId, onClose }: { card: ScienceCard; profileId: ProfileId; onClose: () => void }) {
  const { state, update } = useStore();
  const [phase, setPhase] = useState<'materials' | 'steps' | 'observation' | 'done'>('materials');
  const [materials, setMaterials] = useState<string[]>([]), [adult, setAdult] = useState(false);
  const [predicted, setPredicted] = useState(''), [observed, setObserved] = useState(''), [step, setStep] = useState(0);
  const saved = useRef(false);
  const [alreadyDone] = useState(() => !!state.data[profileId].science.experiments[card.id]);
  return <div className="modal-backdrop"><section className="modal science-detail" role="dialog" aria-modal="true" aria-label={`집에서 하는 실험 ${card.title}`} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <button autoFocus className="btn btn-ghost" onClick={onClose}>문제로 돌아가기</button>
    <h2>🧪 {card.title}</h2><p className="hint">🛡️ {card.safety}</p>
    <p className="small muted">보호자와 함께하는 선택 실험이에요. 문제 미션과는 별개이며, 실험별 첫 완료에 별 1개를 받아요.</p>
    {phase === 'materials' && <><h3>준비물 확인</h3>{card.materials.map(value => <label className="science-choice" key={value}><input type="checkbox" checked={materials.includes(value)} onChange={event => setMaterials(event.target.checked ? [...materials, value] : materials.filter(m => m !== value))} />{value}</label>)}
      <label className="science-choice"><input type="checkbox" checked={adult} onChange={event => setAdult(event.target.checked)} />보호자가 함께 있고, 주의 문구를 읽었어요</label>
      <fieldset><legend>{card.question}</legend>{card.predictions.map(value => <label className="science-choice" key={value}><input type="radio" name="experiment-prediction" checked={predicted === value} onChange={() => setPredicted(value)} />{value}</label>)}</fieldset>
      <p className="muted">여러 날 걸리는 실험은 관찰을 마친 뒤 다시 열어 결과를 기록해요.</p>
      <button className="btn btn-primary" disabled={materials.length !== card.materials.length || !adult || !predicted} onClick={() => setPhase('steps')}>실험 시작</button></>}
    {phase === 'steps' && <><p>단계 {step + 1} / {card.steps.length}</p><ProgressBar value={step + 1} max={card.steps.length} /><h3>{card.steps[step]}</h3><button className="btn btn-primary wide" onClick={() => step + 1 === card.steps.length ? setPhase('observation') : setStep(step + 1)}>했어요</button></>}
    {phase === 'observation' && <><fieldset><legend>직접 본 결과를 골라요</legend>{[...card.predictions, ...OTHER_OBSERVATIONS].map(value => <label className="science-choice" key={value}><input type="radio" name="experiment-observation" checked={observed === value} onChange={() => setObserved(value)} />{value}</label>)}</fieldset><p>{card.explain}</p><p className="muted">보통 기대하는 결과: {card.result}. 다른 결과도 소중한 관찰이에요.</p><button className="btn btn-primary" disabled={!observed} onClick={() => {
      if (saved.current) return;
      saved.current = true;
      update(draft => { recordExperiment(draft, profileId, card.id, toDateKey(), predicted, observed); });
      setPhase('done');
    }}>실험 완료 기록</button></>}
    {phase === 'done' && <div aria-live="polite"><h3>{alreadyDone ? '이미 기록한 실험을 다시 살펴봤어요!' : '🧪 실험 기록과 ⭐ 1개를 받았어요!'}</h3><p>예상: {predicted}<br />관찰: {observed}</p><p>문제 미션 진행은 그대로예요.</p><button className="btn btn-primary" onClick={onClose}>문제로 돌아가기</button></div>}
  </section></div>;
}
