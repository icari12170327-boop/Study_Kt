import { SENTENCE_DECK_MAP, speakKey, type Sentence } from './sentences';
import type { ProfileData, SrsCard } from '../../types';
import { pick, shuffle, type Rng, defaultRng } from '../../lib/random';
import { pickSessionKeys } from '../../lib/srs';
import { getVocabCards, VOCAB_DECKS, vocabKey, type VocabCard } from './vocab';

export type VocabMode = 'meaning' | 'reverse' | 'listen';

export interface VocabItem {
  key: string;
  card: VocabCard;
  mode: VocabMode;
  /** 보기 4개 (정답 포함), meaning 모드는 뜻, 나머지는 영어 */
  options: string[];
  isNew: boolean;
}

export function buildVocabSession(
  deckIds: readonly string[],
  srs: Record<string, SrsCard>,
  today: string,
  count: number,
  rng: Rng = defaultRng,
  data: Pick<ProfileData, 'customCards'> = {},
): VocabItem[] {
  const byKey = new Map<string, { deckId: string; card: VocabCard }>();
  for (const id of deckIds) for (const card of getVocabCards(id, data)) {
    // 코치 대화 중 저장한 문장은 한국어 뜻을 받은 뒤 단어 문제에 넣는다.
    if (id === 'my-phrases' && !card.ko.trim()) continue;
    byKey.set(vocabKey(id, card.id), { deckId: id, card });
  }

  const keys = englishSessionKeys([...byKey.keys()], srs, today, count);
  return shuffle(keys, rng).map((key) => {
    const { deckId, card } = byKey.get(key)!;
    const isNew = srs[key] === undefined;
    // 처음 보는 단어는 쉬운 '뜻 고르기'로, 익숙해지면 듣기와 영어 고르기를 섞는다.
    const mode: VocabMode = isNew ? 'meaning' : pick(['meaning', 'reverse', 'listen'] as const, rng);
    const field = mode === 'meaning' ? 'ko' : 'en';
    const choices = getVocabCards(deckId, data).filter(c => c.id !== card.id);
    // 내 표현이 적어도 성인용 정적 덱에서 보기 3개를 채운다.
    if (deckId === 'my-phrases' && new Set(choices.map(c => c[field]).filter(value => value !== card[field])).size < 3)
      choices.push(...VOCAB_DECKS.filter(deck => deck.level === 'adult').flatMap(deck => deck.cards));
    const pool = [...new Set(choices.map((c) => c[field]))].filter(
      (v) => !!v.trim() && v !== card[field],
    );
    const options = shuffle([card[field], ...shuffle(pool, rng).slice(0, 3)], rng);
    return { key, card, mode, options, isNew };
  });
}

/** 새로 저장한 표현 한 장은 다음 세션에 넣고 나머지는 기존 복습 순서를 따른다. */
function englishSessionKeys(keys: string[], srs: Record<string, SrsCard>, today: string, count: number): string[] {
  const freshPhrase = keys.find(key => key.includes(':my-phrases:') && !srs[key]);
  return freshPhrase && count > 0 ? [freshPhrase, ...pickSessionKeys(keys.filter(key => key !== freshPhrase), srs, today, count - 1)] : pickSessionKeys(keys, srs, today, count);
}
export function buildSpeakingSession(deckIds: readonly string[], srs: Record<string, SrsCard>, today: string, count: number, rng: Rng = defaultRng, data: Pick<ProfileData, 'customCards'> = {}): { key: string; sentence: Sentence }[] {
  const byKey = new Map<string, Sentence>();
  for (const id of deckIds) {
    const sentences = id === 'my-phrases' ? getVocabCards(id, data).map(card => ({ ...card, tag: '내 표현' })) : SENTENCE_DECK_MAP[id]?.sentences ?? [];
    for (const sentence of sentences) byKey.set(speakKey(id, sentence.id), sentence);
  }
  return shuffle(englishSessionKeys([...byKey.keys()], srs, today, count), rng).map(key => ({ key, sentence: byKey.get(key)! }));
}
