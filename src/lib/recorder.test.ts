// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startRecording, type RecorderEnv } from './recorder';
function fixture() {
  const stopTrack = vi.fn(), stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
  const events = new EventTarget(); let hidden = false, clock = 0;
  const rec = { state: 'inactive', ondataavailable: null as ((event: { data: Blob }) => void) | null, onstop: null as (() => void) | null, onerror: null as (() => void) | null, start: vi.fn(() => { rec.state = 'recording'; }), stop: vi.fn(() => { rec.state = 'inactive'; rec.ondataavailable?.({ data: new Blob(['memory-only']) }); rec.onstop?.(); }) };
  const env: RecorderEnv = { now: () => clock, getUserMedia: vi.fn(async () => stream), create: vi.fn(() => rec as unknown as MediaRecorder), supports: type => type === 'audio/webm;codecs=opus', document: { get hidden() { return hidden; }, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) } };
  return { env, rec, stopTrack, advance: (ms: number) => { clock += ms; }, hide: () => { hidden = true; events.dispatchEvent(new Event('visibilitychange')); } };
}
afterEach(() => vi.useRealTimers());
describe('메모리 녹음과 마이크 정리', () => {
  it('webm/opus 우선, mp4 대체, 멈춘 시각과 Blob만 반환한다', async () => {
    vi.useFakeTimers(); const f = fixture(); const handle = await startRecording({ env: f.env }); f.advance(2300); handle.stop(); const result = await handle.result; expect(result.durationSec).toBe(2.3); expect(result.audio.type).toBe('audio/webm;codecs=opus'); expect(await result.audio.text()).toBe('memory-only'); expect(f.stopTrack).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    const ios = fixture(); ios.env.supports = type => type === 'audio/mp4'; const next = await startRecording({ env: ios.env }); next.stop(); expect((await next.result).audio.type).toBe('audio/mp4');
  });
  it('interval 횟수 대신 경과 시간으로 2분 자동 종료한다', async () => { vi.useFakeTimers(); const f = fixture(), tick = vi.fn(); const handle = await startRecording({ env: f.env, onTick: tick }); f.advance(120000); await vi.advanceTimersByTimeAsync(100); expect((await handle.result).durationSec).toBe(120); expect(tick).toHaveBeenCalledWith(0); expect(f.rec.stop).toHaveBeenCalledTimes(1); expect(f.stopTrack).toHaveBeenCalled(); });
  it('숨김은 종료하고 이탈은 녹음을 버린다. 늦은 결과는 무시한다', async () => { vi.useFakeTimers(); const f = fixture(), handle = await startRecording({ env: f.env }); f.hide(); expect((await handle.result).audio.size).toBeGreaterThan(0); expect(f.stopTrack).toHaveBeenCalled(); const second = fixture(), canceled = await startRecording({ env: second.env }); canceled.dispose(); await expect(canceled.result).rejects.toMatchObject({ name: 'AbortError' }); expect(second.rec.ondataavailable).toBeNull(); expect(second.rec.onstop).toBeNull(); expect(vi.getTimerCount()).toBe(0); });
  it('권한 응답이 이탈 뒤 도착해도 트랙을 닫고 녹음을 시작하지 않는다', async () => { const f = fixture(), controller = new AbortController(); let resolve!: (stream: MediaStream) => void; f.env.getUserMedia = () => new Promise(done => { resolve = done; }); const pending = startRecording({ env: f.env, signal: controller.signal }); controller.abort(); resolve({ getTracks: () => [{ stop: f.stopTrack }] } as unknown as MediaStream); await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(f.stopTrack).toHaveBeenCalledOnce(); expect(f.env.create).not.toHaveBeenCalled(); });
  it('권한 거부·미지원·생성 실패에서 종료를 보장한다', async () => { const f = fixture(); f.env.getUserMedia = vi.fn(async () => { throw new Error('denied'); }); await expect(startRecording({ env: f.env })).rejects.toThrow('denied'); f.env.supports = () => false; await expect(startRecording({ env: f.env })).rejects.toThrow('unsupported'); const other = fixture(); other.env.create = () => { throw new Error('create'); }; await expect(startRecording({ env: other.env })).rejects.toThrow('create'); expect(other.stopTrack).toHaveBeenCalledOnce(); });
});
it('녹음 오류 때도 진행 중 녹음과 트랙·타이머를 정리한다', async () => { vi.useFakeTimers(); const f = fixture(), handle = await startRecording({ env: f.env }); f.rec.onerror?.(); await expect(handle.result).rejects.toThrow('recording'); expect(f.rec.state).toBe('inactive'); expect(f.stopTrack).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0); });
