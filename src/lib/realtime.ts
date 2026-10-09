import { AiError, aiRequest, fetchActiveSessions, endActiveSessions, normalizeAiConfig, type AiConfig, type SessionRequest, type SessionResponse } from './ai';
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
  beginPushToTalk(): void;
  endPushToTalk(): void;
}
export type TalkEndStatus = 'pending' | 'confirmed' | 'failed';
export interface TalkCallbacks {
  onState(state: TalkState): void;
  onAssistantText(itemId: string, delta: string, done: boolean, responseId?: string): void;
  onUserText(itemId: string, text: string): void;
  onError(error: AiError): void;
  onConnected?(remainingSeconds: number): void;
  onUserSpeaking?(): void;
  onFriendFinished?(responseId?: string): void;
  onCharged?(seconds: number): void;
  onEndStatus?(status: TalkEndStatus): void;
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
// 종료 응답이 없거나 잘못됐을 때 한 번 재시도한 뒤 해당 프로필의 서버 세션을 정리한다.
export async function endRealtimeSession(cfg: AiConfig, profileId: SessionRequest['profileId'], sessionId: string, seconds: number): Promise<number | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const receipt = await aiRequest(cfg, '/api/realtime/end', { sessionId, seconds }, true);
      if (receipt && typeof receipt === 'object' && 'ok' in receipt && receipt.ok === true && 'seconds' in receipt && typeof receipt.seconds === 'number' && Number.isFinite(receipt.seconds) && receipt.seconds >= 0 && receipt.seconds <= 86400)
        return Math.floor(receipt.seconds);
    } catch { /* 최종 실패는 대체 종료 경로의 결과로 알린다. */ }
  }
  await endActiveSessions(cfg, profileId, true);
  // 이미 /end가 저장됐을 수 있어 대체 경로의 0초를 현재 대화의 사용 시간으로 전달하지 않는다.
  return undefined;
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
  signal?: AbortSignal,
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
  let connected = false;
  let expiresAt = Infinity;
  let pressing = false;
  let pressStarted = 0;
  let responseActive = false;
  let audioPlaying = false;
  let pendingResponse = false;
  let greetingRequested = false;
  const requestResponse = () => {
    pendingResponse = true;
    if (!responseActive && !audioPlaying && !stopped && channel?.readyState === 'open') {
      pendingResponse = false;
      responseActive = true;
      channel.send(JSON.stringify({ type: 'response.create' }));
    }
  };
  const releasePress = () => {
    if (!req.pushToTalk) return;
    stream?.getAudioTracks().forEach((track) => { track.enabled = false; });
    if (!pressing || stopped || channel?.readyState !== 'open') { pressing = false; return; }
    pressing = false;
    // 아주 짧은 탭은 빈 오디오 커밋 오류 대신 버퍼만 비운다.
    if (performance.now() - pressStarted < 200) channel.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    else { channel.send(JSON.stringify({ type: 'input_audio_buffer.commit' })); requestResponse(); }
  };
  const hidden = () => { if (document.hidden) releasePress(); };
  const cleanup = () => {
    localTalks.delete(localTalk);
    clearTimeout(capTimer);
    clearTimeout(connectTimer);
    window.removeEventListener('pagehide', pagehide);
    signal?.removeEventListener('abort', pagehide);
    window.removeEventListener('blur', releasePress);
    document.removeEventListener?.('visibilitychange', hidden);
    stream?.getTracks().forEach((track) => track.stop());
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.ontrack = null;
    }
    if (channel) {
      channel.onopen = null;
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
        if (session) {
          cb.onEndStatus?.('pending');
          const seconds = await endRealtimeSession(cfg, req.profileId, session.sessionId, Math.max(0, Math.floor((performance.now() - started) / 1000)));
          if (seconds !== undefined) cb.onCharged?.(seconds);
          cb.onEndStatus?.('confirmed');
        }
      } catch (e) {
        cb.onEndStatus?.('failed');
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
    signal?.addEventListener('abort', pagehide, { once: true });
    window.addEventListener('blur', releasePress);
    document.addEventListener?.('visibilitychange', hidden);
    if (signal?.aborted) throw new AiError('network');
    if (!navigator.mediaDevices?.getUserMedia) throw new AiError('mic-denied');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      throw new AiError('mic-denied');
    }
    if (stopped) {
      throw new AiError('network');
    }
    if (req.pushToTalk) stream.getAudioTracks().forEach((track) => { track.enabled = false; });
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
    // 코치만 연결 직후 먼저 인사한다. 기존 아이·상황극의 시작 방식은 유지한다.
    if (req.mode === 'parent-coach') channel.onopen = () => {
      if (greetingRequested) return;
      greetingRequested = true; requestResponse();
    };
    channel.onmessage = (e) => {
      const event = parseRealtimeEvent(e.data);
      if (stopped) return;
      let responseId: string | undefined;
      try {
        const raw = JSON.parse(e.data) as { type?: string; response_id?: unknown };
        if (typeof raw.response_id === 'string') responseId = raw.response_id;
        if (raw.type === 'response.created') responseActive = true;
        if (raw.type === 'response.done') responseActive = false;
        if (raw.type === 'output_audio_buffer.started') audioPlaying = true;
        if (raw.type === 'output_audio_buffer.stopped' || raw.type === 'output_audio_buffer.cleared') audioPlaying = false;
        if (raw.type === 'input_audio_buffer.speech_started') cb.onUserSpeaking?.();
        if (raw.type === 'output_audio_buffer.stopped') {
          if (req.mode === 'parent-coach') cb.onFriendFinished?.(responseId);
          else cb.onFriendFinished?.();
        }
        if (pendingResponse) requestResponse();
      } catch { /* 잘못된 이벤트는 파서가 걸러낸다. */ }
      if (!event) return;
      if (event.type === 'state') cb.onState(event.state);
      if (event.type === 'assistant') {
        if (req.mode === 'parent-coach') cb.onAssistantText(event.itemId, event.text, event.done, responseId);
        else cb.onAssistantText(event.itemId, event.text, event.done);
      }
      if (event.type === 'user') cb.onUserText(event.itemId, event.text);
      if (event.type === 'error') fail(new AiError('server'));
    };
    channel.onclose = () => fail(new AiError('network'));
    channel.onerror = () => fail(new AiError('network'));
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'connected') {
        clearTimeout(connectTimer);
        if (!connected && session) {
          connected = true;
          cb.onConnected?.(Math.max(0, Math.ceil((expiresAt - performance.now()) / 1000)));
        }
        cb.onState('listening');
      }
      if (['failed', 'disconnected', 'closed'].includes(pc?.connectionState ?? '')) fail(new AiError('network'));
    };
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIce(pc);
    if (stopped) throw new AiError('network');
    const active = await fetchActiveSessions(cfg);
    if (stopped) throw new AiError('network');
    if (active.some((entry) => entry.profileId === req.profileId)) await endActiveSessions(cfg, req.profileId);
    if (stopped) throw new AiError('network');
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
    expiresAt = performance.now() + session.remainingSeconds * 1000;
    if (stopped) {
      // 권한·연결 대기 중 끝낸 뒤 늦게 열린 세션도 같은 재시도 경로로 종료한다.
      await stopping;
      stopping = undefined;
      await stop();
      throw new AiError('network');
    }
    capTimer = setTimeout(() => {
      void stop();
    }, session.remainingSeconds * 1000);
    connectTimer = setTimeout(() => fail(new AiError('network')), 15000);
    await pc.setRemoteDescription({ type: 'answer', sdp: session.answerSdp });
    const mic = (on: boolean) => {
      if (!stopped) stream?.getAudioTracks().forEach((track) => { track.enabled = on; });
    };
    return {
      stop,
      setMicEnabled: mic,
      beginPushToTalk: () => {
        if (!req.pushToTalk || stopped || pressing || channel?.readyState !== 'open') return;
        pressing = true;
        pressStarted = performance.now();
        channel.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
        mic(true);
        cb.onUserSpeaking?.();
      },
      endPushToTalk: releasePress,
      sendSystemNote: (text) => {
        if (stopped || channel?.readyState !== 'open' || !['[WRAP_UP]', '[STUCK]'].includes(text)) return;
        // 시스템 역할을 새로 만들지 않고 서버가 허용한 신호만 사용자 항목으로 보낸다.
        channel.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
          }),
        );
        requestResponse();
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
