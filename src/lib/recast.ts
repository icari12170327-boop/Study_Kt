import { normalizeWords } from './similarity';
export interface Recast { start: number; end: number }
const grammatical = new Set(['a', 'an', 'the', 'to', 'in', 'on', 'at', 'for', 'of', 'have', 'has', 'had', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did']);
const irregular: Record<string, string> = { go: 'go', goes: 'go', went: 'go', gone: 'go', eat: 'eat', eats: 'eat', ate: 'eat', eaten: 'eat', see: 'see', saw: 'see', seen: 'see', buy: 'buy', bought: 'buy', make: 'make', made: 'make', take: 'take', took: 'take', taken: 'take', say: 'say', said: 'say', speak: 'speak', spoke: 'speak', spoken: 'speak' };
function stems(word: string): Set<string> {
  if (irregular[word]) return new Set([irregular[word]]);
  const forms = [word];
  if (word.endsWith('ies') || word.endsWith('ied')) forms.push(word.slice(0, -3) + 'y');
  if (word.endsWith('s') && !word.endsWith('ss')) forms.push(word.slice(0, -1));
  const root = word.endsWith('ing') ? word.slice(0, -3) : word.endsWith('ed') ? word.slice(0, -2) : '';
  if (root) { forms.push(root, root + 'e'); if (/(.)\1$/.test(root)) forms.push(root.slice(0, -1)); }
  return new Set(forms);
}
function tokens(text: string) {
  return [...text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)].flatMap(match => normalizeWords(match[0]).map(word => ({ word, key: ['i', 'we', 'you'].includes(word) ? 'subject' : word === 'my' || word === 'your' ? 'possessive' : word, start: match.index, end: match.index + match[0].length })));
}
/** 첫 짧은 영어 구절의 국소적 문법 차이만 강조한다. 뜻을 바꾼 말이나 혼합 문장은 추정하지 않는다. */
export function detectRecast(user: string, ai: string): Recast | null {
  const first = ai.match(/^[\s\S]*?[.!?](?=\s|$)|^[\s\S]+$/)?.[0] ?? '';
  if (/[가-힣]/.test(user + first)) return null;
  const a = tokens(user), all = tokens(first);
  const b = all.filter((token, i) => !(i === 0 && ['oh', 'yes', 'right', 'okay'].includes(token.word)));
  if (a.length < 3 || b.length < 3 || a.length > 20 || b.length > 22) return null;
  // 맞는 문장을 1인칭↔2인칭으로 되받을 때 자연스러운 주어 일치 변화는 교정이 아니다.
  if (a[0].key === 'subject' && b[0].key === 'subject' && a[0].word !== b[0].word) {
    for (const line of [a, b]) {
      const subject = line[0].word, verb = line[1];
      if (verb.word === (subject === 'i' ? 'am' : 'are')) verb.key = 'be-present';
      else if (verb.word === (subject === 'i' ? 'was' : 'were')) verb.key = 'be-past';
    }
  }
  let left = 0;
  while (left < Math.min(a.length, b.length) && a[left].key === b[left].key) left++;
  let right = 0;
  while (right < Math.min(a.length, b.length) - left && a[a.length - right - 1].key === b[b.length - right - 1].key) right++;
  const changedA = a.slice(left, a.length - right), changedB = b.slice(left, b.length - right);
  const matched = left + right;
  if (!changedB.length || changedA.length > 3 || changedB.length > 3 || matched < 2 || matched / Math.max(a.length, b.length) < 0.6) return null;
  const oldContent = changedA.filter(t => !grammatical.has(t.word)).map(t => stems(t.word));
  const newContent = changedB.filter(t => !grammatical.has(t.word)).map(t => stems(t.word));
  if (oldContent.length !== newContent.length || oldContent.some((forms, i) => ![...forms].some(form => newContent[i].has(form)))) return null;
  return { start: changedB[0].start, end: changedB.at(-1)!.end };
}
