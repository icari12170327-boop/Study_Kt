export const CORRECTION_PATTERNS = ['tense', 'article', 'preposition', 'word-order', 'agreement', 'word-choice', 'missing-word', 'korean', 'other'] as const;
export type CorrectionPattern = typeof CORRECTION_PATTERNS[number];
export interface CorrectionItem { said: string; better: string; focus: string; whyKo: string; hintKo: string; pattern: CorrectionPattern; selfFixed?: boolean }
export interface Corrections { items: CorrectionItem[]; praiseKo: string }
/** 인용 검증은 공백·구두점·대소문자를 무시하되 한 사용자 줄 안에서만 한다. */
export const correctionKey = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export function filterCorrections(result: Corrections, userLines: string[]): Corrections {
  return { praiseKo: result.praiseKo, items: result.items.filter(item => {
    const key = correctionKey(item.said);
    return !!key && userLines.some(line => correctionKey(line).includes(key)) && !!item.focus.trim() && item.better.includes(item.focus);
  }) };
}
