// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startMicrophoneTest } from './microphoneTest';
let stopTrack: ReturnType<typeof vi.fn>, close: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn>, stream: MediaStream;
beforeEach(() => {
  vi.useFakeTimers(); stopTrack = vi.fn(); close = vi.fn().mockResolvedValue(undefined); disconnect = vi.fn();
  stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('AudioContext', class { state = 'running'; resume = vi.fn().mockResolvedValue(undefined); close = close; createAnalyser() { return { fftSize: 256, getByteTimeDomainData: (bytes: Uint8Array) => bytes.fill(140) }; } createMediaStreamSource() { return { connect: vi.fn(), disconnect }; } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('3초 음량만 읽고 트랙·오디오 연결·프레임을 정리한다', async () => {
  const onVolume = vi.fn(), test = startMicrophoneTest(onVolume);
  await vi.advanceTimersByTimeAsync(0); expect(onVolume).toHaveBeenCalledWith(0.375);
  await vi.advanceTimersByTimeAsync(2999); expect(stopTrack).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); await test.done;
  expect(stopTrack).toHaveBeenCalled(); expect(close).toHaveBeenCalled(); expect(disconnect).toHaveBeenCalled(); expect(cancelAnimationFrame).toHaveBeenCalledWith(1); expect(vi.getTimerCount()).toBe(0);
});
it('나간 뒤 늦게 허용한 스트림도 즉시 닫고 음량을 읽지 않는다', async () => {
  let resolve!: (stream: MediaStream) => void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(done => { resolve = done; }));
  const onVolume = vi.fn(), test = startMicrophoneTest(onVolume); test.stop(); resolve(stream); await test.done;
  expect(stopTrack).toHaveBeenCalled(); expect(onVolume).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('권한 오류나 오디오 시작 실패도 자원을 남기지 않는다', async () => {
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new Error('not-allowed'));
  await expect(startMicrophoneTest(vi.fn()).done).rejects.toThrow('not-allowed'); expect(vi.getTimerCount()).toBe(0);
  vi.stubGlobal('AudioContext', class { state = 'running'; close = close; resume = vi.fn().mockRejectedValue(new Error('audio-failed')); });
  await expect(startMicrophoneTest(vi.fn()).done).rejects.toThrow('audio-failed'); expect(stopTrack).toHaveBeenCalled(); expect(close).toHaveBeenCalled();
});
it('오디오 컨텍스트 생성과 재개는 권한 응답 전 사용자 동작 안에서 시작한다', async () => {
  let resolve!: (stream: MediaStream) => void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(done => { resolve = done; }));
  const resume = vi.fn().mockResolvedValue(undefined), constructed = vi.fn();
  vi.stubGlobal('AudioContext', class { state = 'suspended'; close = close; resume = resume; constructor() { constructed(); } });
  const test = startMicrophoneTest(vi.fn());
  expect(constructed).toHaveBeenCalledOnce(); expect(resume).toHaveBeenCalledOnce();
  test.stop(); await test.done; resolve(stream); await vi.advanceTimersByTimeAsync(0);
  expect(stopTrack).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it('resume가 끝나지 않아도 마이크를 연 뒤 3초에 실패를 알리고 모두 정리한다', async () => {
  vi.stubGlobal('AudioContext', class { state = 'suspended'; close = close; resume = () => new Promise<void>(() => {}); });
  const volume = vi.fn(), test = startMicrophoneTest(volume), failed = expect(test.done).rejects.toThrow('audio-timeout');
  await vi.advanceTimersByTimeAsync(2999); expect(stopTrack).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); await failed;
  expect(stopTrack).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(volume).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('재개 대기 중 취소도 done을 완료하며 늦은 재개는 음량을 읽지 않는다', async () => {
  let resume!: () => void;
  vi.stubGlobal('AudioContext', class { state = 'suspended'; close = close; resume = () => new Promise<void>(resolve => { resume = resolve; }); });
  const volume = vi.fn(), test = startMicrophoneTest(volume);
  await vi.advanceTimersByTimeAsync(0); test.stop(); await test.done;
  resume(); await vi.advanceTimersByTimeAsync(10000);
  expect(stopTrack).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(volume).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('재개 실패가 권한 응답보다 먼저 와도 나중에 열린 스트림을 정리한다', async () => {
  let resolve!: (stream: MediaStream) => void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(done => { resolve = done; }));
  vi.stubGlobal('AudioContext', class { state = 'suspended'; close = close; resume = vi.fn().mockRejectedValue(new Error('audio-failed')); });
  const volume = vi.fn(), test = startMicrophoneTest(volume);
  await expect(test.done).rejects.toThrow('audio-failed'); resolve(stream); await vi.advanceTimersByTimeAsync(0);
  expect(stopTrack).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(volume).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
