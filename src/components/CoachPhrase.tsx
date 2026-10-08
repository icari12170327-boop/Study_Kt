import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { savePhrase } from '../lib/business';
import { canSpeak, speak } from '../lib/speech';
import type { ParentSpeed } from '../../shared/ai';

export function CoachSaveButton({ en, ko = '', source }: { en: string; ko?: string; source: string }) {
  const { state, update } = useStore();
  const [message, setMessage] = useState('');
  const saved = (state.data.parent.customCards ?? []).some(card => card.en.trim().toLowerCase() === en.trim().toLowerCase() && (!ko || !!card.ko.trim()));
  return <><button className="btn btn-soft" disabled={saved} onClick={() => {
    const now = Date.now(), random = Math.random();
    update(draft => { savePhrase(draft.data.parent, en, ko, source, now, () => random); }); setMessage('내 표현에 저장했어요.');
  }}>{saved ? '✓ 내 표현에 저장됨' : '⭐ 내 표현에 저장'}</button>{message && <p className="small" role="status">{message}</p>}</>;
}
export function CoachPhrase({ sentence, source, speed, onReplay }: { sentence: string; source: string; speed: ParentSpeed; onReplay: (playing: boolean) => void }) {
  const [playing, setPlaying] = useState(false);
  const alive = useRef(true), busy = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (busy.current && canSpeak()) window.speechSynthesis.cancel(); onReplay(false); }; }, [onReplay]);
  return <section className="panel coach-repeat form" aria-label="따라 할 문장">
    <h2>따라 해 볼까요?</h2><p className="coach-sentence" lang="en">{sentence}</p>
    <div className="row-center">{canSpeak() && <button className="btn btn-ghost" disabled={playing} onClick={() => {
      if (busy.current) return;
      busy.current = true; setPlaying(true); onReplay(true);
      void speak(sentence, { lang: 'en-US', rate: speed }).finally(() => { busy.current = false; if (alive.current) { setPlaying(false); onReplay(false); } });
    }}>{playing ? '다시 듣는 중…' : '🔁 다시 듣기'}</button>}<CoachSaveButton en={sentence} source={source} /></div>
    <p className="small muted">뜻은 마무리에서 같은 문장을 받으면 채워요. 다시 듣는 동안 마이크는 잠깐 쉬어요.</p>
  </section>;
}
