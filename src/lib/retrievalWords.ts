import { normalizeWords } from './similarity';
/** 보호자 표현 복습 전용. 발음 점수의 공용 정규화나 사람 이름의 소유격은 바꾸지 않는다. */
export function normalizeRetrievalWords(text: string): string[] {
  return normalizeWords(text.replace(/[’‘`]/g, "'")
    .replace(/\b(it|that|what|who|here|there)'s\b/gi, '$1 is')
    .replace(/\blet's\b/gi, 'let us'));
}
