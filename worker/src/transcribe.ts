import { ProxyError } from './openai';
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
export const AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'] as const;
export async function readAudio(request: Request): Promise<{ audio: Blob; durationSec: number }> {
  const params = new URL(request.url).searchParams;
  if (params.get('profileId') !== 'parent') throw new ProxyError('unauthorized', 403);
  const duration = params.get('durationSec'), durationSec = Number(duration);
  if (!duration || !Number.isFinite(durationSec) || durationSec < 1 || durationSec > 150) throw new ProxyError('invalid', 400);
  const type = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (!AUDIO_TYPES.some(allowed => allowed === type)) throw new ProxyError('invalid', 400);
  const reader = request.body?.getReader();
  if (!reader) throw new ProxyError('invalid', 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AUDIO_BYTES) { await reader.cancel(); throw new ProxyError('invalid', 400); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new ProxyError('invalid', 400);
  return { audio: new Blob(chunks as BlobPart[], { type }), durationSec };
}
