export interface Recording { audio: Blob; durationSec: number }
export interface RecorderEnv {
  getUserMedia: () => Promise<MediaStream>;
  create: (stream: MediaStream, mimeType: string) => MediaRecorder;
  supports: (mimeType: string) => boolean;
  now: () => number;
  document: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
}
export interface RecorderHandle { result: Promise<Recording>; stop: () => void; dispose: () => void }
const formats = ['audio/webm;codecs=opus', 'audio/mp4'];
export function recorderEnv(): RecorderEnv | undefined {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return undefined;
  return { getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }), create: (stream, mimeType) => new MediaRecorder(stream, { mimeType }), supports: type => MediaRecorder.isTypeSupported(type), now: () => performance.now(), document };
}
/** 녹음은 메모리에만 모으며 취소·숨김·자동 종료에서 마이크를 정리한다. */
export async function startRecording(options: { env?: RecorderEnv; signal?: AbortSignal; onTick?: (remaining: number) => void } = {}): Promise<RecorderHandle> {
  const env = options.env ?? recorderEnv(), signal = options.signal;
  const mime = env && formats.find(type => env.supports(type));
  if (!env || !mime) throw new Error('unsupported');
  const stream = await env.getUserMedia();
  const closeTracks = () => stream.getTracks().forEach(track => track.stop());
  if (signal?.aborted || env.document.hidden) { closeTracks(); throw new DOMException('취소', 'AbortError'); }
  let recorder: MediaRecorder;
  try { recorder = env.create(stream, mime); } catch (error) { closeTracks(); throw error; }
  let resolve!: (value: Recording) => void, reject!: (error: unknown) => void;
  const result = new Promise<Recording>((yes, no) => { resolve = yes; reject = no; });
  // 화면 이탈로 결과를 기다리던 호출이 사라져도 미처리 거절을 남기지 않는다.
  void result.catch(() => {});
  const chunks: Blob[] = [], started = env.now();
  let done = false, stoppedAt: number | undefined;
  const clean = () => { clearInterval(interval); closeTracks(); env.document.removeEventListener('visibilitychange', hidden); signal?.removeEventListener('abort', dispose); };
  const stop = () => {
    if (done || stoppedAt !== undefined) return;
    stoppedAt = env.now(); clearInterval(interval);
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch (error) { done = true; clean(); reject(error); }
    closeTracks();
  };
  const dispose = () => { if (done) return; done = true; recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null; try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* 이미 종료된 녹음 */ } clean(); chunks.length = 0; reject(new DOMException('취소', 'AbortError')); };
  const hidden = () => { if (env.document.hidden) stop(); };
  recorder.ondataavailable = event => { if (!done && event.data.size) chunks.push(event.data); };
  recorder.onstop = () => { if (done) return; done = true; clean(); const durationSec = Math.max(1, Math.min(120, ((stoppedAt ?? env.now()) - started) / 1000)); resolve({ audio: new Blob(chunks, { type: mime }), durationSec }); chunks.length = 0; };
  recorder.onerror = () => { if (!done) { done = true; recorder.ondataavailable = null; recorder.onstop = null; try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* 오류 난 녹음 정리 */ } clean(); chunks.length = 0; reject(new Error('recording')); } };
  const interval = setInterval(() => { const remaining = Math.max(0, 120 - (env.now() - started) / 1000); options.onTick?.(remaining); if (!remaining) stop(); }, 100);
  env.document.addEventListener('visibilitychange', hidden); signal?.addEventListener('abort', dispose, { once: true });
  try { recorder.start(250); } catch (error) { dispose(); throw error; }

  return { result, stop, dispose };
}
