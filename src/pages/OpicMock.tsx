import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { OpicAnswer } from '../components/OpicAnswer';
import { requestOpicFeedback } from '../lib/opicFeedback';
import { fetchUsage } from '../lib/ai';
import { archiveCompletedMock, buildOpicMock, adjustOpicMock, mockAllowance, resumeOpicMock, opicMockResult, type OpicMock } from '../lib/opicMock';
import { opicMetrics } from '../lib/opic';
import { applyOpicProgress } from '../lib/opicProgress';
import { runOpicFeedbackBatch } from '../lib/opicFeedbackBatch';
import { seededRng } from '../lib/random';
import { toDateKey } from '../lib/date';
import { QUESTION_MAP, TYPE_NAMES, TOPIC_NAMES } from '../content/opic/questions';
export function OpicMockPractice({ onDone }: { onDone: () => void }) {
  const { state, update } = useStore(), data = state.data.parent.opic!, today = toDateKey();
  const mock = resumeOpicMock(data.currentMock, today);
  const [started, setStarted] = useState(false), [difficulty, setDifficulty] = useState(data.settings.difficulty), [pending, setPending] = useState(false), [error, setError] = useState(''), [elapsed, setElapsed] = useState(mock?.elapsedSec ?? 0);
  const [remaining, setRemaining] = useState<import('../../shared/ai').Usage['opicRemaining']>();
  const live = useRef(true), busy = useRef(false), abort = useRef<AbortController | undefined>(undefined), latest = useRef(mock);
  latest.current = mock;
  useEffect(() => { live.current = true; return () => { live.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => {
    if (!started || !latest.current) return;
    const current = latest.current, at = performance.now();
    const now = () => Math.min(86400, current.elapsedSec + (performance.now() - at) / 1000);
    const persist = () => update(draft => { const row = draft.data.parent.opic?.currentMock; if (row?.id === current.id) { row.elapsedSec = now(); if (row.answers.length === 15) draft.data.parent.opic!.mocks = archiveCompletedMock(draft.data.parent.opic!.mocks ?? [], row); } });
    let ticks = 0;
    const timer = setInterval(() => { setElapsed(now()); if (++ticks % 5 === 0) persist(); }, 1000);
    window.addEventListener('pagehide', persist);
    return () => { clearInterval(timer); window.removeEventListener('pagehide', persist); persist(); };
  }, [started, update]);
  const start = async () => {
    if (busy.current) return; busy.current = true; setPending(true); setError(''); const controller = new AbortController(); abort.current = controller;
    try {
      const usage = await fetchUsage(state.ai, controller.signal), reason = mockAllowance(usage.opicRemaining);
      if (!live.current || controller.signal.aborted) return;
      setRemaining(usage.opicRemaining);
      if (reason) { setError(reason); return; }
      if (!remaining || mockAllowance(remaining)) return;
      const nonce = Date.now(), next = buildOpicMock({ ...data.settings, difficulty }, today, seededRng(nonce), `${today}:mock:${nonce}`);
      update(draft => { draft.data.parent.opic!.currentMock = next; }); setElapsed(0); setStarted(true);
    } catch { if (live.current && !controller.signal.aborted) setError('한도를 확인하지 못했어요. AI 연결을 확인하고 다시 눌러 주세요.'); }
    finally { busy.current = false; if (live.current) setPending(false); }
  };
  const patch = (change: (mock: OpicMock) => void) => update(draft => { const current = draft.data.parent.opic?.currentMock; if (current && current.id === mock?.id) { change(current); if (current.answers.length === 15) draft.data.parent.opic!.mocks = archiveCompletedMock(draft.data.parent.opic!.mocks ?? [], current); } });
  const feedback = async () => {
    if (!mock || busy.current) return;
    busy.current = true; setPending(true); setError(''); const controller = new AbortController(); abort.current = controller;
    const indices = mock.answers.flatMap((a, i) => a.feedback ? [] : [i]);
    patch(row => { row.feedbackAttempted = true; });
    const failures = await runOpicFeedbackBatch(indices, index => requestOpicFeedback(state.ai, mock.answers[index], data.settings.targetLevel, controller.signal), (index, result) => patch(row => { row.answers[index].feedback = result; }), controller.signal);
    if (live.current && !controller.signal.aborted) { setPending(false); if (failures.length) setError(`${failures.length}문항의 피드백을 받지 못했어요. 실패한 문항만 다시 받을 수 있어요.`); }
    busy.current = false;
  };
  useEffect(() => { if (started && mock?.answers.length === 15 && !mock.feedbackAttempted && !busy.current) void feedback(); });
  const finish = () => { if (!mock || pending) return; update(draft => { const opic = draft.data.parent.opic!; opic.mocks = archiveCompletedMock(opic.mocks ?? [], { ...mock, elapsedSec: elapsed }); delete opic.currentMock; }); onDone(); };
  if (!started || !mock) return <section className="panel"><h2>실전 모의고사 · 자기 평가</h2><p>15문항 · 질문 듣기와 최대 2분 30초 답변 · 40분은 참고 타이머예요.</p><p>받아쓰기 15회·최대 37.5분, 피드백 15회가 필요해요. 시작 전에 서버의 남은 한도를 확인해요.</p>
    {mock ? <><p>오늘 {mock.answers.length}/15문항을 답했어요. 녹음 파일은 남기지 않아요.</p><button className="btn btn-primary" onClick={() => setStarted(true)}>오늘 모의고사 이어 보기</button></> : <><label>지금 나에게 맞는 난이도<select value={difficulty} onChange={e => setDifficulty(Number(e.target.value) as typeof difficulty)}>{['1 · 짧은 단어로 답해요', '2 · 간단한 문장을 말해요', '3 · 익숙한 일상을 말해요', '4 · 경험을 여러 문장으로 말해요', '5 · 비교와 문제 해결도 말해요', '6 · 복잡한 주제도 이어 말해요'].map((label, i) => <option key={i} value={i + 1}>{label}</option>)}</select></label><button className="btn btn-primary" disabled={pending} onClick={() => void start()}>{pending ? '한도 확인 중…' : remaining && !mockAllowance(remaining) ? '모의고사 시작' : '남은 한도 확인'}</button>{remaining && <p>남은 한도: 받아쓰기 {remaining.transcribes}회 · {Math.floor(remaining.transcribeSeconds / 60)}분 / 생성 {remaining.generates}회</p>}</>}<p className="muted">생성 한도는 아이들 사용량까지 합친 가족 전체 한도예요.</p>{error && <p role="alert">{error}</p>}
  </section>;
  const index = mock.answers.length, adjustment = index === 7 && !mock.adjustment;
  const seconds = Math.max(0, Math.ceil(2400 - elapsed));
  return <section aria-label="오픽 실전 모의고사"><h2>실전 모의고사 · {Math.min(index + 1, 15)}/15문항</h2>{mock.adjustedDifficulty && <p>이후 선택 난이도 {mock.adjustedDifficulty} · 문항 은행에서 바꿀 수 있는 문항만 바뀌어요. 더 쉽거나 어려운 변형이 없는 유형은 같은 수준으로 이어져요.</p>}<p role="timer">{seconds ? `40분까지 ${Math.floor(seconds / 60)}분 ${seconds % 60}초` : `40분 초과 · ${Math.floor((elapsed - 2400) / 60)}분 더 연습했어요`}</p><p className="muted">중간에 나가도 오늘은 이어 볼 수 있어요. 녹음은 저장하지 않아요.</p>
    {adjustment ? <div className="panel"><h3>7문항을 마쳤어요. 뒤 문항의 난이도를 골라요.</h3><p className="muted">문항 은행에서 바꿀 수 있는 문항만 바뀌어요. 과거 경험·롤플레이처럼 난이도 변형이 없는 유형은 같은 수준으로 이어져요.</p><div className="opic-actions">{([['easier', '쉽게'], ['same', '그대로'], ['harder', '어렵게']] as const).map(([choice, label]) => <button className="btn btn-primary" key={choice} onClick={() => update(draft => { draft.data.parent.opic!.currentMock = adjustOpicMock(mock, choice); })}>{label}</button>)}</div></div> : index < 15 ? <><h3>{TYPE_NAMES[QUESTION_MAP.get(mock.questionIds[index])!.type]}</h3><OpicAnswer key={`${mock.id}:${index}`} maxSeconds={150} question={QUESTION_MAP.get(mock.questionIds[index])} onAnswer={(text, durationSec) => {
      const q = QUESTION_MAP.get(mock.questionIds[index])!;
      update(draft => { const current = draft.data.parent.opic!.currentMock; if (!current || current.id !== mock.id || current.answers.length !== index) return; current.answers.push({ id: `${current.id}:${index}`, date: current.date, questionId: q.id, topic: q.topic, type: q.type, transcript: text, durationSec, ...opicMetrics(text, durationSec) }); applyOpicProgress(draft, current.date); if (current.answers.length === 15) draft.data.parent.opic!.mocks = archiveCompletedMock(draft.data.parent.opic!.mocks ?? [], current); });
    }} /></> : <><p role="status">15문항 답변은 자동으로 기록에 저장됐어요. 피드백도 받는 대로 저장해요.</p><OpicMockResult mock={mock} /><button className="btn btn-primary" disabled={pending || mock.answers.every(a => a.feedback)} onClick={() => void feedback()}>{pending ? '피드백을 받는 중…' : mock.answers.some(a => a.feedback) ? '실패한 문항만 다시 받기' : '15문항 피드백 받기'}</button>{error && <p role="alert">{error}</p>}<button className="btn btn-soft" disabled={pending} onClick={finish}>모의고사 마치기</button></>}
  </section>;
}
export function OpicMockResult({ mock }: { mock: OpicMock }) {
  const result = opicMockResult(mock);
  return <div><h3>전체 예상 범위: {result.band ?? '피드백 없음'} · 참고용</h3><p>피드백 {result.measured}/15문항 · 공식 성적이 아니에요.</p><h3>약한 유형 Top 3</h3>{result.weak.length ? <ul>{result.weak.map(row => <li key={row.type}>{TYPE_NAMES[row.type]} · 과제 달성 {row.achieved}/{row.total}</li>)}</ul> : <p>{result.measured ? '지금 받은 피드백에서 약한 유형은 없어요.' : '피드백을 받으면 볼 수 있어요.'}</p>}<p>다음 주 초점: {result.measured ? result.nextFocus : '피드백 확인 뒤 정해요.'}</p>
    <ol className="opic-mock-results">{mock.answers.map((answer, index) => <li className="panel" key={answer.id}><h4>{index + 1}. {TYPE_NAMES[answer.type]} · {TOPIC_NAMES[answer.topic]}</h4><p>{answer.words}단어 · {answer.feedback ? answer.feedback.taskDone ? '✅ 과제 달성' : '다시 연습할 과제' : '피드백 없음'} · 예상 {answer.feedback?.levelBand ?? '기록 없음'} (참고용)</p><details><summary>문항과 피드백 보기</summary><p lang="en">{QUESTION_MAP.get(answer.questionId)?.en}</p><p>{answer.feedback?.taskNoteKo}</p><p>{answer.feedback?.nextStepKo}</p><p lang="en">{answer.feedback?.modelAnswer}</p></details></li>)}</ol>
  </div>;
}
export function OpicMockHistory() {
  const { state, update } = useStore(), data = state.data.parent.opic!, mocks = data.mocks ?? [];
  const [pending, setPending] = useState<string>(), [error, setError] = useState('');
  const controller = useRef<AbortController | undefined>(undefined), busy = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const retry = async (mock: OpicMock) => {
    if (busy.current) return; busy.current = true; setPending(mock.id); setError('');
    const cancel = new AbortController(); controller.current = cancel;
    const failed = await runOpicFeedbackBatch(mock.answers.flatMap((a, i) => a.feedback ? [] : [i]), index => requestOpicFeedback(state.ai, mock.answers[index], data.settings.targetLevel, cancel.signal), (index, result) => update(draft => { const record = draft.data.parent.opic?.mocks?.find(m => m.id === mock.id); if (record) record.answers[index].feedback = result; }), cancel.signal);
    busy.current = false; if (!cancel.signal.aborted) { setPending(undefined); if (failed.length) setError(`${failed.length}문항을 받지 못했어요. 한 번 더 눌러 주세요.`); }
  };
  return <><h2>모의고사 기록</h2>{!mocks.length && <p>아직 마친 모의고사가 없어요.</p>}{error && <p role="alert">{error}</p>}{[...mocks].reverse().map(mock => <details className="panel" key={mock.id}><summary>{mock.date} · 난이도 {mock.difficulty} · 예상 {opicMockResult(mock).band ?? '피드백 없음'} (참고용)</summary><OpicMockResult mock={mock} />{mock.answers.some(a => !a.feedback) && <button className="btn btn-primary" disabled={!!pending} onClick={() => void retry(mock)}>{pending === mock.id ? '피드백을 받는 중…' : '실패한 문항만 다시 받기'}</button>}</details>)}</>;
}
