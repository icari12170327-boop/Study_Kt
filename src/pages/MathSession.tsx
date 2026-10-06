import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import type { Go } from '../route';
import { toDateKey } from '../lib/date';
import { applyProgress } from '../lib/progress';
import { uid } from '../lib/random';
import { buildMathQueue } from '../content/math/session';
import { gradeAnswer, type AnswerInput as Input } from '../content/math/grading';
import { formatAnswer, SKILL_MAP } from '../content/math/skills';
import { AnswerInput } from '../components/AnswerInput';
import { ProgressBar, TopBar } from '../components/common';
import { SessionDone } from './SessionDone';

const MAX_WRONG_NOTES = 60;

function describeInput(input: Input): string {
  if (input.q !== undefined) return `몫 ${input.q || '?'}, 나머지 ${input.r || 0}`;
  if (input.num !== undefined || input.den !== undefined) return `${input.whole ? `${input.whole}와 ` : ''}${input.num ?? ''}/${input.den ?? ''}`;
  return input.whole ?? input.value ?? '';
}

export function MathSession({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const settings = state.settings[profileId];
  const data = state.data[profileId];
  const [round, setRound] = useState(0);
  const today = useMemo(() => toDateKey(), []);
  const target = settings.missions.find((m) => m.type === 'math')?.target ?? 10;

  const queue = useMemo(() => {
    const done = data.days[today]?.progress.math ?? 0;
    const count = Math.max(target - done, 0) || 10;
    return buildMathQueue(settings.mathSkills, data.wrongNotes, count);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 채점으로 기록이 바뀌어도 문제 순서를 유지하고 새 라운드에서만 생성한다.
  }, [round]);

  const [index, setIndex] = useState(0);
  const [input, setInput] = useState<Input>({});
  // counted: 채점에 반영된 답인지 (입력 누락, 약분 안내는 반영하지 않고 다시 풀게 한다)
  const [feedback, setFeedback] = useState<{ correct: boolean; counted: boolean; message: string } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const wasCompleted = useRef(Boolean(data.days[today]?.completed));
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (settings.mathSkills.length === 0 && data.wrongNotes.length === 0) {
    return (
      <div className="page">
        <TopBar title="🔢 연산" onBack={() => go({ name: 'home', profileId })} />
        <p className="muted">보호자 모드에서 연산 단원을 켜 주세요.</p>
      </div>
    );
  }

  const finished = index >= queue.length;
  const item = queue[index];

  const next = () => {
    window.clearTimeout(timer.current);
    setFeedback(null);
    setInput({});
    setIndex((i) => i + 1);
  };

  const submit = () => {
    if (!item || feedback?.counted) return;
    window.clearTimeout(timer.current);
    const result = gradeAnswer(item.problem.answer, input);
    if (result.reason) {
      // 입력이 비었거나 약분만 안 한 경우: 기회를 한 번 더 준다.
      setFeedback({ correct: false, counted: false, message: result.reason });
      timer.current = window.setTimeout(() => setFeedback(null), 1600);
      return;
    }
    const correct = result.correct;
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    update((draft) => {
      const d = draft.data[profileId];
      applyProgress(d, draft.settings[profileId], today, {
        type: 'math',
        correct: correct ? 1 : 0,
        total: 1,
        skill: item.problem.skill,
      });
      if (correct && item.wrongId) {
        d.wrongNotes = d.wrongNotes.filter((w) => w.id !== item.wrongId);
      } else if (!correct && !item.wrongId) {
        d.wrongNotes.push({ id: uid(), problem: item.problem, addedAt: today, given: describeInput(input) });
        if (d.wrongNotes.length > MAX_WRONG_NOTES) d.wrongNotes.splice(0, d.wrongNotes.length - MAX_WRONG_NOTES);
      }
    });
    if (correct) {
      setFeedback({ correct: true, counted: true, message: '정답! ⭐' });
      timer.current = window.setTimeout(next, 700);
    } else {
      setFeedback({ correct: false, counted: true, message: `정답은 ${formatAnswer(item.problem)}` });
    }
  };

  if (finished) {
    const completedNow = !wasCompleted.current && Boolean(data.days[today]?.completed);
    return (
      <div className="page">
        <TopBar title="🔢 연산" onBack={() => go({ name: 'home', profileId })} />
        <SessionDone correct={score.correct} total={score.total} completedToday={completedNow} rewardLabel={settings.rewardLabel}>
          <button className="btn btn-primary" onClick={() => go({ name: 'home', profileId })}>
            미션 목록으로
          </button>
          <button
            className="btn btn-soft"
            onClick={() => {
              wasCompleted.current = Boolean(data.days[today]?.completed);
              setRound((r) => r + 1);
              setIndex(0);
              setScore({ correct: 0, total: 0 });
            }}
          >
            더 풀기
          </button>
        </SessionDone>
      </div>
    );
  }

  const skill = SKILL_MAP[item.problem.skill];
  const answered = Boolean(feedback?.counted);

  return (
    <div className="page">
      <TopBar
        title="🔢 연산"
        onBack={() => go({ name: 'home', profileId })}
        right={
          <span className="muted">
            {index + 1} / {queue.length}
          </span>
        }
      />
      <ProgressBar value={index} max={queue.length} color="#f97316" />
      <div className="question-card">
        <div className="question-tag">
          {item.wrongId && <span className="badge badge-warn">오답 다시 풀기</span>}
          {skill && (
            <span className="badge">
              {skill.term} {skill.label}
            </span>
          )}
        </div>
        <div className="question-text">{item.problem.question}</div>
        {item.problem.answer.kind === 'fraction' && <div className="muted small">기약분수로 답해요. 대분수는 자연수 칸도 채워요.</div>}
        <AnswerInput kind={item.problem.answer.kind} value={input} onChange={setInput} onSubmit={answered ? next : submit} disabled={answered} />
        {feedback && <div className={`feedback ${feedback.correct ? 'ok' : 'bad'}`}>{feedback.message}</div>}
        {answered && !feedback?.correct && item.problem.hint && <div className="hint">💡 {item.problem.hint}</div>}
        {answered && !feedback?.correct ? (
          <button className="btn btn-primary wide" onClick={next}>
            다음 문제
          </button>
        ) : (
          <button className="btn btn-primary wide" onClick={submit} disabled={answered}>
            확인
          </button>
        )}
      </div>
    </div>
  );
}
