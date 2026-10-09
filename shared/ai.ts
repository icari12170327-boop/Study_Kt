export type VoiceStyle = 'kid-boy' | 'kid-girl' | 'young-woman' | 'calm-man';
export type AiProfileId = 'kid1' | 'kid2' | 'parent';
export type AiLevel = 'g3' | 'g5' | 'adult';
export type CoachTopic = 'daily' | 'work' | 'money';
export type CoachLevel = 'zero' | 'words' | 'short' | 'daily';
export type CoachRepeat = 'low' | 'mid' | 'high';
export type ParentSpeed = 0.85 | 0.9 | 1;
export interface AiConfig {
  endpoint?: string;
  token?: string;
}
export interface SessionRequest {
  profileId: AiProfileId;
  level: AiLevel;
  mode: 'kid-friend' | 'biz-talk' | 'parent-coach';
  offerSdp: string;
  persona: { friendName: string; personaId: string; voice: string; voiceStyle?: VoiceStyle; friendHobbies?: string };
  pushToTalk?: boolean;
  memory?: string;
  interests?: string[];
  topic?: string;
  scenarioId?: string;
  situation?: string;
  coachTopic?: CoachTopic;
  coach?: { level: CoachLevel; repeat: CoachRepeat };
  speed?: ParentSpeed;
}
export interface SessionResponse {
  sessionId: string;
  answerSdp: string;
  remainingSeconds: number;
}
export interface ActiveSession {
  profileId: AiProfileId;
  sessionId: string;
  startedAt: number;
  elapsedSeconds: number;
  remainingSeconds: number;
}
export interface EndActiveResponse {
  ok: true;
  closed: number;
  chargedSeconds: number;
}
export type GenerateKind = 'talk-summary' | 'biz-feedback' | 'memory-merge' | 'word-problem' | 'reading-quiz' | 'coach-gloss' | 'coach-wrapup' | 'coach-check' | 'weekly-report';
export interface GenerateRequest {
  profileId: AiProfileId;
  level: AiLevel;
  kind: GenerateKind;
  input: unknown;
}
export interface Usage {
  remainingSeconds?: Record<AiProfileId, number>;
  today: Record<AiProfileId, { talkSeconds: number; generates: number }>;
  month: { talkSeconds: number; estimatedKrw: number };
}
