import { useCallback, useRef, useState } from 'react';
import type { MathProblem, ProfileId } from '../types';
import type { Go } from '../route';
import { duelScore, duelWinner } from '../content/games/duel';
import { finishDuel, finishGame, roundRemaining } from '../content/games/limits';
import { gradeAnswer, type AnswerInput } from '../content/math/grading';
import { formatAnswer } from '../content/math/skills';
import { useStore } from '../store/StoreContext';
import { NumberPad } from '../components/NumberPad';
import { TopBar } from '../components/common';
import { useGameClock } from '../components/GameClock';

export interface DuelPlan { date: string; seed: number; slots: { kid1: number; kid2: number }; queues: { kid1: MathProblem[]; kid2: MathProblem[] }; levels: { kid1: number; kid2: number } }
function DuelTurn({ name, level, queue, onEnd }: { name: string; level: number; queue: MathProblem[]; onEnd: (score: number) => void }) {
  const [startedAt] = useState(() => performance.now());
  const [index, setIndex] = useState(0), [input, setInput] = useState<AnswerInput>({});
  const [feedback, setFeedback] = useState<{ counted: boolean; correct: boolean; message: string }>();
  const nextButton = useRef<HTMLButtonElement>(null), answered = useRef(false), done = useRef(false), correct = useRef(0);
  const end = useCallback(() => {
    if (done.current) return;
    done.current = true; onEnd(duelScore(correct.current, roundRemaining(startedAt, performance.now())));
  }, [onEnd, startedAt]);
  const remaining = useGameClock(startedAt, true, end);
  const problem = queue[index];
  const next = () => {
    if (!answered.current || done.current) return;
    if (!roundRemaining(startedAt, performance.now())) { end(); return; }
    answered.current = false; setIndex(index + 1); setInput({}); setFeedback(undefined);
  };
  const submit = () => {
    if (answered.current || done.current) return;
    if (!roundRemaining(startedAt, performance.now())) { end(); return; }
    const result = gradeAnswer(problem.answer, input);
    if (result.reason) { setFeedback({ counted: false, correct: false, message: result.reason }); return; }
    answered.current = true;
    if (result.correct) correct.current++;
    if (index === queue.length - 1) { end(); return; }
    setFeedback({ counted: true, correct: result.correct, message: result.correct ? '정답!' : `정답은 ${formatAnswer(problem)}` });
  };
  return <><div className="game-status"><strong>{name} 차례 · 레벨 {level}</strong><span role="timer" aria-label="남은 시간">⏱ {Math.ceil(remaining / 1000)}초</span></div>
    <p>{index + 1} / 10문제 · 정답 {correct.current}개</p><section className="question-card"><h2 className="question-text">{problem.question}</h2>
      {problem.answer.kind === 'fraction' && <p className="small muted">기약분수로 답해요. 대분수는 자연수 칸도 채워요.</p>}
      <NumberPad key={index} kind={problem.answer.kind} value={input} onChange={setInput} onSubmit={submit} onNext={next} nextButtonRef={nextButton} onActivity={() => {}} disabled={feedback?.counted} />
      {feedback && <p className={`feedback ${feedback.correct ? 'ok' : 'bad'}`} role="status">{feedback.message}</p>}
      {feedback?.counted && <button ref={nextButton} className="btn btn-primary wide" onClick={next}>다음 문제</button>}
    </section></>;
}
export function DuelGame({ profileId, go, plan }: { profileId: ProfileId; go: Go; plan: DuelPlan }) {
  const { state, update } = useStore();
  const [phase, setPhase] = useState<'kid1-ready' | 'kid1' | 'handoff' | 'kid2' | 'result'>('kid1-ready');
  const scores = useRef<{ kid1: number; kid2: number }>({ kid1: 0, kid2: 0 });
  const finished = useRef(new Set<ProfileId>());
  const name = (id: ProfileId) => state.profiles.find(p => p.id === id)!.name;
  const receive = (id: 'kid1' | 'kid2', score: number) => {
    if (finished.current.has(id)) return;
    finished.current.add(id); scores.current[id] = score;
    if (id === 'kid1') {
      update(draft => { finishGame(draft.data.kid1, plan.slots.kid1, { date: plan.date, game: 'duel', score, opponent: 'kid2' }); });
      setPhase('handoff');
    } else {
      update(draft => { finishDuel(draft, plan.slots, plan.date, scores.current.kid1, score); });
      setPhase('result');
    }
  };
  const back = () => {
    if (phase !== 'result' && !confirm('대결을 끝낼까요? 두 아이 모두 오늘 한 판을 사용해요. 왕관은 두 차례를 모두 끝내야 받아요.')) return;
    go({ name: 'home', profileId });
  };
  const winner = duelWinner(scores.current.kid1, scores.current.kid2);
  return <div className="page reward-game"><TopBar title="⚔️ 형제 대결" onBack={back} />
    {(phase === 'kid1-ready' || phase === 'handoff') && <section className="panel done"><div className="done-emoji">{phase === 'handoff' ? '🤝' : '⚔️'}</div><h2>{phase === 'handoff' ? `${name('kid2')}에게 기기를 넘겨 주세요` : `${name('kid1')}부터 시작해요`}</h2>
      {phase === 'handoff' && <p>{name('kid1')} {scores.current.kid1}점</p>}<p>각자 레벨 문제 10개 · 최대 90초</p><p className="small muted">정답 한 개 10점 + 남은 시간(초)</p>
      <button className="btn btn-primary" onClick={() => setPhase(phase === 'handoff' ? 'kid2' : 'kid1')}>{phase === 'handoff' ? name('kid2') : name('kid1')} 준비 완료 · 시작</button>
    </section>}
    {(phase === 'kid1' || phase === 'kid2') && <DuelTurn key={phase} name={name(phase)} level={plan.levels[phase]} queue={plan.queues[phase]} onEnd={score => receive(phase, score)} />}
    {phase === 'result' && <section className="panel done"><div className="done-emoji">👑</div><h2>{winner === 'tie' ? '비겼어요! 둘 다 왕관 👑' : `${name(winner === 'a' ? 'kid1' : 'kid2')} 승리!`}</h2><p>{name('kid1')} {scores.current.kid1}점 · {name('kid2')} {scores.current.kid2}점</p><p>다음 날 끝까지 다음 게임 선택권이 있어요.</p><p className="small muted">게임 점수는 별과 학습 기록에 더하지 않아요.</p><button className="btn btn-primary" onClick={() => go({ name: 'home', profileId })}>홈으로</button></section>}
  </div>;
}
