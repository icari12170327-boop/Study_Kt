import { describe, expect, it } from 'vitest';
import { VOCAB_DECKS } from './vocab';
import { SENTENCE_DECKS } from './sentences';
import { buildVocabSession } from './session';
import { seededRng } from '../../lib/random';

describe('영어 콘텐츠', () => {
  it('단어장마다 id가 겹치지 않는다', () => {
    for (const deck of VOCAB_DECKS) {
      const ids = deck.cards.map((c) => c.id);
      expect(new Set(ids).size, deck.id).toBe(ids.length);
    }
  });
  it('문장 id가 겹치지 않는다', () => {
    for (const deck of SENTENCE_DECKS) {
      const ids = deck.sentences.map((s) => s.id);
      expect(new Set(ids).size, deck.id).toBe(ids.length);
    }
  });
});

describe('단어 세션', () => {
  it('보기 4개, 정답 1개, 중복 없음', () => {
    const items = buildVocabSession(['g3-words', 'g5-words', 'biz-ai'], {}, '2026-10-06', 30, seededRng(7));
    expect(items).toHaveLength(30);
    for (const it of items) {
      expect(it.options).toHaveLength(4);
      expect(new Set(it.options).size).toBe(4);
      const answer = it.mode === 'meaning' ? it.card.ko : it.card.en;
      expect(it.options.filter((o) => o === answer)).toHaveLength(1);
    }
  });
  it('처음 보는 단어는 뜻 고르기로 나온다', () => {
    const items = buildVocabSession(['g3-words'], {}, '2026-10-06', 10, seededRng(8));
    expect(items.every((i) => i.isNew && i.mode === 'meaning')).toBe(true);
  });
});
