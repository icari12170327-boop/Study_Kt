import { useEffect, useRef, useState } from 'react';
import { STORIES } from '../content/stories';
import { answerKey, canOpenNext, initialStoryProgress, normalizeStorySettings, openNext, QUESTION_TYPE_LABEL, recordAnswer, startStory, storyCardState } from '../content/stories/progress';
import { storyKeyAction } from '../content/stories/keyboard';
import type { Story, StoryEpisode, StoryProgress } from '../content/stories/types';
import { useStoryDate } from '../components/stories/useStoryDate';
import { TopBar } from '../components/common';
import { canSpeak, speak } from '../lib/speech';
import { toDateKey } from '../lib/date';
import { useStore } from '../store/StoreContext';
import type { Go } from '../route';
import type { ProfileId } from '../types';

export function StoryReading({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const today = useStoryDate();
  const [storyId, setStoryId] = useState<string>();
  const [episodeN, setEpisodeN] = useState<number>();
  const enabled = profileId !== 'parent' && state.profiles.find(p => p.id === profileId)?.level !== 'adult' && normalizeStorySettings(state.settings[profileId].stories).enabled;
  const saved = state.data[profileId].stories;
  useEffect(() => {
    if (!enabled || !STORIES.some(story => saved?.[story.id] && canOpenNext(saved[story.id], today, story.episodes.length))) return;
    update(draft => {
      const records = draft.data[profileId].stories ??= {};
      for (const story of STORIES) if (records[story.id]) records[story.id] = openNext(records[story.id], today, story.episodes.length);
    });
  }, [enabled, saved, today, profileId, update]);

  const story = STORIES.find(row => row.id === storyId);
  const progress = story ? openNext(saved?.[story.id] ?? initialStoryProgress(), today, story.episodes.length) : undefined;
  const episode = story?.episodes.find(row => row.n === episodeN);
  const back = () => {
    if (episodeN !== undefined) setEpisodeN(undefined);
    else if (storyId !== undefined) setStoryId(undefined);
    else go({ name: 'home', profileId });
  };
  return <div className="page story-page">
    <TopBar title={episode ? `${episode.n}화 · ${episode.title}` : story?.title ?? '📖 이야기'} onBack={back} />
    {!enabled ? <section className="panel"><p>지금은 이야기가 꺼져 있어요.</p><button className="btn btn-primary" onClick={() => go({ name: 'home', profileId })}>홈으로</button></section> : story && progress ? episode && episode.n <= progress.unlocked ?
      <EpisodeReader key={`${story.id}-${episode.n}`} story={story} episode={episode} progress={progress} onBack={() => setEpisodeN(undefined)} onAnswer={(index, correct) => update(draft => {
        const records = draft.data[profileId].stories ??= {};
        const current = openNext(records[story.id] ?? initialStoryProgress(), toDateKey(), story.episodes.length);
        records[story.id] = recordAnswer(current, story, episode.n, index, correct, toDateKey());
      })} /> : <>
        <p className="muted">이미 열린 화는 언제든 다시 읽을 수 있어요.</p>
        {story.episodes.map(row => <button key={row.n} className="btn btn-soft story-episode-link" disabled={row.n > progress.unlocked} onClick={() => {
          update(draft => {
            const records = draft.data[profileId].stories ??= {};
            records[story.id] = startStory(openNext(records[story.id] ?? initialStoryProgress(), today, story.episodes.length), today);
          });
          setEpisodeN(row.n);
        }}><span>{row.n}화 · {row.title}</span><span>{row.n <= progress.finished ? '✓ 다시 읽기' : row.n <= progress.unlocked ? '읽기' : row.n === progress.unlocked + 1 && progress.finished === progress.unlocked ? '내일 열려요 🔒' : '🔒'}</span></button>)}
        {progress.finished > 0 && <section className="panel"><h3>{progress.finished === story.episodes.length ? '이야기 끝! 🎉' : progress.finished < progress.unlocked ? '다음 화가 열렸어요!' : '다음 화는 내일 열려요 🔒'}</h3><p>{story.episodes[progress.finished - 1].teaser}</p></section>}
      </> : <>
        <p>다음 화가 궁금한 자유 놀이예요. 별과 쿠폰은 바뀌지 않아요.</p>
        <h2 className="section-title">이야기 목록</h2>
        {STORIES.filter(row => (saved?.[row.id]?.finished ?? 0) < row.episodes.length).map(row => <StoryBook key={row.id} story={row} status={storyCardState(saved?.[row.id], today, row.episodes.length)} onOpen={() => setStoryId(row.id)} />)}
        <h2 className="section-title">다 읽은 이야기</h2>
        {STORIES.filter(row => saved?.[row.id]?.finished === row.episodes.length).map(row => <StoryBook key={row.id} story={row} status="finished" onOpen={() => setStoryId(row.id)} />)}
        {!STORIES.some(row => saved?.[row.id]?.finished === row.episodes.length) && <p className="muted">끝까지 읽은 이야기가 여기에 모여요.</p>}
      </>}
  </div>;
}

function StoryBook({ story, status, onOpen }: { story: Story; status: string; onOpen: () => void }) {
  const labels: Record<string, string> = { new: '새 화 열림!', reading: '이어서 읽기', 'locked-until-tomorrow': '다음 화는 내일 · 다시 읽기', finished: '이야기 끝! 🎉 · 다시 읽기' };
  return <button className="panel story-book" onClick={onOpen}><span aria-hidden="true">📖</span><strong>{story.title}</strong><span>{story.episodes.length}화 · {labels[status]}</span></button>;
}

export function EpisodeReader({ story, episode, progress, onAnswer, onBack }: {
  story: Story; episode: StoryEpisode; progress: StoryProgress;
  onAnswer: (index: number, correct: boolean) => void; onBack: () => void;
}) {
  const [index, setIndex] = useState(() => {
    const unfinished = episode.questions.findIndex((_q, i) => !progress.answers[answerKey(episode.n, i)]?.includes(true));
    return unfinished < 0 ? 0 : unfinished;
  });
  const [selected, setSelected] = useState<number>();
  const [feedback, setFeedback] = useState<'wrong' | 'correct'>();
  const [reading, setReading] = useState<number>();
  const cursor = useRef(index), submitted = useRef(false), voiceRequest = useRef(0);
  const evidence = useRef<HTMLDivElement>(null), quiz = useRef<HTMLElement>(null);
  const question = episode.questions[index];
  const submit = (choice = selected) => {
    if (!question || choice === undefined || !question.choices[choice] || submitted.current || cursor.current !== index) return;
    submitted.current = true;
    setSelected(choice);
    const correct = choice === question.answer;
    onAnswer(index, correct);
    setFeedback(correct ? 'correct' : 'wrong');
  };
  const retry = () => {
    if (feedback !== 'wrong' || !submitted.current) return;
    submitted.current = false; setFeedback(undefined); setSelected(undefined);
  };
  const next = () => {
    if (feedback !== 'correct' || cursor.current !== index || !submitted.current) return;
    submitted.current = false; cursor.current++; setIndex(cursor.current); setSelected(undefined); setFeedback(undefined);
  };
  const read = async (paragraph: number) => {
    const request = ++voiceRequest.current;
    if (reading === paragraph) { window.speechSynthesis.cancel(); setReading(undefined); return; }
    setReading(paragraph);
    try { await speak(episode.paragraphs[paragraph], { lang: 'ko-KR' }); }
    finally { if (voiceRequest.current === request) setReading(undefined); }
  };
  useEffect(() => () => {
    voiceRequest.current++;
    if (canSpeak()) window.speechSynthesis.cancel();
  }, []);
  useEffect(() => {
    if (feedback === 'wrong') evidence.current?.scrollIntoView({ block: 'center' });
  }, [feedback]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return;
      if (document.querySelector('.modal-backdrop, [aria-modal="true"], dialog[open]')) return;
      for (const element of [event.target instanceof Element ? event.target : null, document.activeElement]) {
        if (element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
        const control = element?.closest('button, a[href], [role="button"], [role="link"], summary');
        if (event.key === 'Enter' && control && !quiz.current?.contains(control)) return;
      }
      const focused = document.activeElement?.closest<HTMLElement>('[data-story-choice]');
      const choice = focused && quiz.current?.contains(focused) ? Number(focused.dataset.storyChoice) : selected;
      const action = storyKeyAction(event.key, question ? feedback ?? 'question' : 'done', choice);
      if (!action) return;
      event.preventDefault();
      if (event.repeat) return;
      if (action.type === 'choose') {
        setSelected(action.choice);
        quiz.current?.querySelector<HTMLButtonElement>(`[data-story-choice="${action.choice}"]`)?.focus();
      }
      else if (action.type === 'submit') submit(choice);
      else if (action.type === 'retry') retry();
      else next();
    };
    // 보기형 입력에는 이 리스너 하나만 붙인다. 화면을 나가면 반드시 제거한다.
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  return <>
    <article className="story-text" aria-label={`${episode.n}화 이야기 본문`}>
      {episode.image && <img className="story-image" src={episode.image} alt="" />}
      {episode.paragraphs.map((paragraph, i) => <div key={i} ref={feedback === 'wrong' && question?.paragraph === i ? evidence : undefined}
        className={`story-paragraph ${feedback === 'wrong' && question?.paragraph === i ? 'story-evidence' : ''}`}>
        {feedback === 'wrong' && question?.paragraph === i && <strong className="story-evidence-label">여기서 답을 찾아봐요</strong>}
        <p>{paragraph}</p><button className="btn btn-soft" disabled={!canSpeak()} aria-label={`${i + 1}문단 ${reading === i ? '읽기 멈추기' : '읽어 주기'}`} onClick={() => { void read(i); }}>{reading === i ? '⏹ 멈추기' : `🔊 ${i + 1}문단 읽어 주기`}</button>
      </div>)}
    </article>
    {question ? <section className="panel story-quiz" ref={quiz} aria-label="이야기 문제">
      <p className="small muted">문제 {index + 1} / {episode.questions.length} · {QUESTION_TYPE_LABEL[question.type]}</p>
      <h2>{question.q}</h2><p className="small muted">1~4로 고르고 Enter로 확인해요.</p>
      <div className="story-options" role="group" aria-label="보기 네 개">{question.choices.map((choice, i) => <button key={i} className={`story-choice ${selected === i ? 'selected' : ''}`}
        data-story-choice={i} aria-pressed={selected === i} disabled={feedback !== undefined} onClick={() => setSelected(i)}><span className="badge">{i + 1}</span>{choice}</button>)}</div>
      {feedback ? <div className="story-feedback" role="status"><h3>{feedback === 'correct' ? '✅ 맞았어요!' : '본문을 다시 살펴봐요.'}</h3>
        <p>{question.explain}</p>
        <button className="btn btn-primary wide" onClick={feedback === 'wrong' ? retry : next}>{feedback === 'wrong' ? '다시 풀기' : index + 1 === episode.questions.length ? '예고 보기' : '다음 문제'} · Enter</button>
      </div> : <button className="btn btn-primary wide" disabled={selected === undefined} onClick={() => submit()}>확인 · Enter</button>}
    </section> : <section className="panel story-ending" role="status"><h2>{episode.n === story.episodes.length ? '이야기 끝! 🎉' : episode.n < progress.unlocked ? '다음 화가 열렸어요!' : '내일 열려요 🔒'}</h2>
      <p>{episode.teaser}</p><button className="btn btn-primary" onClick={onBack}>화 목록으로</button>
    </section>}
  </>;
}
