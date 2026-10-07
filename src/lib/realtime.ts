import { AiError, aiRequest, normalizeAiConfig, type AiConfig, type SessionRequest, type SessionResponse } from './ai';
export type TalkState = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended' | 'error';
export type TalkEvent =
  | { type: 'state'; state: TalkState }
  | { type: 'assistant'; itemId: string; text: string; done: boolean }
  | { type: 'user'; itemId: string; text: string }
  | { type: 'error' };
export interface TalkHandle {
  stop(): Promise<void>;
  setMicEnabled(on: boolean): void;
  sendSystemNote(text: string): void;
}
export interface TalkCallbacks {
  onState(state: TalkState): void;
  onAssistantText(itemId: string, delta: string, done: boolean): void;
  onUserText(itemId: string, text: string): void;
  onError(error: AiError): void;
}
const localTalks = new Set<{ profileId: SessionRequest['profileId']; cfg: AiConfig; stop: () => Promise<void> }>();
export async function stopLocalTalks(cfg: AiConfig, profileId: SessionRequest['profileId'] | 'all'): Promise<void> {
  const expected = normalizeAiConfig(cfg);
  await Promise.all([...localTalks].filter((talk) => {
    const current = normalizeAiConfig(talk.cfg);
    return (profileId === 'all' || talk.profileId === profileId) && current.endpoint === expected.endpoint && current.token === expected.token;
  }).map((talk) => talk.stop()));
}
export function parseRealtimeEvent(json: unknown): TalkEvent | null {
  if (typeof json === 'string') {
    try {
      return parseRealtimeEvent(JSON.parse(json));
    } catch {
      return null;
    }
  }
  if (!json || typeof json !== 'object' || !('type' in json)) return null;
  const e = json as Record<string, unknown>;
  const states: Record<string, TalkState> = {
    'session.created': 'listening',
    'session.updated': 'listening',
    'input_audio_buffer.speech_started': 'listening',
    'input_audio_buffer.speech_stopped': 'thinking',
    'response.created': 'thinking',
    'output_audio_buffer.started': 'speaking',
    'output_audio_buffer.stopped': 'listening',
    'output_audio_buffer.cleared': 'listening',
  };
  if (typeof e.type !== 'string') return null;
  if (states[e.type]) return { type: 'state', state: states[e.type] };
  if (e.type === 'error' || e.type === 'conversation.item.input_audio_transcription.failed') return { type: 'error' };
  if (e.type === 'response.done') {
    const status = (e.response as { status?: string } | undefined)?.status;
    return status === 'failed' ? { type: 'error' } : null;
  }
  if (typeof e.item_id !== 'string') return null;
  if (e.type === 'conversation.item.input_audio_transcription.completed' && typeof e.transcript === 'string')
    return { type: 'user', itemId: e.item_id, text: e.transcript };
  if (e.type === 'response.output_audio_transcript.delta' && typeof e.delta === 'string')
    return { type: 'assistant', itemId: e.item_id, text: e.delta, done: false };
  if (e.type === 'response.output_audio_transcript.done' && typeof e.transcript === 'string')
    return { type: 'assistant', itemId: e.item_id, text: e.transcript, done: true };
  return null;
}
function waitForIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', change);
    };
    const change = () => {
      if (pc.iceGatheringState === 'complete') {
        cleanup();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new AiError('network'));
    }, 10000);
    pc.addEventListener('icegatheringstatechange', change);
  });
}
export async function startTalk(
  cfg: AiConfig,
  req: Omit<SessionRequest, 'offerSdp'>,
  cb: TalkCallbacks,
): Promise<TalkHandle> {
  normalizeAiConfig(cfg);
  cb.onState('connecting');
  let stream: MediaStream | undefined;
  let pc: RTCPeerConnection | undefined;
  let channel: RTCDataChannel | undefined;
  let audio: HTMLAudioElement | undefined;
  let session: SessionResponse | undefined;
  const started = performance.now();
  let stopped = false;
  let stopping: Promise<void> | undefined;
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    localTalks.delete(localTalk);
    clearTimeout(capTimer);
    clearTimeout(connectTimer);
    window.removeEventListener('pagehide', pagehide);
    stream?.getTracks().forEach((track) => track.stop());
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.ontrack = null;
    }
    if (channel) {
      channel.onmessage = null;
      channel.onclose = null;
      channel.onerror = null;
      channel.close();
    }
    pc?.close();
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
  };
  const stop = (): Promise<void> =>
    (stopping ??= (async () => {
      stopped = true;
      cleanup();
      try {
        if (session)
          await aiRequest(
            cfg,
            '/api/realtime/end',
            { sessionId: session.sessionId, seconds: Math.max(0, Math.floor((performance.now() - started) / 1000)) },
            true,
          );
      } catch (e) {
        cb.onError(e instanceof AiError ? e : new AiError('server'));
      } finally {
        cb.onState('ended');
      }
    })());
  const pagehide = () => {
    void stop();
  };
  const localTalk = { profileId: req.profileId, cfg: { ...cfg }, stop };
  localTalks.add(localTalk);
  const fail = (error: AiError) => {
    if (stopped) return;
    cb.onState('error');
    cb.onError(error);
    void stop();
  };
  try {
    window.addEventListener('pagehide', pagehide);
    if (!navigator.mediaDevices?.getUserMedia) throw new AiError('mic-denied');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      throw new AiError('mic-denied');
    }
    if (stopped) {
      stream.getTracks().forEach((track) => track.stop());
      throw new AiError('network');
    }
    pc = new RTCPeerConnection();
    audio = document.createElement('audio');
    audio.autoplay = true;
    pc.ontrack = (e) => {
      if (audio) {
        audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        void audio.play().catch(() => fail(new AiError('server')));
      }
    };
    stream.getTracks().forEach((track) => pc!.addTrack(track, stream!));
    channel = pc.createDataChannel('oai-events');
    channel.onmessage = (e) => {
      const event = parseRealtimeEvent(e.data);
      // OpenAI가 보낸 오류 이벤트 원문을 개발자 도구 콘솔에 남겨 원인을 확인할 수 있게 한다(비밀값 없음).
      if (event?.type === 'error') console.error('realtime error event', e.data);
      if (!event || stopped) return;
      if (event.type === 'state') cb.onState(event.state);
      if (event.type === 'assistant') cb.onAssistantText(event.itemId, event.text, event.done);
      if (event.type === 'user') cb.onUserText(event.itemId, event.text);
      if (event.type === 'error') fail(new AiError('server'));
    };
    channel.onclose = () => fail(new AiError('network'));
    channel.onerror = () => fail(new AiError('network'));
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'connected') {
        clearTimeout(connectTimer);
        cb.onState('listening');
      }
      if (['failed', 'disconnected', 'closed'].includes(pc?.connectionState ?? '')) fail(new AiError('network'));
    };
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIce(pc);
    const result = await aiRequest(cfg, '/api/realtime/session', { ...req, offerSdp: pc.localDescription?.sdp ?? '' });
    if (
      !result ||
      typeof result !== 'object' ||
      !('sessionId' in result) ||
      typeof result.sessionId !== 'string' ||
      !('answerSdp' in result) ||
      typeof result.answerSdp !== 'string' ||
      !('remainingSeconds' in result) ||
      typeof result.remainingSeconds !== 'number' ||
      !Number.isFinite(result.remainingSeconds) ||
      result.remainingSeconds <= 0
    )
      throw new AiError('server');
    session = result as SessionResponse;
    if (stopped) {
      await aiRequest(cfg, '/api/realtime/end', { sessionId: session.sessionId, seconds: 0 }, true);
      throw new AiError('network');
    }
    capTimer = setTimeout(() => {
      void stop();
    }, session.remainingSeconds * 1000);
    connectTimer = setTimeout(() => fail(new AiError('network')), 15000);
    await pc.setRemoteDescription({ type: 'answer', sdp: session.answerSdp });
    return {
      stop,
      setMicEnabled: (on) => {
        if (!stopped)
          stream?.getAudioTracks().forEach((track) => {
            track.enabled = on;
          });
      },
      sendSystemNote: (text) => {
        if (stopped || channel?.readyState !== 'open' || !['[WRAP_UP]', '[STUCK]'].includes(text)) return;
        // 시스템 역할을 새로 만들지 않고 서버가 허용한 신호만 사용자 항목으로 보낸다.
        channel.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
          }),
        );
        channel.send(JSON.stringify({ type: 'response.create' }));
      },
    };
  } catch (e) {
    const error = e instanceof AiError ? e : new AiError('network');
    if (session) await stop();
    else cleanup();
    cb.onState('error');
    cb.onError(error);
    throw error;
  }
}
