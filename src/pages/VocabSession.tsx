import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import type { Go } from '../route';
import { toDateKey } from '../lib/date';
import { applyProgress } from '../lib/progress';
import { aiReady } from '../lib/talk';
import { reviewCard } from '../lib/srs';
import { speak } from '../lib/speech';
import { buildVocabSession } from '../content/english/session';
import { ProgressBar, SpeakButton, TopBar } from '../components/common';
import { SessionDone } from './SessionDone';

export function VocabSession({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const settings = state.settings[profileId];
  const data = state.data[profileId];
  const today = useMemo(() => toDateKey(), []);
  const [round, setRound] = useState(0);
  const target = settings.missions.find((m) => m.type === 'vocab')?.target ?? 10;

  const items = useMemo(() => {
    const done = data.days[today]?.progress.vocab ?? 0;
    return buildVocabSession(settings.vocabDecks, data.srs, today, Math.max(target - done, 0) || 10, undefined, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 복습 기록이 바뀌어도 단어 순서를 유지하고 새 라운드에서만 생성한다.
  }, [round]);

  const [index, setIndex] = useState(0);
  const [learning, setLearning] = useState(true);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const wasCompleted = useRef(Boolean(data.days[today]?.completed));

  const item = items[index];
  const showIntro = item?.isNew && learning;

  useEffect(() => {
    if (!item) return;
    if (showIntro || item.mode === 'meaning' || item.mode === 'listen') void speak(item.card.en);
  }, [item, showIntro]);

  if (items.length === 0) {
    return (
      <div className="page">
        <TopBar title="🔤 영어 단어" onBack={() => go({ name: 'home', profileId })} />
        <p className="muted">보호자 모드에서 단어장을 켜 주세요.</p>
      </div>
    );
  }

  if (!item) {
    const completedNow = !wasCompleted.current && Boolean(data.days[today]?.completed);
    return (
      <div className="page">
        <TopBar title="🔤 영어 단어" onBack={() => go({ name: 'home', profileId })} />
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
              setLearning(true);
              setScore({ correct: 0, total: 0 });
            }}
          >
            더 하기
          </button>
        </SessionDone>
      </div>
    );
  }

  const answer = item.mode === 'meaning' ? item.card.ko : item.card.en;

  const choose = (opt: string) => {
    if (chosen) return;
    setChosen(opt);
    const correct = opt === answer;
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    update((draft) => {
      const d = draft.data[profileId];
      d.srs[item.key] = reviewCard(d.srs[item.key], correct, today);
      applyProgress(d, draft.settings[profileId], today, { type: 'vocab', correct: correct ? 1 : 0, total: 1 }, { aiReady: aiReady(draft.ai) });
    });
    if (item.mode !== 'meaning') void speak(item.card.en);
  };

  const next = () => {
    setChosen(null);
    setLearning(true);
    setIndex((i) => i + 1);
  };

  return (
    <div className="page">
      <TopBar
        title="🔤 영어 단어"
        onBack={() => go({ name: 'home', profileId })}
        right={
          <span className="muted">
            {index + 1} / {items.length}
          </span>
        }
      />
      <ProgressBar value={index} max={items.length} color="#10b981" />

      {showIntro ? (
        <div className="question-card">
          <span className="badge badge-new">새 단어</span>
          <div className="word-emoji">{item.card.emoji}</div>
          <div className="word-en">{item.card.en}</div>
          <div className="word-ko">{item.card.ko}</div>
          {item.card.example && <div className="word-example">“{item.card.example}”</div>}
          <div className="row-center">
            <SpeakButton onClick={() => speak(item.card.en)} />
            {item.card.example && <SpeakButton label="예문 듣기" onClick={() => speak(item.card.example!)} />}
          </div>
          <button className="btn btn-primary wide" onClick={() => setLearning(false)}>
            외웠어요! 문제 풀기
          </button>
        </div>
      ) : (
        <div className="question-card">
          {item.mode === 'meaning' && (
            <>
              <div className="question-sub">이 단어의 뜻은?</div>
              <div className="word-en">{item.card.en}</div>
              <SpeakButton onClick={() => speak(item.card.en)} />
            </>
          )}
          {item.mode === 'reverse' && (
            <>
              <div className="question-sub">영어로 하면?</div>
              <div className="word-emoji">{item.card.emoji}</div>
              <div className="word-ko big">{item.card.ko}</div>
            </>
          )}
          {item.mode === 'listen' && (
            <>
              <div className="question-sub">잘 듣고 알맞은 단어를 골라요</div>
              <button className="btn btn-listen" onClick={() => speak(item.card.en)}>
                🔊
              </button>
              <button className="btn btn-ghost small" onClick={() => speak(item.card.en, { rate: 0.6 })}>
                🐢 천천히
              </button>
            </>
          )}
          <div className="options">
            {item.options.map((opt) => {
              const cls = !chosen ? '' : opt === answer ? 'ok' : opt === chosen ? 'bad' : 'dim';
              return (
                <button key={opt} className={`option ${cls}`} onClick={() => choose(opt)} disabled={Boolean(chosen)}>
                  {opt}
                </button>
              );
            })}
          </div>
          {chosen && (
            <>
              <div className={`feedback ${chosen === answer ? 'ok' : 'bad'}`}>
                {chosen === answer ? '정답! ⭐' : '아쉬워요. 내일 다시 나와요.'} {item.card.emoji} {item.card.en} = {item.card.ko}
              </div>
              <button className="btn btn-primary wide" onClick={next}>
                다음
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
