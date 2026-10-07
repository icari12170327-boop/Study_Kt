import { useEffect, useRef, useState } from 'react';
import type { Go } from '../route';
import type { ProfileId } from '../types';
import { useStore } from '../store/StoreContext';
import { ProgressBar, TopBar } from '../components/common';
import { ScienceExperiment } from '../components/ScienceExperiment';
import { pickScienceSession, gradeAnswer, recordScienceAnswer } from '../content/science/session';
import { SCIENCE_UNITS, badgeLabel } from '../content/science/units';
import { SCIENCE_CARD_MAP } from '../content/science/experiments';
import { scienceKeyAction } from '../content/science/keyboard';
import { toDateKey } from '../lib/date';

export function ScienceSession({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const profile = state.profiles.find(p => p.id === profileId)!;
  // 세션 중 갱신된 SRS나 날짜 때문에 풀던 문제 순서가 바뀌지 않는다.
  const [session] = useState(() => profile.level === 'adult' ? [] : pickScienceSession(profile.level, state.data[profileId].srs, toDateKey(), 5));
  const [before] = useState(() => ({ collected: Object.keys(state.data[profileId].science.collected), badges: [...state.data[profileId].science.badges] }));
  const [index, setIndex] = useState(0), [chosen, setChosen] = useState<number>();
  const [correctCount, setCorrectCount] = useState(0), [experiment, setExperiment] = useState<string>();
  const cursor = useRef(0), answered = useRef(false), options = useRef<HTMLDivElement>(null), nextButton = useRef<HTMLButtonElement>(null);
  const q = session[index], data = state.data[profileId].science;
  const choose = (answer: number) => {
    if (!q || answered.current || cursor.current !== index || experiment) return;
    answered.current = true;
    update(draft => { recordScienceAnswer(draft, profileId, q.id, answer, toDateKey()); });
    setChosen(answer);
    if (gradeAnswer(q, answer)) setCorrectCount(n => n + 1);
  };
  const next = () => {
    if (!answered.current || cursor.current !== index || experiment) return;
    answered.current = false;
    cursor.current++;
    setChosen(undefined);
    setIndex(cursor.current);
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return;
      if (document.querySelector('.modal-backdrop, [aria-modal="true"], dialog[open]')) return;
      const target = event.target instanceof Element ? event.target : document.activeElement;
      for (const element of [target, document.activeElement]) {
        if (element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
        const control = element?.closest('button, a[href], [role="button"], [role="link"], summary');
        if (event.key === 'Enter' && control && !options.current?.contains(control) && control !== nextButton.current) return;
      }
      const action = scienceKeyAction(event.key, q, chosen !== undefined);
      if (!action) return;
      event.preventDefault();
      if (event.repeat) return;
      if (action.type === 'choose') choose(action.chosen); else next();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  const collected = session.filter(row => data.collected[row.id] && !before.collected.includes(row.id));
  const badges = data.badges.filter(id => !before.badges.includes(id));
  return <div className="page science-page">
    <TopBar title="🔬 과학 문제" onBack={() => go({ name: 'home', profileId })} />
    {!session.length ? <section className="panel"><h2>오늘 복습할 문제를 모두 풀었어요!</h2><p>새 문제나 복습할 문제가 생기면 다시 만나요.</p><button className="btn btn-primary" onClick={() => go({ name: 'science-collection', profileId })}>도감 보기</button></section> : q ? <>
      <div className="question-tag"><span className="badge">{SCIENCE_UNITS[q.unit].title}</span><span className="muted">{index + 1} / {session.length}문제</span></div>
      <ProgressBar value={index} max={session.length} />
      <section className="question-card"><div className="science-hero" aria-hidden="true">{q.emoji}</div><h2 className="science-question">{q.question}</h2><p className="small muted">{q.kind === 'ox' ? 'O/X 또는 1/2로 골라요.' : '1~4로 골라요.'} 해설을 읽고 Enter로 다음 문제에 가요.</p>
        <div className="science-options" ref={options} role="group" aria-label="답 고르기">{q.choices.map((value, n) => <button key={value} className={`science-choice ${chosen === n ? 'selected' : ''} ${chosen !== undefined && q.answer === n ? 'science-correct' : ''}`} disabled={chosen !== undefined} onClick={() => choose(n)}><span className="badge">{n + 1}</span> {value}</button>)}</div>
      </section>
      {chosen !== undefined && <section className="panel science-feedback" aria-live="polite"><h3>{gradeAnswer(q, chosen) ? '✅ 맞았어요!' : `❌ 정답: ${q.choices[q.answer]}`}</h3><p>{q.explain}</p>
        {profile.level === 'g5' && q.why && <details key={q.id}><summary>더 알아보기</summary><p>{q.why}</p></details>}
        {q.experimentId && <button className="btn btn-soft" onClick={() => setExperiment(q.experimentId)}>🧪 집에서 해 보기{data.experiments[q.experimentId] ? ' · 완료' : ''}</button>}
        <button className="btn btn-primary wide" ref={nextButton} onClick={next}>{index + 1 === session.length ? '결과 보기' : '다음 문제'} · Enter</button>
      </section>}
    </> : <section className="done" aria-live="polite"><div className="science-hero">🔬</div><h2>{session.length}문제를 끝냈어요!</h2><p>정답 {correctCount} / {session.length}</p><h3>새 도감 카드 {collected.length}장</h3>{collected.map(row => <p key={row.id}>{row.emoji} {row.card}</p>)}<h3>새 배지 {badges.length}개</h3>{badges.map(id => <p key={id}>{badgeLabel(id)}</p>)}<div className="done-actions"><button className="btn btn-primary" onClick={() => go({ name: 'science-collection', profileId })}>내 도감 보기</button><button className="btn btn-soft" onClick={() => go({ name: 'home', profileId })}>홈으로</button></div></section>}
    {experiment && SCIENCE_CARD_MAP[experiment] && <ScienceExperiment key={experiment} card={SCIENCE_CARD_MAP[experiment]} profileId={profileId} onClose={() => setExperiment(undefined)} />}
  </div>;
}
