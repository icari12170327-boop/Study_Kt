import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endRealtimeSession, parseRealtimeEvent, startTalk, stopLocalTalks, type TalkCallbacks } from './realtime';
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
    onopen: null as (() => void) | null,
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
          : url.endsWith('/active') ? { sessions: [] } : url.endsWith('/end-active') ? { ok: true, closed: 1, chargedSeconds: 60 } : { ok: true, seconds: 60 },
      ),
    );
  vi.stubGlobal('fetch', fetcher);
});
afterEach(async () => {
  await stopLocalTalks(cfg, 'all');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('WebRTC 연결과 자원 해제', () => {
  it.each(['kid-friend', 'biz-talk', 'parent-coach'] as const)('%s: 코치만 채널이 열리면 한 번 먼저 인사를 요청한다', async mode => {
    const input = mode === 'kid-friend' ? req : { ...req, profileId: 'parent' as const, level: 'adult' as const, mode,
      ...(mode === 'parent-coach' ? { coachTopic: 'daily' as const, coach: { level: 'zero' as const, repeat: 'mid' as const }, speed: 0.85 as const } : { scenarioId: 'biz-free' }) };
    const handle = await startTalk(cfg, input, cb);
    FakePeer.instance.channel.onopen?.(); FakePeer.instance.channel.onopen?.();
    expect(FakePeer.instance.channel.send.mock.calls.map(([text]) => JSON.parse(text).type)).toEqual(mode === 'parent-coach' ? ['response.create'] : []);
    await handle.stop(); expect(FakePeer.instance.channel.onopen).toBeNull();
  });
  it('코치의 음성 종료와 자막은 응답 ID로 연결하고 텍스트 완료를 음성 종료로 바꾸지 않는다', async () => {
    cb.onFriendFinished = vi.fn();
    const handle = await startTalk(cfg, { ...req, profileId: 'parent', level: 'adult', mode: 'parent-coach', coachTopic: 'daily', coach: { level: 'zero', repeat: 'mid' } }, cb);
    const emit = (data: object) => FakePeer.instance.channel.onmessage?.({ data: JSON.stringify(data) });
    emit({ type: 'response.output_audio_transcript.done', item_id: 'a', response_id: 'response-a', transcript: 'Hi!' });
    expect(cb.onAssistantText).toHaveBeenCalledWith('a', 'Hi!', true, 'response-a'); expect(cb.onFriendFinished).not.toHaveBeenCalled();
    emit({ type: 'response.done', response: { status: 'completed' } }); expect(cb.onFriendFinished).not.toHaveBeenCalled();
    emit({ type: 'output_audio_buffer.stopped', response_id: 'response-a' }); expect(cb.onFriendFinished).toHaveBeenCalledExactlyOnceWith('response-a');
    await handle.stop();
  });
  it('종료 응답의 서버 기록 시간을 한 번만 전달한다', async () => {
    cb.onCharged = vi.fn();
    const handle = await startTalk(cfg, req, cb);
    fetcher.mockResolvedValueOnce(Response.json({ ok: true, seconds: 65 }));
    await Promise.all([handle.stop(), handle.stop()]);
    expect(cb.onCharged).toHaveBeenCalledExactlyOnceWith(65);
  });
  it('눌러서 말하기는 처음 마이크를 끄고 누름·해제에 버퍼 커밋과 응답을 한 번만 요청한다', async () => {
    cb.onConnected = vi.fn(); cb.onUserSpeaking = vi.fn();
    const handle = await startTalk(cfg, { ...req, pushToTalk: true }, cb);
    expect(track.enabled).toBe(false);
    expect(cb.onConnected).toHaveBeenCalledWith(60);
    handle.beginPushToTalk(); handle.beginPushToTalk();
    expect(track.enabled).toBe(true);
    await vi.advanceTimersByTimeAsync(250);
    handle.endPushToTalk(); handle.endPushToTalk();
    expect(track.enabled).toBe(false);
    expect(FakePeer.instance.channel.send.mock.calls.map(([text]) => JSON.parse(text).type)).toEqual(['input_audio_buffer.clear', 'input_audio_buffer.commit', 'response.create']);
    expect(cb.onUserSpeaking).toHaveBeenCalledTimes(1);
    await handle.stop();
  });
  it('짧게 누른 빈 오디오는 커밋하지 않고 창이 흐려지면 눌러서 말하기 마이크를 끈다', async () => {
    const handle = await startTalk(cfg, { ...req, pushToTalk: true }, cb);
    handle.beginPushToTalk(); handle.endPushToTalk();
    expect(FakePeer.instance.channel.send.mock.calls.map(([text]) => JSON.parse(text).type)).toEqual(['input_audio_buffer.clear', 'input_audio_buffer.clear']);
    handle.beginPushToTalk();
    await vi.advanceTimersByTimeAsync(250);
    win.dispatchEvent(new Event('blur'));
    expect(track.enabled).toBe(false);
    expect(FakePeer.instance.channel.send.mock.calls.some(([text]) => JSON.parse(text).type === 'input_audio_buffer.commit')).toBe(true);
    await handle.stop();
  });
  it('응답 생성·재생 중 시스템 신호는 다음 응답까지 기다려 대화 중 오류를 피한다', async () => {
    cb.onUserSpeaking = vi.fn(); cb.onFriendFinished = vi.fn();
    const handle = await startTalk(cfg, req, cb);
    const emit = (type: string) => FakePeer.instance.channel.onmessage?.({ data: JSON.stringify({ type }) });
    emit('response.created'); emit('output_audio_buffer.started');
    handle.sendSystemNote('[STUCK]');
    expect(FakePeer.instance.channel.send).toHaveBeenCalledTimes(1);
    emit('response.done');
    expect(FakePeer.instance.channel.send).toHaveBeenCalledTimes(1);
    emit('output_audio_buffer.stopped');
    expect(FakePeer.instance.channel.send).toHaveBeenCalledTimes(2);
    expect(cb.onFriendFinished).toHaveBeenCalledTimes(1);
    emit('input_audio_buffer.speech_started');
    expect(cb.onUserSpeaking).toHaveBeenCalledTimes(1);
    await handle.stop();
  });
  it('권한 대기 중 화면 이탈하면 늦게 받은 마이크를 끄고 외부 세션을 만들지 않는다', async () => {
    let resolve!: (stream: unknown) => void;
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise((done) => { resolve = done; }) } });
    const abort = new AbortController();
    const opening = startTalk(cfg, req, cb, abort.signal);
    abort.abort();
    resolve({ getTracks: () => [track], getAudioTracks: () => [track] });
    await expect(opening).rejects.toMatchObject({ kind: 'network' });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
  });
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
    expect(fetcher.mock.calls.find(([url]) => String(url).endsWith('/end'))![1].keepalive).toBe(true);
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


describe('서버 종료 복구', () => {
  it('실패 뒤 /end를 한 번 재시도하고 서버 시간을 반환한다', async () => {
    fetcher.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({ ok: true, seconds: 12 }));
    expect(await endRealtimeSession(cfg, 'kid1', 'session', 99)).toBe(12);
    expect(fetcher.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(['/api/realtime/end', '/api/realtime/end']);
    expect(fetcher.mock.calls.every(([, init]) => init.keepalive)).toBe(true);
  });
  it('두 번 실패하거나 응답이 잘못되면 같은 프로필만 대체 종료한다', async () => {
    fetcher.mockResolvedValueOnce(Response.json({ ok: false })).mockRejectedValueOnce(new Error('offline'));
    expect(await endRealtimeSession(cfg, 'kid2', 'session', 10)).toBeUndefined();
    expect(fetcher.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(['/api/realtime/end', '/api/realtime/end', '/api/realtime/end-active']);
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ profileId: 'kid2' });
    expect(fetcher.mock.calls[2][1].keepalive).toBe(true);
  });
  it('대체 경로까지 실패하면 종료 미확인을 알린다', async () => {
    fetcher.mockRejectedValue(new Error('offline'));
    await expect(endRealtimeSession(cfg, 'kid1', 'session', 10)).rejects.toMatchObject({ kind: 'network' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('시작 전에 같은 프로필의 남은 세션만 정리한다', async () => {
    fetcher.mockResolvedValueOnce(Response.json({ sessions: [{ profileId: 'kid1', sessionId: 'old', startedAt: 0, elapsedSeconds: 1, remainingSeconds: 59 }] }));
    const handle = await startTalk(cfg, req, cb);
    expect(fetcher.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(['/api/realtime/active', '/api/realtime/end-active', '/api/realtime/session']);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ profileId: 'kid1' });
    await handle.stop();
  });
  it.each(['stop', 'pagehide', 'abort', 'time', 'error'] as const)('%s도 같은 재시도·대체 종료와 상태를 전달한다', async path => {
    const abort = new AbortController(); cb.onEndStatus = vi.fn();
    const handle = await startTalk(cfg, req, cb, abort.signal);
    fetcher.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
    if (path === 'stop') await handle.stop();
    if (path === 'pagehide') win.dispatchEvent(new Event('pagehide'));
    if (path === 'abort') abort.abort();
    if (path === 'time') await vi.advanceTimersByTimeAsync(60000);
    if (path === 'error') FakePeer.instance.channel.onmessage?.({ data: JSON.stringify({ type: 'error' }) });
    await handle.stop();
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/end'))).toHaveLength(2);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/end-active'))).toHaveLength(1);
    expect(cb.onEndStatus).toHaveBeenNthCalledWith(1, 'pending');
    expect(cb.onEndStatus).toHaveBeenLastCalledWith('confirmed');
    expect(track.stop).toHaveBeenCalledTimes(1);
  });
  it('종료가 모두 실패하면 pending 다음 failed 상태를 알린다', async () => {
    cb.onEndStatus = vi.fn(); const handle = await startTalk(cfg, req, cb);
    fetcher.mockRejectedValue(new Error('offline')); await handle.stop();
    expect(vi.mocked(cb.onEndStatus!).mock.calls).toEqual([['pending'], ['failed']]);
  });
  it('이탈 뒤 늦게 생성된 세션도 재시도와 대체 경로로 정리한다', async () => {
    let resolve!: (response: Response) => void;
    fetcher.mockImplementationOnce(async () => Response.json({ sessions: [] }))
      .mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const abort = new AbortController(), opening = startTalk(cfg, req, cb, abort.signal);
    await vi.waitFor(() => expect(resolve).toBeDefined());
    abort.abort();
    fetcher.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
    resolve(Response.json({ sessionId: 'late', answerSdp: 'v=0', remainingSeconds: 60 }));
    await expect(opening).rejects.toMatchObject({ kind: 'network' });
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/end'))).toHaveLength(2);
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/end-active'))).toBe(true);
  });
});
