import type { ActiveSession, AiConfig, AiProfileId, EndActiveResponse, GenerateRequest, Usage } from '../../shared/ai';
export type { ActiveSession, AiConfig, GenerateRequest, Usage, SessionRequest, SessionResponse } from '../../shared/ai';
export type AiErrorKind = 'unauthorized' | 'limit' | 'busy' | 'unsafe' | 'mic-denied' | 'network' | 'server';
const messages: Record<AiErrorKind, string> = {
  unauthorized: '가족 토큰과 허용된 앱 주소를 확인해 주세요.',
  limit: '사용 시간을 모두 썼어요. 보호자에게 알려 주세요.',
  busy: '다른 기기에서 대화 중이에요. 보호자 모드 → AI 연결에서 끝낼 수 있어요.',
  unsafe: '이 요청은 진행할 수 없어요. 보호자에게 알려 주세요.',
  'mic-denied': '마이크를 사용할 수 없어요. 브라우저의 마이크 권한을 확인해 주세요.',
  network: '연결이 끊겼어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  server: 'AI 연결을 완료하지 못했어요. Worker 설정을 확인하고 다시 시도해 주세요.',
};
export class AiError extends Error {
  constructor(public kind: AiErrorKind) {
    super(messages[kind]);
    this.name = 'AiError';
  }
}
export function normalizeAiConfig(cfg: AiConfig): Required<AiConfig> {
  try {
    const endpoint = new URL(cfg.endpoint?.trim() ?? '');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
    if (
      (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && local)) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      !cfg.token ||
      cfg.token.length < 32 ||
      cfg.token.length > 4000 ||
      /\s/.test(cfg.token)
    )
      throw new Error();
    return { endpoint: endpoint.href.replace(/\/+$/, ''), token: cfg.token };
  } catch {
    throw new AiError('unauthorized');
  }
}
export function errorForResponse(status: number, error?: unknown): AiError {
  if (status === 401 || status === 403) return new AiError('unauthorized');
  if (status === 429) return new AiError('limit');
  if (status === 409) return new AiError('busy');
  if (error === 'unsafe') return new AiError('unsafe');
  return new AiError('server');
}
export async function aiRequest(cfg: AiConfig, path: string, input?: unknown, keepalive = false, signal?: AbortSignal): Promise<unknown> {
  const { endpoint, token } = normalizeAiConfig(cfg);
  let response: Response;
  try {
    response = await fetch(`${endpoint}${path}`, {
      method: input === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(input === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      keepalive,
      signal: signal ?? AbortSignal.timeout(25000),
    });
  } catch {
    throw new AiError('network');
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AiError('server');
  }
  const error = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
  if (!response.ok) throw errorForResponse(response.status, error);
  return body;
}
export async function generate<T = unknown>(cfg: AiConfig, request: GenerateRequest, signal?: AbortSignal): Promise<T> {
  const body = await aiRequest(cfg, '/api/generate', request, false, signal);
  if (!body || typeof body !== 'object' || !('ok' in body) || body.ok !== true || !('data' in body))
    throw new AiError('server');
  return body.data as T;
}
const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function isUsage(value: unknown): value is Usage {
  if (!value || typeof value !== 'object' || !('today' in value) || !('month' in value)) return false;
  const { today, month } = value as Usage;
  return (
    !!today &&
    !!month &&
    ['kid1', 'kid2', 'parent'].every((id) => {
      const record = today[id as keyof Usage['today']];
      return !!record && nonnegative(record.talkSeconds) && nonnegative(record.generates);
    }) &&
    nonnegative(month.talkSeconds) &&
    nonnegative(month.estimatedKrw) &&
    (!('remainingSeconds' in value) || (!!value.remainingSeconds && typeof value.remainingSeconds === 'object' && ['kid1', 'kid2', 'parent'].every((id) => nonnegative((value.remainingSeconds as Record<string, unknown>)[id]))))
  );
}
export async function fetchUsage(cfg: AiConfig): Promise<Usage> {
  const body = await aiRequest(cfg, '/api/usage');
  if (!isUsage(body)) throw new AiError('server');
  return body;
}
export async function fetchActiveSessions(cfg: AiConfig): Promise<ActiveSession[]> {
  const body = await aiRequest(cfg, '/api/realtime/active');
  if (!body || typeof body !== 'object' || !('sessions' in body) || !Array.isArray(body.sessions) ||
    !body.sessions.every((s: ActiveSession) => s && ['kid1', 'kid2', 'parent'].includes(s.profileId) && typeof s.sessionId === 'string' &&
      nonnegative(s.startedAt) && nonnegative(s.elapsedSeconds) && nonnegative(s.remainingSeconds))) throw new AiError('server');
  return body.sessions;
}
export async function endActiveSessions(cfg: AiConfig, profileId: AiProfileId | 'all', keepalive = false): Promise<EndActiveResponse> {
  const body = await aiRequest(cfg, '/api/realtime/end-active', { profileId }, keepalive);
  if (!body || typeof body !== 'object' || !('ok' in body) || body.ok !== true || !('closed' in body) || !nonnegative(body.closed) ||
    !('chargedSeconds' in body) || !nonnegative(body.chargedSeconds)) throw new AiError('server');
  return body as EndActiveResponse;
}
