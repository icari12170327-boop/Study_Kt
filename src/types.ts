import type { PuzzleData } from './content/puzzles/types';
import type { StoryProgress } from './content/stories/types';

export type ProfileId = 'kid1' | 'kid2' | 'parent';

/** g3: 초등 3학년, g5: 초등 5학년, adult: 보호자 */
export type Level = 'g3' | 'g5' | 'adult';

export type MissionType = 'math' | 'vocab' | 'speaking' | 'reading' | 'talk' | 'science';

export type ScienceTopic = 'float-sink' | 'electricity' | 'light' | 'sound' | 'magnet' | 'states' | 'mixing' | 'air' | 'living' | 'heat' | 'weather' | 'motion' | 'acid-base' | 'space';
export interface ScienceCard {
  id: string;
  audience: 'both' | 'g3' | 'g5';
  topic: ScienceTopic;
  curriculum?: string;
  title: string;
  question: string;
  predictions: string[];
  materials: string[];
  steps: string[];
  result: string;
  explain: string;
  deeper?: { think: string; vary: string; explain: string };
  safety?: string;
  adultNeeded: boolean;
}
export interface ScienceData {
  collected: Record<string, string>;
  experiments: Record<string, { date: string; predicted?: string; observed?: string }>;
  badges: string[];
  recentWrong: { id: string; chosen: number; date: string }[];
}

export interface Profile {
  id: ProfileId;
  name: string;
  avatar: string;
  level: Level;
}

export interface MissionConfig {
  type: MissionType;
  enabled: boolean;
  /** 하루 목표량 (문제 수, 카드 수, 문장 수, 독서 활동 수, 대화 분) */
  target: number;
}

export interface ProfileSettings {
  readingQuiz?: { enabled: boolean };
  stories?: { enabled: boolean };
  wordProblemRatio?: number;
  puzzles?: { enabled: boolean };
  gamesPerDay?: number;
  coach?: CoachSettings;
  bizTalkEnabledOnce?: true;
  bingo?: { enabled: boolean; productMix: 'off' | 'few' | 'normal' | 'many'; limitSec: number };
  /** 배포된 실험 미션의 단위를 한 번만 문제로 바꾼 표시. */
  scienceV2?: true;
  talk?: TalkSettings;
  missions: MissionConfig[];
  mathSkills: string[];
  vocabDecks: string[];
  speakingDecks: string[];
  /** 하루 미션을 모두 끝내면 받는 쿠폰 문구 */
  rewardLabel: string;
}
export interface TalkSettings {
  friendName: string;
  personaId: 'cheerful' | 'calm' | 'funny';
  voice: string;
  voiceStyle?: import('../shared/ai').VoiceStyle;
  dailyMinutes: number;
  interests: string[];
  friendHobbies: string;
  subtitleHidePercent: number;
  pushToTalk: boolean;
}
export interface TalkLine { role: 'kid' | 'friend'; text: string; at: number; peeked?: boolean }
export interface TalkSummary {
  highlightKo: string;
  topicsKo: string[];
  newExpressions: { en: string; ko: string }[];
  nextTopics: string[];
}
export interface TalkLog {
  id: string;
  date: string;
  seconds: number;
  lines: TalkLine[];
  englishRatio: number;
  summary?: TalkSummary;
  flagged?: boolean;
  scenarioId?: string;
  situation?: string;
  feedback?: BizFeedback;
  mode?: 'coach';
  coachTopic?: import('../shared/ai').CoachTopic;
  coachWrapup?: CoachWrapup;
  coachCheck?: CoachCheck & { text: string };
  corrections?: import('../shared/corrections').Corrections & { createdAt: string };
  reviewResult?: ReviewResult;
  previewChunks?: string[];
  retrievalApplied?: string[];
  retells?: RetellAttempt[];
  growth?: TalkGrowth;
}
export interface RetellAttempt { text: string; seconds: number; limit: 120 | 90 }
export interface TalkGrowth { averageEnglishWords: number | null; retellWordsPerMinute: number | null; correctionRate: number | null; selfFixedRate: number | null; englishRatio: number | null; reuseRate: number | null }
export interface ReviewResult { targets: string[]; reused: string[] }
export interface RetrievalItem { id: string; text: string; focus?: string; source: 'correction' | 'preview'; mode: 'coach' | 'biz'; stage: 0 | 1 | 2 | 3; dueDate: string; misses: number; createdAt: string; learnedAt?: string }
export interface CoachSettings {
  level: import('../shared/ai').CoachLevel;
  repeat: import('../shared/ai').CoachRepeat;
  speed: import('../shared/ai').ParentSpeed;
  subtitle: 'now' | 'after' | 'hidden';
}
export interface CoachWrapup { sentences: { en: string; ko: string }[] }
export interface CoachCheck { corrected: string; noteKo: string }
export interface BizFeedback {
  overallKo: string;
  corrections: { said: string; better: string; why: string }[];
  nextExpressions: { en: string; ko: string }[];
}
export interface CustomCard { id: string; en: string; ko: string; source: string; createdAt: string }

export type Answer =
  | { kind: 'int'; value: number }
  | { kind: 'decimal'; value: number }
  | { kind: 'fraction'; num: number; den: number }
  | { kind: 'qr'; q: number; r: number };

export interface MathProblem {
  /** 검증된 이야기와 물음. question은 원래 식으로 유지한다. */
  story?: string;
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
  /** 과학만의 정답률과 오늘 푼 단원. 기존 전체 정답 통계와 별도로 둔다. */
  science?: { correct: number; total: number; units: string[] };
  date: string;
  /** 짧은 대화의 남은 초도 다음 대화와 합쳐 분 단위 진행으로 바꾼다. */
  talkSeconds?: number;
  progress: Partial<Record<MissionType, number>>;
  correct: number;
  total: number;
  completed: boolean;
  mathBySkill: Record<string, SkillStat>;
  mathAttempts: MathAttempt[];
}

export interface MathAttempt {
  /** 문장제는 정답률에 포함하고 시간·찍기 평가에서 제외한다. */
  story?: boolean;
  /** T07부터 오늘 시도에만 저장한다. */
  problem?: MathProblem;
  skill: string;
  correct: boolean;
  activeMs: number;
  guessed: boolean;
}

export interface MathLevelState {
  level: number;
  /** 마지막으로 평가한 학습일. history의 date는 평가가 적용된 날이다. */
  lastEvaluated?: string;
  history: { date: string; level: number; counted: number; correct: number; guesses: number; medianSec: number }[];
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

export interface BingoRecord {
  date: string;
  level: Level;
  /** 같은 제한 시간끼리만 최고 기록을 비교한다. */
  limitSec: number;
  found: number;
  bingos: number;
  hints: number;
}

export type GameId = 'fishing' | 'duel' | 'obby';
export interface GameRecord { date: string; game: GameId; score: number; caught?: number; golden?: number; opponent?: ProfileId; won?: boolean; stage?: number }
export type ObbyColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple';
export type ObbyHat = 'cap' | 'tophat' | 'helmet';

export interface ProfileData {
  retrieval?: RetrievalItem[];
  previewHistory?: Record<string, string>;
  weeklyAi?: Record<string, import('../shared/weeklyReport').WeeklyAi>;
  stories?: Record<string, StoryProgress>;
  puzzles?: PuzzleData;
  games?: GameRecord[];
  obby?: { best: number; color: ObbyColor; hat?: ObbyHat };
  crownUntil?: string;
  customCards?: CustomCard[];
  bizSituations?: string[];
  bingo?: { recent: BingoRecord[]; best: Record<string, BingoRecord> };
  science: ScienceData;
  talks: TalkLog[];
  friendMemory: string;
  math: MathLevelState;
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
  version: 2;
  ai: import('../shared/ai').AiConfig;
  parentPin?: string;
  profiles: Profile[];
  settings: Record<ProfileId, ProfileSettings>;
  data: Record<ProfileId, ProfileData>;
}
