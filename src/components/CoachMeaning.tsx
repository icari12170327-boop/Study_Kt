import { useEffect, useRef, useState } from 'react';
import { AiError, generate, type AiConfig } from '../lib/ai';
import { coachErrorMessage, splitForGloss } from '../lib/coach';
type MeaningProps = { text: string; cfg: AiConfig; onMeaning?: (ko: string) => void };
/** 요청은 버튼을 누를 때만 보내고 같은 줄의 뜻은 화면 안에서 재사용한다. */
export function CoachMeaning(props: MeaningProps) { return <MeaningForText key={props.text} {...props} />; }
function MeaningForText({ text, cfg, onMeaning }: MeaningProps) {
  const [ko, setKo] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), busy = useRef(false);
  const abort = useRef<AbortController | undefined>(undefined);
  const chunks = splitForGloss(text), tooLong = !!text.trim() && !chunks.length;
  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  const receive = async () => {
    if (busy.current || ko || !chunks.length) return;
    busy.current = true; setPending(true); setError('');
    abort.current = new AbortController();
    try {
      const meanings: string[] = [];
      for (const chunk of chunks) {
        const signal = AbortSignal.any([abort.current.signal, AbortSignal.timeout(25000)]);
        const result = await generate(cfg, { profileId: 'parent', level: 'adult', kind: 'coach-gloss', input: { text: chunk } }, signal);
        if (!alive.current) return;
        if (!result || typeof result !== 'object' || !('ko' in result) || typeof result.ko !== 'string' || !result.ko.trim() || result.ko.length > 400) throw new AiError('server');
        meanings.push(result.ko.trim());
      }
      if (alive.current) { const meaning = meanings.join('\n'); setKo(meaning); onMeaning?.(meaning); }
    } catch (e) { if (alive.current) setError(coachErrorMessage(e)); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  };
  return <div className="coach-meaning">
    <button className="btn btn-ghost" disabled={pending || !!ko || !chunks.length} onClick={() => { void receive(); }}>{pending ? '뜻 받는 중…' : error ? '뜻 다시 받기' : '뜻'}</button>
    {ko && <p className="small" lang="ko">{ko}</p>}{error && <p className="small bad-text" role="alert">{error}</p>}
    {tooLong && <p className="small muted">긴 자막은 뜻을 받을 수 없어요.</p>}
  </div>;
}
