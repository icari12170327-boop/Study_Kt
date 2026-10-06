export type ProfileId = 'kid1' | 'kid2' | 'parent';

/** g3: 초등 3학년, g5: 초등 5학년, adult: 보호자 */
export type Level = 'g3' | 'g5' | 'adult';

export type MissionType = 'math' | 'vocab' | 'speaking' | 'reading';

export interface Profile {
  id: ProfileId;
  name: string;
  avatar: string;
  level: Level;
}

export interface MissionConfig {
  type: MissionType;
  enabled: boolean;
  /** 하루 목표량 (문제 수, 카드 수, 문장 수, 독서 활동 수) */
  target: number;
}

export interface ProfileSettings {
  missions: MissionConfig[];
  mathSkills: string[];
  vocabDecks: string[];
  speakingDecks: string[];
  /** 하루 미션을 모두 끝내면 받는 쿠폰 문구 */
  rewardLabel: string;
}

export type Answer =
  | { kind: 'int'; value: number }
  | { kind: 'decimal'; value: number }
  | { kind: 'fraction'; num: number; den: number }
  | { kind: 'qr'; q: number; r: number };

export interface MathProblem {
  skill: string;
  question: string;
  answer: Answer;
  hint?: string;
}

export interface SkillStat {
  correct: number;
  total: number;
}

export interface DayLog {
  date: string;
  progress: Partial<Record<MissionType, number>>;
  correct: number;
  total: number;
  completed: boolean;
  mathBySkill: Record<string, SkillStat>;
}

export interface WrongItem {
  id: string;
  problem: MathProblem;
  addedAt: string;
  /** 사용자가 입력했던 오답 (보호자 확인용) */
  given: string;
}

export interface SrsCard {
  box: number;
  due: string;
  seen: number;
  lapses: number;
}

export interface Coupon {
  id: string;
  label: string;
  earnedAt: string;
  usedAt?: string;
}

export interface QaCard {
  id: string;
  q: string;
  a: string;
}

export interface ReadingNote {
  id: string;
  title: string;
  author: string;
  date: string;
  summary: string;
  cards: QaCard[];
}

export interface ProfileData {
  stars: number;
  streak: number;
  lastCompleted?: string;
  days: Record<string, DayLog>;
  wrongNotes: WrongItem[];
  srs: Record<string, SrsCard>;
  coupons: Coupon[];
  notes: ReadingNote[];
}

export interface AppState {
  version: 1;
  parentPin?: string;
  profiles: Profile[];
  settings: Record<ProfileId, ProfileSettings>;
  data: Record<ProfileId, ProfileData>;
}
