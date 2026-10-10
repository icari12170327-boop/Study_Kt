import { useEffect, useRef, useState } from 'react';
import type { TalkChunk } from '../content/talk/chunks';
import { canSpeak, speak } from '../lib/speech';
export function TalkPreview({ chunks, speed, disabled, onSkip }: { chunks: readonly TalkChunk[]; speed: number; disabled: boolean; onSkip: () => void }) {
  const [playing, setPlaying] = useState(false), alive = useRef(true), ownsSpeech = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (ownsSpeech.current && canSpeak()) window.speechSynthesis.cancel(); }; }, []);
  return <section className="t22b-preview" aria-label="미리 보기 표현">
    <h3>오늘 쓸 표현 {chunks.length}개</h3>
    <p className="small muted">잠깐 듣고 살펴봐요. 외우지 않아도 괜찮아요.</p>
    {chunks.map(chunk => <article key={chunk.id} className="t22b-chunk"><p lang="en">{chunk.en}</p><p>{chunk.ko}</p>{canSpeak() && <button className="btn btn-soft" disabled={playing} aria-label={`${chunk.en} 듣기`} onClick={() => { ownsSpeech.current = true; setPlaying(true); void speak(chunk.en, { lang: 'en-US', rate: speed }).finally(() => { ownsSpeech.current = false; if (alive.current) setPlaying(false); }); }}>🔊 듣기</button>}</article>)}
    <button className="btn btn-ghost" disabled={disabled} onClick={onSkip}>미리 보기 건너뛰고 대화 시작</button>
  </section>;
}
