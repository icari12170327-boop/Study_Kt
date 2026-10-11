import type { AiConfig } from '../../shared/ai';
import { AiError, errorForResponse, normalizeAiConfig } from './ai';
import type { Recording } from './recorder';
export async function transcribe(cfg: AiConfig, recording: Recording, signal?: AbortSignal): Promise<string> {
  const { endpoint, token } = normalizeAiConfig(cfg);
  let response: Response;
  try {
    response = await fetch(`${endpoint}/api/transcribe?profileId=parent&durationSec=${Math.max(1, Math.min(150, recording.durationSec))}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': recording.audio.type }, body: recording.audio, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000) });
  } catch { throw new AiError('network'); }
  let body: unknown; try { body = await response.json(); } catch { throw new AiError('server'); }
  if (!response.ok) throw errorForResponse(response.status);
  if (!body || typeof body !== 'object' || !('text' in body) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 6000) throw new AiError('server');
  return body.text;
}
