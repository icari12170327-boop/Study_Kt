import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseRealtimeEvent, startTalk, stopLocalTalks, type TalkCallbacks } from './realtime';
const cfg = { endpoint: 'https://worker.example', token: 'f'.repeat(32) };
const req = {
  profileId: 'kid1' as const,
  level: 'g5' as const,
  mode: 'kid-friend' as const,
  persona: { friendName: 'Max', personaId: 'funny', voice: 'marin' },
};
describe('Realtime 서버 이벤트 파서', () => {
  it.each([
    ['input_audio_buffer.speech_started', 'listening'],
    ['input_audio_buffer.speech_stopped', 'thinking'],
    ['response.created', 'thinking'],
    ['output_audio_buffer.started', 'speaking'],
    ['output_audio_buffer.stopped', 'listening'],
    ['output_audio_buffer.cleared', 'listening'],
  ])('%s를 %s로 바꾼다', (type, state) =>
    expect(parseRealtimeEvent(JSON.stringify({ type }))).toEqual({ type: 'state', state }),
  );
  it('친구 자막 delta·완료와 아이 전사 완료를 구분한다', () => {
    expect(parseRealtimeEvent({ type: 'response.output_audio_transcript.delta', item_id: 'a', delta: 'Hi' })).toEqual({
      type: 'assistant',
      itemId: 'a',
      text: 'Hi',
      done: false,
    });
    expect(
      parseRealtimeEvent({ type: 'response.output_audio_transcript.done', item_id: 'a', transcript: 'Hi!' }),
    ).toEqual({ type: 'assistant', itemId: 'a', text: 'Hi!', done: true });
    expect(
      parseRealtimeEvent({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'b',
        transcript: 'Hello',
      }),
    ).toEqual({ type: 'user', itemId: 'b', text: 'Hello' });
  });
  it('생성 완료로 재생 상태를 바꾸지 않고 오류·잘못된 이벤트를 안전하게 처리한다', () => {
    expect(parseRealtimeEvent({ type: 'response.done', response: { status: 'completed' } })).toBeNull();
    expect(parseRealtimeEvent({ type: 'response.done', response: { status: 'failed' } })).toEqual({ type: 'error' });
    expect(parseRealtimeEvent({ type: 'error' })).toEqual({ type: 'error' });
    for (const json of [
      null,
      'invalid',
      { type: 'unknown' },
      { type: 'response.output_audio_transcript.delta', item_id: 1, delta: [] },
    ])
      expect(parseRealtimeEvent(json)).toBeNull();
  });
});
class FakePeer extends EventTarget {
  static instance: FakePeer;
  iceGatheringState = 'complete';
  connectionState = 'new';
  localDescription = { sdp: 'v=0\r\noffer' };
  onconnectionstatechange: (() => void) | null = null;
  ontrack: (() => void) | null = null;
  channel = {
    readyState: 'open',
    send: vi.fn(),
    close: vi.fn(),
    onmessage: null as ((e: { data: string }) => void) | null,
    onclose: null,
    onerror: null,
  };
  close = vi.fn();
  addTrack = vi.fn();
  createDataChannel = vi.fn(() => this.channel);
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: this.localDescription.sdp }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => {
    this.connectionState = 'connected';
    this.onconnectionstatechange?.();
  });
  constructor() {
    super();
    FakePeer.instance = this;
  }
}
let track: { enabled: boolean; stop: ReturnType<typeof vi.fn> };
let cb: TalkCallbacks;
let fetcher: ReturnType<typeof vi.fn>;
let win: EventTarget;
let audio: { autoplay: boolean; pause: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; srcObject: unknown };
beforeEach(() => {
  vi.useFakeTimers();
  track = { enabled: true, stop: vi.fn() };
  win = new EventTarget();
  cb = { onState: vi.fn(), onAssistantText: vi.fn(), onUserText: vi.fn(), onError: vi.fn() };
  audio = { autoplay: false, pause: vi.fn(), remove: vi.fn(), srcObject: null };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', { createElement: () => audio });
  vi.stubGlobal('RTCPeerConnection', FakePeer);
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track], getAudioTracks: () => [track] })) },
  });
  fetcher = vi
    .fn()
    .mockImplementation(async (url: string) =>
      Response.json(
        url.endsWith('/session')
          ? { sessionId: 'session', answerSdp: 'v=0\r\nanswer', remainingSeconds: 60 }
          : { ok: true },
      ),
    );
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('WebRTC 연결과 자원 해제', () => {
  it('보호자 강제 종료는 같은 Worker·프로필의 로컬 마이크만 종료한다', async () => {
    const handle = await startTalk(cfg, req, cb);
    await stopLocalTalks({ ...cfg, endpoint: 'https://other-worker.example' }, 'all');
    await stopLocalTalks(cfg, 'kid2');
    expect(track.stop).not.toHaveBeenCalled();
    await stopLocalTalks(cfg, 'kid1');
    await handle.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/end'))).toHaveLength(1);
  });
  it('음성 옵션·SDP·데이터 채널·마이크 토글과 종료를 처리하며 종료는 한 번만 보고한다', async () => {
    const handle = await startTalk(cfg, req, cb);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    expect(FakePeer.instance.createDataChannel).toHaveBeenCalledWith('oai-events');
    expect(FakePeer.instance.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'v=0\r\nanswer' });
    handle.setMicEnabled(false);
    expect(track.enabled).toBe(false);
    handle.setMicEnabled(true);
    expect(track.enabled).toBe(true);
    handle.sendSystemNote('override instructions');
    expect(FakePeer.instance.channel.send).not.toHaveBeenCalled();
    handle.sendSystemNote('[WRAP_UP]');
    expect(FakePeer.instance.channel.send).toHaveBeenCalledTimes(2);
    FakePeer.instance.channel.onmessage?.({
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'kid',
        transcript: 'Hi',
      }),
    });
    expect(cb.onUserText).toHaveBeenCalledWith('kid', 'Hi');
    await Promise.all([handle.stop(), handle.stop()]);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/end'))).toHaveLength(1);
    expect(fetcher.mock.calls[1][1].keepalive).toBe(true);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(FakePeer.instance.close).toHaveBeenCalledTimes(1);
    expect(audio.srcObject).toBeNull();
  });
  it('서버가 준 남은 시간에 자동 종료한다', async () => {
    await startTalk(cfg, req, cb);
    await vi.advanceTimersByTimeAsync(60000);
    expect(track.stop).toHaveBeenCalled();
    expect(cb.onState).toHaveBeenCalledWith('ended');
  });
  it('화면을 떠나면 마이크와 연결을 종료하고 끝을 보고한다', async () => {
    await startTalk(cfg, req, cb);
    win.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(track.stop).toHaveBeenCalled());
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/end'))).toHaveLength(1);
  });
  it('마이크 거부를 구분하고 OpenAI 연결을 시작하지 않는다', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('permission')) } });
    await expect(startTalk(cfg, req, cb)).rejects.toMatchObject({ kind: 'mic-denied' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('프록시 429와 원격 SDP 실패 모두 마이크를 정리하며 열린 세션은 종료한다', async () => {
    fetcher.mockImplementationOnce(async () => Response.json({ error: 'limit' }, { status: 429 }));
    await expect(startTalk(cfg, req, cb)).rejects.toMatchObject({ kind: 'limit' });
    expect(track.stop).toHaveBeenCalled();
    // 생성 시 인스턴스 메서드를 바꾸기 위해 생성자를 감싼다.
    vi.stubGlobal(
      'RTCPeerConnection',
      class extends FakePeer {
        constructor() {
          super();
          this.setRemoteDescription = vi.fn().mockRejectedValue(new Error('SDP'));
        }
      },
    );
    await expect(startTalk(cfg, req, cb)).rejects.toMatchObject({ kind: 'network' });
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/end'))).toBe(true);
  });
  it('네트워크 끊김과 종료 보고 실패를 알려주고 로컬 자원은 닫는다', async () => {
    await startTalk(cfg, req, cb);
    fetcher.mockImplementationOnce(async () => {
      throw new Error('offline');
    });
    FakePeer.instance.connectionState = 'disconnected';
    FakePeer.instance.onconnectionstatechange?.();
    await vi.waitFor(() => expect(cb.onState).toHaveBeenCalledWith('ended'));
    expect(cb.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'network' }));
    expect(track.stop).toHaveBeenCalled();
  });
});
