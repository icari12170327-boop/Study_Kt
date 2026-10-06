import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId, QaCard, ReadingNote } from '../types';
import type { Go } from '../route';
import { toDateKey, formatKoreanDate } from '../lib/date';
import { applyProgress } from '../lib/progress';
import { pickSessionKeys, reviewCard, isDue } from '../lib/srs';
import { uid } from '../lib/random';
import { TopBar } from '../components/common';

const noteKey = (noteId: string, cardId: string) => `note:${noteId}:${cardId}`;

type View = { name: 'list' } | { name: 'edit'; note?: ReadingNote } | { name: 'view'; noteId: string } | { name: 'review' };

export function Reading({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state } = useStore();
  const profile = state.profiles.find((p) => p.id === profileId)!;
  const data = state.data[profileId];
  const [view, setView] = useState<View>({ name: 'list' });
  const today = toDateKey();
  const isAdult = profile.level === 'adult';
  const title = isAdult ? '📚 독서노트' : '📚 독서록';

  const allKeys = data.notes.flatMap((n) => n.cards.map((c) => noteKey(n.id, c.id)));
  const dueCount = allKeys.filter((k) => data.srs[k] === undefined || isDue(data.srs[k], today)).length;

  const back = () => (view.name === 'list' ? go({ name: 'home', profileId }) : setView({ name: 'list' }));

  return (
    <div className="page">
      <TopBar title={title} onBack={back} />
      {view.name === 'list' && (
        <>
          <div className="row-center">
            <button className="btn btn-primary" onClick={() => setView({ name: 'edit' })}>
              ✏️ 새 {isAdult ? '노트' : '독서록'} 쓰기
            </button>
            <button className="btn btn-soft" onClick={() => setView({ name: 'review' })} disabled={allKeys.length === 0}>
              🔁 복습하기 {dueCount > 0 && <span className="badge badge-warn">{dueCount}</span>}
            </button>
          </div>
          {data.notes.length === 0 && (
            <p className="muted center">
              {isAdult
                ? '읽은 책의 핵심을 요약하고, 기억하고 싶은 내용을 질문과 답으로 남겨 보세요. 질문 카드는 간격 반복으로 복습돼요.'
                : '읽은 책 제목과 느낀 점을 적어 보세요. 퀴즈를 만들면 나중에 복습할 수 있어요.'}
            </p>
          )}
          <div className="note-list">
            {data.notes.map((n) => (
              <button key={n.id} className="note-item" onClick={() => setView({ name: 'view', noteId: n.id })}>
                <div className="note-title">{n.title}</div>
                <div className="small muted">
                  {n.author && `${n.author} · `}
                  {formatKoreanDate(n.date)} · 질문 {n.cards.length}개
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {view.name === 'edit' && <NoteEditor profileId={profileId} isAdult={isAdult} note={view.note} onDone={() => setView({ name: 'list' })} />}
      {view.name === 'view' && <NoteView profileId={profileId} noteId={view.noteId} onEdit={(note) => setView({ name: 'edit', note })} onClose={() => setView({ name: 'list' })} />}
      {view.name === 'review' && <NoteReview profileId={profileId} allKeys={allKeys} onDone={() => setView({ name: 'list' })} />}
    </div>
  );
}

function NoteEditor({ profileId, isAdult, note, onDone }: { profileId: ProfileId; isAdult: boolean; note?: ReadingNote; onDone: () => void }) {
  const { update } = useStore();
  const [title, setTitle] = useState(note?.title ?? '');
  const [author, setAuthor] = useState(note?.author ?? '');
  const [summary, setSummary] = useState(note?.summary ?? '');
  const [cards, setCards] = useState<QaCard[]>(note?.cards.length ? note.cards : [{ id: uid(), q: '', a: '' }]);

  const save = () => {
    const today = toDateKey();
    const clean = cards.filter((c) => c.q.trim() && c.a.trim()).map((c) => ({ ...c, q: c.q.trim(), a: c.a.trim() }));
    update((draft) => {
      const d = draft.data[profileId];
      if (note) {
        const target = d.notes.find((n) => n.id === note.id);
        if (target) Object.assign(target, { title: title.trim(), author: author.trim(), summary: summary.trim(), cards: clean });
      } else {
        d.notes.unshift({ id: uid(), title: title.trim(), author: author.trim(), date: today, summary: summary.trim(), cards: clean });
        applyProgress(d, draft.settings[profileId], today, { type: 'reading' });
      }
    });
    onDone();
  };

  return (
    <div className="form">
      <label>
        책 제목
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 어린 왕자" />
      </label>
      <label>
        지은이 (선택)
        <input value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <label>
        {isAdult ? '핵심 요약' : '줄거리와 느낀 점'}
        <textarea rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={isAdult ? '이 책에서 가져갈 핵심 3가지는?' : '가장 기억에 남는 장면은? 왜 그렇게 생각했나요?'} />
      </label>
      <div className="form-label">기억할 질문과 답 (복습 카드)</div>
      {cards.map((c, i) => (
        <div key={c.id} className="qa-row">
          <input value={c.q} placeholder={`질문 ${i + 1}`} onChange={(e) => setCards(cards.map((x) => (x.id === c.id ? { ...x, q: e.target.value } : x)))} />
          <input value={c.a} placeholder="답" onChange={(e) => setCards(cards.map((x) => (x.id === c.id ? { ...x, a: e.target.value } : x)))} />
          <button className="icon-btn" aria-label="삭제" onClick={() => setCards(cards.filter((x) => x.id !== c.id))}>
            ✕
          </button>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={() => setCards([...cards, { id: uid(), q: '', a: '' }])}>
        + 질문 추가
      </button>
      <button className="btn btn-primary wide" onClick={save} disabled={!title.trim()}>
        저장
      </button>
    </div>
  );
}

function NoteView({ profileId, noteId, onEdit, onClose }: { profileId: ProfileId; noteId: string; onEdit: (n: ReadingNote) => void; onClose: () => void }) {
  const { state, update } = useStore();
  const note = state.data[profileId].notes.find((n) => n.id === noteId);
  if (!note) return null;
  const remove = () => {
    if (!confirm(`'${note.title}' 노트를 삭제할까요?`)) return;
    update((draft) => {
      const d = draft.data[profileId];
      d.notes = d.notes.filter((n) => n.id !== noteId);
      for (const c of note.cards) delete d.srs[noteKey(noteId, c.id)];
    });
    onClose();
  };
  return (
    <div className="question-card left">
      <h2>{note.title}</h2>
      <div className="small muted">
        {note.author && `${note.author} · `}
        {formatKoreanDate(note.date)}
      </div>
      <p className="pre">{note.summary}</p>
      {note.cards.map((c) => (
        <div key={c.id} className="qa-view">
          <div>Q. {c.q}</div>
          <div className="muted">A. {c.a}</div>
        </div>
      ))}
      <div className="row-center">
        <button className="btn btn-soft" onClick={() => onEdit(note)}>
          수정
        </button>
        <button className="btn btn-ghost danger" onClick={remove}>
          삭제
        </button>
      </div>
    </div>
  );
}

function NoteReview({ profileId, allKeys, onDone }: { profileId: ProfileId; allKeys: string[]; onDone: () => void }) {
  const { state, update } = useStore();
  const data = state.data[profileId];
  const today = useMemo(() => toDateKey(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 복습 중 SRS 기록이 바뀌어도 처음 선택한 카드 순서를 유지한다.
  const keys = useMemo(() => pickSessionKeys(allKeys, data.srs, today, 10), []);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const lookup = (key: string) => {
    const [, noteId, cardId] = key.split(':');
    const note = data.notes.find((n) => n.id === noteId);
    return { note, card: note?.cards.find((c) => c.id === cardId) };
  };

  if (index >= keys.length) {
    return (
      <div className="done">
        <div className="done-emoji">🧠</div>
        <h2>복습 완료!</h2>
        <button className="btn btn-primary" onClick={onDone}>
          목록으로
        </button>
      </div>
    );
  }

  const { note, card } = lookup(keys[index]);
  const answer = (known: boolean) => {
    update((draft) => {
      const d = draft.data[profileId];
      d.srs[keys[index]] = reviewCard(d.srs[keys[index]], known, today);
      // 복습 세션의 첫 카드에서 독서 미션 1회를 인정한다.
      if (index === 0) applyProgress(d, draft.settings[profileId], today, { type: 'reading', correct: known ? 1 : 0, total: 1 });
    });
    setRevealed(false);
    setIndex(index + 1);
  };

  return (
    <div className="question-card">
      <div className="small muted">
        {note?.title} · {index + 1} / {keys.length}
      </div>
      <div className="question-text small-text">{card?.q}</div>
      {revealed ? (
        <>
          <div className="answer-reveal">{card?.a}</div>
          <div className="row-center">
            <button className="btn btn-primary" onClick={() => answer(true)}>
              알고 있었어요
            </button>
            <button className="btn btn-ghost" onClick={() => answer(false)}>
              몰랐어요
            </button>
          </div>
        </>
      ) : (
        <button className="btn btn-soft wide" onClick={() => setRevealed(true)}>
          정답 보기
        </button>
      )}
    </div>
  );
}
