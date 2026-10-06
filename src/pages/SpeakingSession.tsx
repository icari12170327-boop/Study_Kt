import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import type { Go } from '../route';
import { toDateKey } from '../lib/date';
import { applyProgress } from '../lib/progress';
import { pickSessionKeys, reviewCard } from '../lib/srs';
import { shuffle } from '../lib/random';
import { canRecognize, listenOnce, speak, type ListenHandle } from '../lib/speech';
import { scoreSpeech, type SpeechScore } from '../lib/similarity';
import { SENTENCE_DECK_MAP, speakKey, type Sentence } from '../content/english/sentences';
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
  const supported = useMemo(canRecognize, []);

  const items = useMemo(() => {
    const byKey = new Map<string, Sentence>();
    for (const id of settings.speakingDecks) {
      const deck = SENTENCE_DECK_MAP[id];
      if (deck) for (const s of deck.sentences) byKey.set(speakKey(id, s.id), s);
    }
    const done = data.days[today]?.progress.speaking ?? 0;
    const keys = pickSessionKeys([...byKey.keys()], data.srs, today, Math.max(target - done, 0) || 5);
    return shuffle(keys).map((key) => ({ key, sentence: byKey.get(key)! }));
    // 라운드를 시작할 때 한 번만 만든다.
  }, [round]);

  const [index, setIndex] = useState(0);
  const [best, setBest] = useState<SpeechScore | null>(null);
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [hideKo, setHideKo] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const handle = useRef<ListenHandle | null>(null);
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
      applyProgress(d, draft.settings[profileId], today, { type: 'speaking', correct: passed ? 1 : 0, total: 1 });
    });
    setBest(null);
    setHeard('');
    setError('');
    setIndex((i) => i + 1);
  };

  const startListening = async () => {
    setError('');
    setListening(true);
    handle.current = listenOnce('en-US');
    try {
      const alts = await handle.current.promise;
      if (alts.length === 0) {
        setError('소리가 들리지 않았어요. 다시 말해 볼까요?');
        return;
      }
      const scored = alts.map((a) => ({ text: a, s: scoreSpeech(item.sentence.en, a) }));
      const top = scored.reduce((a, b) => (b.s.score > a.s.score ? b : a));
      setHeard(top.text);
      setBest((prev) => (prev && prev.score >= top.s.score ? prev : top.s));
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'not-allowed' ? '마이크 권한을 허용해 주세요.' : '음성 인식에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setListening(false);
    }
  };

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

        {supported ? (
          <>
            <button
              className={`btn btn-mic ${listening ? 'on' : ''}`}
              onClick={() => (listening ? handle.current?.stop() : startListening())}
            >
              {listening ? '듣고 있어요… (누르면 멈춤)' : '🎤 말하기'}
            </button>
            {error && <p className="error">{error}</p>}
            {best && (
              <div className={`feedback ${passed ? 'ok' : 'bad'}`}>
                {passed ? `통과! ${Math.round(best.score * 100)}점 ⭐` : `${Math.round(best.score * 100)}점. 빨간 단어를 신경 써서 다시 해 봐요.`}
                {heard && <div className="small muted">들린 문장: “{heard}”</div>}
              </div>
            )}
            <div className="row-center">
              {passed ? (
                <button className="btn btn-primary wide" onClick={() => record(true)}>
                  다음 문장
                </button>
              ) : (
                best && (
                  <button className="btn btn-ghost" onClick={() => record(false)}>
                    건너뛰기 (내일 다시)
                  </button>
                )
              )}
            </div>
          </>
        ) : (
          <>
            <p className="small muted">이 브라우저는 음성 인식을 지원하지 않아요. 크게 따라 말한 뒤 스스로 체크해요. (Chrome 권장)</p>
            <div className="row-center">
              <button className="btn btn-primary" onClick={() => record(true)}>
                잘 말했어요 👍
              </button>
              <button className="btn btn-ghost" onClick={() => record(false)}>
                어려웠어요
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
