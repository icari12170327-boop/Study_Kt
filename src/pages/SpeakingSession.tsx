import { RecognitionInput, useRecognition } from '../components/RecognitionInput';
import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import type { Go } from '../route';
import { toDateKey } from '../lib/date';
import { applyProgress } from '../lib/progress';
import { aiReady } from '../lib/talk';
import { reviewCard } from '../lib/srs';
import { speak } from '../lib/speech';
import { scoreSpeech, type SpeechScore } from '../lib/similarity';
import { buildSpeakingSession } from '../content/english/session';
import { ProgressBar, TopBar } from '../components/common';
import { SessionDone } from './SessionDone';

const PASS = 0.8;

export function SpeakingSession({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const settings = state.settings[profileId];
  const data = state.data[profileId];
  const today = useMemo(() => toDateKey(), []);
  const [round, setRound] = useState(0);
  const target = settings.missions.find((m) => m.type === 'speaking')?.target ?? 5;
  const recognition = useRecognition();
  const [keyboard, setKeyboard] = useState(false), [typed, setTyped] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const done = data.days[today]?.progress.speaking ?? 0;
    return buildSpeakingSession(settings.speakingDecks, data.srs, today, Math.max(target - done, 0) || 5, undefined, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 채점으로 복습 기록이 바뀌어도 문장 순서를 유지하고 새 라운드에서만 생성한다.
  }, [round]);

  const [index, setIndex] = useState(0);
  const [best, setBest] = useState<SpeechScore | null>(null);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const [hideKo, setHideKo] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const wasCompleted = useRef(Boolean(data.days[today]?.completed));

  if (items.length === 0) {
    return (
      <div className="page">
        <TopBar title="🗣️ 따라 말하기" onBack={() => go({ name: 'home', profileId })} />
        <p className="muted">보호자 모드에서 문장 세트를 켜 주세요.</p>
      </div>
    );
  }

  const item = items[index];

  if (!item) {
    const completedNow = !wasCompleted.current && Boolean(data.days[today]?.completed);
    return (
      <div className="page">
        <TopBar title="🗣️ 따라 말하기" onBack={() => go({ name: 'home', profileId })} />
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
            더 하기
          </button>
        </SessionDone>
      </div>
    );
  }

  const record = (passed: boolean) => {
    setScore((s) => ({ correct: s.correct + (passed ? 1 : 0), total: s.total + 1 }));
    update((draft) => {
      const d = draft.data[profileId];
      d.srs[item.key] = reviewCard(d.srs[item.key], passed, today);
      applyProgress(d, draft.settings[profileId], today, { type: 'speaking', correct: passed ? 1 : 0, total: 1 }, { aiReady: aiReady(draft.ai), profileId });
    });
    recognition.stop(); setTyped('');
    setBest(null);
    setHeard('');
    setError('');
    setIndex((i) => i + 1);
  };

  const evaluate = (alts: string[]) => {
    if (!alts.length) { setError('소리가 들리지 않았어요. 다시 말해 볼까요?'); return; }
    const scored = alts.map(text => ({ text, score: scoreSpeech(item.sentence.en, text) }));
    const top = scored.reduce((a, b) => b.score.score > a.score.score ? b : a);
    setHeard(top.text); setBest(previous => previous && previous.score >= top.score.score ? previous : top.score);
  };
  const startListening = async () => { setError(''); const alts = await recognition.listen(); if (alts) evaluate(alts); };

  const passed = (best?.score ?? 0) >= PASS;

  return (
    <div className="page">
      <TopBar
        title="🗣️ 따라 말하기"
        onBack={() => go({ name: 'home', profileId })}
        right={
          <span className="muted">
            {index + 1} / {items.length}
          </span>
        }
      />
      <ProgressBar value={index} max={items.length} color="#6366f1" />
      <div className="question-card">
        <span className="badge">{item.sentence.tag}</span>
        <div className="sentence-en">
          {best
            ? best.matched.map((w, i) => (
                <span key={i} className={w.ok ? 'w-ok' : 'w-miss'}>
                  {w.word}{' '}
                </span>
              ))
            : item.sentence.en}
        </div>
        <button className="link-btn" onClick={() => setHideKo(!hideKo)}>
          {hideKo ? '뜻 보기' : '뜻 가리기'}
        </button>
        {!hideKo && <div className="sentence-ko">{item.sentence.ko}</div>}

        <div className="row-center">
          <button className="btn btn-soft" onClick={() => speak(item.sentence.en)}>
            🔊 듣기
          </button>
          <button className="btn btn-soft" onClick={() => speak(item.sentence.en, { rate: 0.65 })}>
            🐢 천천히
          </button>
        </div>

        <RecognitionInput recognition={recognition} child={profileId !== 'parent'} onListen={() => { void startListening(); }} onKeyboard={() => { setKeyboard(true); requestAnimationFrame(() => input.current?.focus()); }} />
        {(keyboard || !recognition.available) && <form onSubmit={event => { event.preventDefault(); setError(''); if (typed.trim()) evaluate([typed]); }}>
          <label>따라 쓴 문장<input ref={input} value={typed} maxLength={300} onChange={event => setTyped(event.target.value)} /></label>
          <button className="btn btn-soft" disabled={!typed.trim()} type="submit">쓴 문장 확인</button>
        </form>}
        {error && <p className="error">{error}</p>}
        {best && <div className={`feedback ${passed ? 'ok' : 'bad'}`}>{passed ? `통과! ${Math.round(best.score * 100)}점 ⭐` : `${Math.round(best.score * 100)}점. 빨간 단어를 신경 써서 다시 해 봐요.`}{heard && <div className="small muted">확인한 문장: “{heard}”</div>}</div>}
        <div className="row-center">{passed ? <button className="btn btn-primary wide" onClick={() => record(true)}>다음 문장</button> : best && <button className="btn btn-ghost" onClick={() => record(false)}>건너뛰기 (내일 다시)</button>}</div>
      </div>
    </div>
  );
}
