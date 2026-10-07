export type AiProfileId = 'kid1' | 'kid2' | 'parent';
export type AiLevel = 'g3' | 'g5' | 'adult';
export interface AiConfig {
  endpoint?: string;
  token?: string;
}
export interface SessionRequest {
  profileId: AiProfileId;
  level: AiLevel;
  mode: 'kid-friend' | 'biz-talk';
  offerSdp: string;
  persona: { friendName: string; personaId: string; voice: string };
  memory?: string;
  interests?: string[];
  topic?: string;
  scenarioId?: string;
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
export type GenerateKind = 'talk-summary' | 'biz-feedback' | 'memory-merge' | 'word-problem' | 'reading-quiz';
export interface GenerateRequest {
  profileId: AiProfileId;
  level: AiLevel;
  kind: GenerateKind;
  input: unknown;
}
export interface Usage {
  today: Record<AiProfileId, { talkSeconds: number; generates: number }>;
  month: { talkSeconds: number; estimatedKrw: number };
}
