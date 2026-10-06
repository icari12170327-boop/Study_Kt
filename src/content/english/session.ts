import type { SrsCard } from '../../types';
import { pick, shuffle, type Rng, defaultRng } from '../../lib/random';
import { pickSessionKeys } from '../../lib/srs';
import { VOCAB_DECK_MAP, vocabKey, type VocabCard } from './vocab';

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
): VocabItem[] {
  const decks = deckIds.map((id) => VOCAB_DECK_MAP[id]).filter(Boolean);
  const byKey = new Map<string, { deckId: string; card: VocabCard }>();
  for (const d of decks) for (const c of d.cards) byKey.set(vocabKey(d.id, c.id), { deckId: d.id, card: c });

  const keys = pickSessionKeys([...byKey.keys()], srs, today, count);
  return shuffle(keys, rng).map((key) => {
    const { deckId, card } = byKey.get(key)!;
    const isNew = srs[key] === undefined;
    // 처음 보는 단어는 쉬운 '뜻 고르기'로, 익숙해지면 듣기와 영어 고르기를 섞는다.
    const mode: VocabMode = isNew ? 'meaning' : pick(['meaning', 'reverse', 'listen'] as const, rng);
    const field = mode === 'meaning' ? 'ko' : 'en';
    const pool = [...new Set(VOCAB_DECK_MAP[deckId].cards.filter((c) => c.id !== card.id).map((c) => c[field]))].filter(
      (v) => v !== card[field],
    );
    const options = shuffle([card[field], ...shuffle(pool, rng).slice(0, 3)], rng);
    return { key, card, mode, options, isNew };
  });
}
