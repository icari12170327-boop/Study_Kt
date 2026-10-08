import { useStore } from '../store/StoreContext';
import { deletePhrase, MY_PHRASES } from '../lib/business';
export function MyPhrases() {
  const { state, update } = useStore();
  const settings = state.settings.parent, cards = state.data.parent.customCards ?? [];
  const toggle = (field: 'vocabDecks' | 'speakingDecks', enabled: boolean) => update(draft => {
    const list = draft.settings.parent[field].filter(id => id !== MY_PHRASES);
    draft.settings.parent[field] = enabled ? [...list, MY_PHRASES] : list;
  });
  return <section className="panel form" aria-label="내 표현 관리">
    <h2>⭐ 내 표현 · {cards.length}장</h2>
    <label className="check"><input type="checkbox" checked={settings.vocabDecks.includes(MY_PHRASES)} onChange={event => toggle('vocabDecks', event.target.checked)} />내 표현 단어 복습 켜기</label>
    <label className="check"><input type="checkbox" checked={settings.speakingDecks.includes(MY_PHRASES)} onChange={event => toggle('speakingDecks', event.target.checked)} />내 표현 따라 말하기 켜기</label>
    {!cards.length && <p className="muted">코치 모드나 비즈니스 대화에서 표현을 저장해 주세요.</p>}
    {[...cards].reverse().map(card => <article className="business-expression" key={card.id}>
      <p lang="en"><strong>{card.en}</strong></p><p>{card.ko || '아직 뜻이 없어요. 같은 문장을 마무리에서 받으면 채워요.'}</p><p className="small muted">{card.source} · {card.createdAt.slice(0, 10)}</p>
      <button className="btn btn-ghost danger" aria-label={`${card.en} 삭제`} onClick={() => {
        if (confirm('이 표현과 단어·따라 말하기 복습 기록을 삭제할까요?')) update(draft => { deletePhrase(draft.data.parent, card.id); });
      }}>삭제</button>
    </article>)}
  </section>;
}
