import { validCorrection, type CorrectionPattern } from './corrections';
export const OPIC_TYPES = ['self-intro', 'description', 'routine', 'past', 'comparison', 'roleplay-questions', 'roleplay-solution', 'roleplay-experience', 'issue'] as const;
export type OpicType = typeof OPIC_TYPES[number];
export const OPIC_TARGETS = ['IM2', 'IM3', 'IH', 'AL'] as const;
export const OPIC_BANDS = ['NH-IL', 'IL-IM1', 'IM1-IM2', 'IM2-IM3', 'IM3-IH', 'IH-AL'] as const;
export interface OpicFeedback {
  taskDone: boolean; taskNoteKo: string; textType: 'words' | 'sentences' | 'strings' | 'paragraph';
  levelBand: typeof OPIC_BANDS[number]; strengthsKo: string[];
  corrections: { said: string; better: string; focus: string; whyKo: string; pattern: CorrectionPattern }[];
  nextStepKo: string; modelAnswer: string; upgrades: { from: string; to: string }[]; keyPhrases: string[];
}
export function filterOpicFeedback(feedback: OpicFeedback, transcript: string): OpicFeedback {
  return { ...feedback, corrections: feedback.corrections.filter(item => validCorrection(item, [transcript])), upgrades: feedback.upgrades.filter(item => !!item.to.trim() && feedback.modelAnswer.includes(item.to)) };
}
