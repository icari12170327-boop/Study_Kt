import { useEffect, useRef, useState } from 'react';
import { AiError, generate, type AiConfig } from '../lib/ai';
/** 요청은 버튼을 누를 때만 보내고 같은 줄의 뜻은 화면 안에서 재사용한다. */
export function CoachMeaning({ text, cfg, onMeaning }: { text: string; cfg: AiConfig; onMeaning?: (ko: string) => void }) {
  const [ko, setKo] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), busy = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const receive = async () => {
    if (busy.current || ko || !text.trim() || text.length > 300) return;
    busy.current = true; setPending(true); setError('');
    try {
      const result = await generate(cfg, { profileId: 'parent', level: 'adult', kind: 'coach-gloss', input: { text } });
      if (!result || typeof result !== 'object' || !('ko' in result) || typeof result.ko !== 'string' || !result.ko.trim() || result.ko.length > 200) throw new AiError('server');
      if (alive.current) { setKo(result.ko); onMeaning?.(result.ko); }
    } catch (e) { if (alive.current) setError(e instanceof AiError ? e.message : '뜻을 받지 못했어요.'); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  };
  return <div className="coach-meaning">
    <button className="btn btn-ghost" disabled={pending || !!ko || !text.trim() || text.length > 300} onClick={() => { void receive(); }}>{pending ? '뜻 받는 중…' : error ? '뜻 다시 받기' : '뜻'}</button>
    {ko && <p className="small" lang="ko">{ko}</p>}{error && <p className="small bad-text" role="alert">{error}</p>}
    {text.length > 300 && <p className="small muted">긴 자막은 뜻을 받을 수 없어요.</p>}
  </div>;
}
