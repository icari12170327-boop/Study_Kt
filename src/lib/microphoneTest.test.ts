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
