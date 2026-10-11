import type { AiConfig } from '../../shared/ai';
import { AiError, errorForResponse, normalizeAiConfig } from './ai';
import type { Recording } from './recorder';
export class TranscribeError extends Error {
  constructor(public kind: 'empty-recording' | 'no-speech') {
    super(kind === 'empty-recording' ? '녹음이 비었어요. 글로 답하거나 다시 녹음해 주세요.' : '말소리가 들리지 않았어요. 글로 답하거나 다시 녹음해 주세요.');
  }
}
export async function transcribe(cfg: AiConfig, recording: Recording, signal?: AbortSignal): Promise<string> {
  if (!recording.audio.size) throw new TranscribeError('empty-recording');
  const { endpoint, token } = normalizeAiConfig(cfg);
  let response: Response;
  try {
    response = await fetch(`${endpoint}/api/transcribe?profileId=parent&durationSec=${Math.max(1, Math.min(150, recording.durationSec))}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': recording.audio.type }, body: recording.audio, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000) });
  } catch { throw new AiError('network'); }
  let body: unknown; try { body = await response.json(); } catch { throw new AiError('server'); }
  if (response.status === 422 && body && typeof body === 'object' && 'error' in body && body.error === 'no-speech') throw new TranscribeError('no-speech');
  if (!response.ok) throw errorForResponse(response.status);
  if (!body || typeof body !== 'object' || !('text' in body) || typeof body.text !== 'string' || body.text.length > 6000) throw new AiError('server');
  if (!body.text.trim()) throw new TranscribeError('no-speech');
  return body.text;
}
