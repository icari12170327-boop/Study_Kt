import { normalizeWords } from './similarity';
export interface Recast { start: number; end: number }
const grammatical = new Set(['a', 'an', 'the', 'to', 'in', 'on', 'at', 'for', 'of', 'have', 'has', 'had', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did']);
const irregular: Record<string, string> = { go: 'go', goes: 'go', went: 'go', gone: 'go', eat: 'eat', eats: 'eat', ate: 'eat', eaten: 'eat', see: 'see', saw: 'see', seen: 'see', buy: 'buy', bought: 'buy', make: 'make', made: 'make', take: 'take', took: 'take', taken: 'take', say: 'say', said: 'say', speak: 'speak', spoke: 'speak', spoken: 'speak' };
const stem = (word: string) => irregular[word] ?? word.replace(/(ing|ed|s)$/, '');
function tokens(text: string) {
  return [...text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)].flatMap(match => normalizeWords(match[0]).map(word => ({ word, key: word === 'i' || word === 'you' ? 'subject' : word === 'my' || word === 'your' ? 'possessive' : word, start: match.index, end: match.index + match[0].length })));
}
/** 첫 짧은 영어 구절의 국소적 문법 차이만 강조한다. 뜻을 바꾼 말이나 혼합 문장은 추정하지 않는다. */
export function detectRecast(user: string, ai: string): Recast | null {
  const first = ai.match(/^[\s\S]*?[.!?](?=\s|$)|^[\s\S]+$/)?.[0] ?? '';
  if (/[가-힣]/.test(user + first)) return null;
  const a = tokens(user), all = tokens(first);
  const b = all.filter((token, i) => !(i === 0 && ['oh', 'yes', 'right', 'okay'].includes(token.word)));
  if (a.length < 3 || b.length < 3 || a.length > 20 || b.length > 22) return null;
  let left = 0;
  while (left < Math.min(a.length, b.length) && a[left].key === b[left].key) left++;
  let right = 0;
  while (right < Math.min(a.length, b.length) - left && a[a.length - right - 1].key === b[b.length - right - 1].key) right++;
  const changedA = a.slice(left, a.length - right), changedB = b.slice(left, b.length - right);
  const matched = left + right;
  if (!changedB.length || changedA.length > 3 || changedB.length > 3 || matched < 2 || matched / Math.max(a.length, b.length) < 0.6) return null;
  const oldContent = changedA.filter(t => !grammatical.has(t.word)).map(t => stem(t.word));
  const newContent = changedB.filter(t => !grammatical.has(t.word)).map(t => stem(t.word));
  if (oldContent.join(' ') !== newContent.join(' ')) return null;
  return { start: changedB[0].start, end: changedB.at(-1)!.end };
}
