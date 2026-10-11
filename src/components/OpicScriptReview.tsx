import { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { OpicAnswer } from './OpicAnswer';
import { gradeScriptRetell, reviewOpicScript, scriptKeyPhrases } from '../lib/opicPlan';
import { toDateKey } from '../lib/date';
export function OpicScriptReview({ id, onDone }: { id: string; onDone: () => void }) {
  const { state, update } = useStore(), data = state.data.parent.opic!, script = data.scripts.find(s => s.id === id);
  const [result, setResult] = useState<ReturnType<typeof gradeScriptRetell>>();
  if (!script) return <button className="btn btn-primary" onClick={onDone}>오늘 연습으로</button>;
  const phrases = scriptKeyPhrases(script, data);
  return <section className="panel" aria-label="내 답안 간격 반복"><h2>어제 답안 다시 말하기 (1분 30초)</h2><p>답안을 보지 않고 핵심 표현을 넣어 말해요.</p><ul>{phrases.map(phrase => <li key={phrase} lang="en">{phrase}</li>)}</ul>
    {!result ? <><OpicAnswer maxSeconds={90} onAnswer={text => { const result = gradeScriptRetell(phrases, text); update(draft => { const scripts = draft.data.parent.opic!.scripts; const index = scripts.findIndex(s => s.id === id); if (index >= 0) scripts[index] = reviewOpicScript(scripts[index], result.success, toDateKey()); }); setResult(result); }} /><button className="btn btn-ghost" onClick={onDone}>건너뛰고 오늘 연습</button></> : <><p role="status">핵심 표현 {result.used}/{result.total}개 사용 · {result.success ? '다시 꺼내 말했어요!' : '내일 다시 연습해요.'}</p><button className="btn btn-primary" onClick={onDone}>오늘 연습으로</button></>}
  </section>;
}
