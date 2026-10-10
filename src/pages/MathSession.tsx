import { WordProblemText } from '../components/WordProblemText';
import { useWordProblemQueue } from '../components/useWordProblemQueue';
import { withoutStory } from '../content/math/wordProblem';
import { canSpeak } from '../lib/speech';
import { canPlay } from '../content/games/limits';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import type { Go } from '../route';
import { toDateKey } from '../lib/date';
import { applyProgress } from '../lib/progress';
import { aiReady } from '../lib/talk';
import { uid } from '../lib/random';
import { buildLevelQueue } from '../content/math/session';
import { evaluateLevel, latestMathDay, mathAttempt } from '../content/math/adaptive';
import { gradeAnswer, type AnswerInput as Input } from '../content/math/grading';
import { formatAnswer, SKILL_MAP } from '../content/math/skills';
import { NumberPad } from '../components/NumberPad';
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
  const grade = state.profiles.find((profile) => profile.id === profileId)!.level;
  const [round, setRound] = useState(0);
  const today = useMemo(() => toDateKey(), []);
  const target = settings.missions.find((m) => m.type === 'math')?.target ?? 20;
  const evaluated = useMemo(() => evaluateLevel(data.math, latestMathDay(data.days, today), today, grade),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 화면 진입 때 전날 평가를 먼저 적용하고 세션 중에는 레벨을 고정한다.
    []);

  useEffect(() => {
    update((draft) => {
      const profileData = draft.data[profileId];
      profileData.math = evaluateLevel(profileData.math, latestMathDay(profileData.days, today), today, grade);
    });
  }, [profileId, today, grade, update]);

  const baseQueue = useMemo(() => {
    const done = data.days[today]?.progress.math ?? 0;
    const count = Math.max(target - done, 0) || target;
    return buildLevelQueue(grade, evaluated.level, data.wrongNotes, count);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 채점으로 기록이 바뀌어도 문제 순서를 유지하고 새 라운드에서만 생성한다.
  }, [round]);

  const [index, setIndex] = useState(0);
  const [input, setInput] = useState<Input>({});
  // counted: 채점에 반영된 답인지 (입력 누락, 약분 안내는 반영하지 않고 다시 풀게 한다)
  const [feedback, setFeedback] = useState<{ correct: boolean; counted: boolean; message: string } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const wasCompleted = useRef(Boolean(data.days[today]?.completed));
  const timer = useRef<number | undefined>(undefined);
  const events = useRef<number[]>([]);
  const attempted = useRef(false);
  const nextButton = useRef<HTMLButtonElement>(null);
  const [guesses, setGuesses] = useState(0);
  const queue = useWordProblemQueue(baseQueue, index, state.ai, profileId, grade, settings.wordProblemRatio, settings.talk?.interests);

  useEffect(() => {
    events.current = [performance.now()];
    attempted.current = false;
  }, [index, round]);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => () => { if (canSpeak()) window.speechSynthesis.cancel(); }, [index, round]);

  const finished = index >= queue.length;
  const item = queue[index];

  const next = () => {
    if (!attempted.current) return;
    attempted.current = false;
    window.clearTimeout(timer.current);
    setFeedback(null);
    setInput({});
    setIndex((i) => i + 1);
  };

  const submit = () => {
    if (!item || attempted.current) return;
    events.current.push(performance.now());
    window.clearTimeout(timer.current);
    const result = gradeAnswer(item.problem.answer, input);
    if (result.reason) {
      // 입력이 비었거나 약분만 안 한 경우: 기회를 한 번 더 준다.
      setFeedback({ correct: false, counted: false, message: result.reason });
      timer.current = window.setTimeout(() => setFeedback(null), 1600);
      return;
    }
    const correct = result.correct;
    attempted.current = true;
    const attempt = mathAttempt(item.problem.skill, correct, events.current, !!item.problem.story);
    if (attempt.guessed) setGuesses((count) => count + 1);
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    update((draft) => {
      const d = draft.data[profileId];
      applyProgress(d, draft.settings[profileId], today, {
        type: 'math',
        correct: correct ? 1 : 0,
        total: 1,
        skill: item.problem.skill,
      }, { aiReady: aiReady(draft.ai), profileId });
      d.days[today].mathAttempts.push({ ...attempt, problem: withoutStory(item.problem) });
      if (correct && item.wrongId) {
        d.wrongNotes = d.wrongNotes.filter((w) => w.id !== item.wrongId);
      } else if (!correct && !item.wrongId) {
        d.wrongNotes.push({ id: uid(), problem: withoutStory(item.problem), addedAt: today, given: describeInput(input) });
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
      <div className="page math-session">
        <TopBar title="🔢 수학 도전" onBack={() => go({ name: 'home', profileId })} />
        <SessionDone correct={score.correct} total={score.total} completedToday={completedNow} rewardLabel={settings.rewardLabel}>
          {profileId !== 'parent' && grade !== 'adult' && canPlay(settings, data, today).ok && <button className="btn btn-primary" onClick={() => go({ name: 'games', profileId, game: 'fishing' })}>🎣 게임 열림!</button>}
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
              setGuesses(0);
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
    <div className="page math-session">
      <TopBar
        title="🔢 수학 도전"
        onBack={() => go({ name: 'home', profileId })}
        right={
          <span className="muted">
            {index + 1} / {queue.length}
          </span>
        }
      />
      <div className="math-level"><strong>레벨 {evaluated.level}</strong><span className="small muted">천천히, 차근차근 풀어요</span></div>
      <ProgressBar value={index} max={queue.length} color="#f97316" />
      <div className="question-card">
        <div className="question-tag">
          {item.problem.story && <span className="badge">📖 문장제</span>}
          {item.wrongId && <span className="badge badge-warn">오답 다시 풀기</span>}
          {skill && (
            <span className="badge">
              {skill.term} {skill.label}
            </span>
          )}
        </div>
        {item.problem.story ? <WordProblemText story={item.problem.story} /> : <div className="question-text">{item.problem.question}</div>}
        {item.problem.answer.kind === 'fraction' && <div className="muted small">기약분수로 답해요. 대분수는 자연수 칸도 채워요.</div>}
        <NumberPad key={`${round}-${index}`} kind={item.problem.answer.kind} value={input} onChange={setInput}
          onSubmit={submit} onNext={next} nextButtonRef={nextButton} onActivity={() => events.current.push(performance.now())} disabled={answered} />
        {feedback && <div role="status" className={`feedback ${feedback.correct ? 'ok math-success' : 'bad'}`}>{feedback.message}</div>}
        {guesses >= 3 && <p className="guess-notice" role="status">천천히 생각해도 괜찮아! 빨리 틀리면 점수에 안 들어가 🙂</p>}
        {answered && !feedback?.correct && item.problem.hint && <div className="hint">💡 {item.problem.hint}</div>}
        {answered && !feedback?.correct ? (
          <button ref={nextButton} className="btn btn-primary wide" onClick={next}>
            다음 문제
          </button>
        ) : null}
      </div>
    </div>
  );
}
