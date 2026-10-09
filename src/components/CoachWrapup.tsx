import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { AiError, generate } from '../lib/ai';
import { aiReady, summaryLines } from '../lib/talk';
import { coachErrorMessage, coachTitle, fillCoachMeanings, isCoachCheck, isCoachWrapup, normalizeCoachSettings } from '../lib/coach';
import type { CoachSettings, TalkLog } from '../types';
import { CoachSaveButton } from './CoachPhrase';
import { CoachMeaning } from './CoachMeaning';

export function CoachWrapup({ log, auto = false, settings, onSkip }: { log: TalkLog; auto?: boolean; settings?: CoachSettings; onSkip?: () => void }) {
  const { state, update } = useStore();
  const stored = state.data.parent.talks.find(row => row.id === log.id), wrapup = stored?.coachWrapup, checked = stored?.coachCheck;
  const cfg = state.ai, level = normalizeCoachSettings(settings ?? state.settings.parent.coach).level;
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const [writing, setWriting] = useState(checked?.text ?? ''), [checking, setChecking] = useState(false), [checkError, setCheckError] = useState(''), [meaning, setMeaning] = useState('');
  const alive = useRef(true), busy = useRef(false), requested = useRef(false), checkBusy = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const receive = useCallback(async () => {
    if (busy.current || wrapup) return;
    const lines = summaryLines(log.lines);
    if (!lines.length || !aiReady(cfg)) { setError(lines.length ? 'AI 연결을 확인해 주세요.' : '저장된 발화가 없어요. 다음 대화에서 문장을 받아 보세요.'); return; }
    busy.current = true; setPending(true); setError('');
    try {
      const result = await generate(cfg, { profileId: 'parent', level: 'adult', kind: 'coach-wrapup', input: { lines } });
      if (!isCoachWrapup(result)) throw new AiError('server');
      update(draft => { const row = draft.data.parent.talks.find(row => row.id === log.id); if (row) { row.coachWrapup = result; fillCoachMeanings(draft.data.parent, result.sentences); } });
    } catch (e) { if (alive.current) setError(`${coachErrorMessage(e, 'wrapup')} 대화 기록은 저장되어 있어요.`); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }, [cfg, log, update, wrapup]);
  useEffect(() => { if (auto && !wrapup && !requested.current) { requested.current = true; void receive(); } }, [auto, receive, wrapup]);
  const check = async () => {
    if (checkBusy.current || !writing.trim()) return;
    checkBusy.current = true; setChecking(true); setCheckError('');
    const text = writing.trim();
    try {
      const result = await generate(cfg, { profileId: 'parent', level: 'adult', kind: 'coach-check', input: { text, level } });
      if (!isCoachCheck(result)) throw new AiError('server');
      update(draft => { const row = draft.data.parent.talks.find(row => row.id === log.id); if (row) row.coachCheck = { text, ...result }; });
      if (alive.current) setMeaning(old => result.corrected === checked?.corrected ? old : '');
    } catch (e) { if (alive.current) setCheckError(coachErrorMessage(e, 'check')); }
    finally { checkBusy.current = false; if (alive.current) setChecking(false); }
  };
  const source = coachTitle(log.coachTopic);
  return <section className="panel form coach-wrapup" aria-label="코치 대화 마무리">
    <h2>오늘 같이 쓴 문장</h2>
    {pending && <p role="status">오늘 문장을 정리하고 있어요…</p>}{error && !wrapup && <p className="bad-text" role="alert">{error}</p>}
    {wrapup ? <>
      {!wrapup.sentences.length && <p>이번에는 남길 영어 문장이 없어요. 다음에 함께 말해 봐요.</p>}
      {wrapup.sentences.map((row, index) => <article className="business-expression" key={index}><p lang="en" className="coach-sentence">{row.en}</p><p>{row.ko}</p><CoachSaveButton en={row.en} ko={row.ko} source={source} /></article>)}
      <h3>하나만 써 볼까요?</h3><label><span id={`coach-write-${log.id}`}>오늘 영어 한 문장</span><textarea aria-labelledby={`coach-write-${log.id}`} rows={2} maxLength={300} value={writing} disabled={checking} onChange={e => setWriting(e.target.value)} placeholder="한국어가 섞여도 괜찮아요." /></label>
      <button className="btn btn-primary" disabled={checking || !writing.trim()} onClick={() => { void check(); }}>{checking ? '확인하는 중…' : checkError ? '쓰기 다시 확인' : '문장 확인'}</button>
      {checkError && <p className="bad-text" role="alert">{checkError}</p>}
      {checked && <article className="business-expression"><h3>이렇게 말할 수 있어요</h3><p lang="en" className="coach-sentence">{checked.corrected}</p><p>{checked.noteKo}</p>
        <CoachMeaning key={checked.corrected} text={checked.corrected} cfg={cfg} onMeaning={ko => { setMeaning(ko); update(draft => { fillCoachMeanings(draft.data.parent, [{ en: checked.corrected, ko }]); }); }} />
        <CoachSaveButton en={checked.corrected} ko={meaning} source={source} /><p className="small muted">뜻이 없는 문장은 ‘뜻’을 눌러 채우면 단어에서 복습할 수 있어요.</p>
      </article>}
    </> : !pending && <button className="btn btn-primary" disabled={!log.lines.length} onClick={() => { void receive(); }}>마무리 다시 받기</button>}
    {onSkip && <button className="btn btn-ghost" onClick={onSkip}>건너뛰고 홈으로</button>}
  </section>;
}
