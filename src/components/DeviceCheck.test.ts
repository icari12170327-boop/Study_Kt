// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DeviceCheck } from './DeviceCheck';
import { Parent } from '../pages/Parent';
import { App } from '../App';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { toDateKey } from '../lib/date';
import { startMicrophoneTest } from '../lib/microphoneTest';
import * as speech from '../lib/speech';
vi.mock('../lib/microphoneTest', () => ({ startMicrophoneTest: vi.fn() }));
vi.mock('../lib/speech', async original => ({ ...await original<typeof import('../lib/speech')>(), canSpeak: vi.fn(() => true), canRecognize: vi.fn(() => false), speak: vi.fn().mockResolvedValue(undefined) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, persist: ReturnType<typeof vi.fn>;
const saved = () => JSON.parse(localStorage.getItem('study-kt:v1')!);
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === text)!;
async function click(text: string) { await act(async () => button(text).click()); }
async function mount(child = createElement(Parent, { go: vi.fn() })) { await act(async () => root.render(createElement(StoreProvider, null, child))); }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 12)); persist = vi.fn().mockResolvedValue(false);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false }))); vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
  Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist, persisted: vi.fn().mockResolvedValue(true), estimate: vi.fn().mockResolvedValue({ usage: 100, quota: 10000 }) } });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: vi.fn().mockRejectedValue(new Error('unsupported')) } });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  vi.stubGlobal('speechSynthesis', { getVoices: () => [{ lang: 'en-US' }, { lang: 'en-GB' }], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn() });
  vi.mocked(startMicrophoneTest).mockReset(); vi.mocked(speech.speak).mockClear();
  const state = defaultState(); state.settings.parent.lastBackupAt = '2026-09-27'; localStorage.clear(); localStorage.setItem('study-kt:v1', JSON.stringify(state));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('앱 첫 실행과 보호자 진입에서 저장 보호를 요청하고 거절돼도 화면을 연다', async () => {
  await mount(createElement(App)); expect(persist).toHaveBeenCalledTimes(1);
  await mount(); expect(persist).toHaveBeenCalledTimes(2); expect(host.textContent).toContain('보호자 모드');
});
it('Safari 탭 안내는 닫으면 다시 보이지 않고 14일 경계에서만 백업을 안내한다', async () => {
  await mount(); expect(host.textContent).toContain('Safari 탭과 홈 화면 앱은 기록이 따로예요. 옮기려면 백업 파일을 쓰세요'); expect(host.textContent).toContain('백업한 지 14일 지났어요');
  await click('안내 닫기'); expect(saved().settings.parent.iosTabNoticeDismissed).toBe(true); expect(host.textContent).not.toContain('Safari 탭과');
  await act(async () => root.render(null)); const state = saved(); state.settings.parent.lastBackupAt = '2026-09-28'; localStorage.setItem('study-kt:v1', JSON.stringify(state));
  await mount(); expect(host.textContent).not.toContain('Safari 탭과'); expect(host.textContent).not.toContain('백업한 지');
});
it('백업 날짜가 없는 기존 사용자에게는 경과일을 추정하지 않고 첫 백업을 안내한다', async () => {
  const state = defaultState(); localStorage.setItem('study-kt:v1', JSON.stringify(state));
  await mount(); expect(host.textContent).toContain('아직 백업 기록이 없어요'); expect(host.textContent).not.toContain('백업한 지');
  expect(saved().settings.parent.lastBackupAt).toBeUndefined();
});
it('관측 API 실패와 음성 인식 없음에도 모든 항목과 TTS·마이크 시험은 독립적으로 보인다', async () => {
  await mount(createElement(DeviceCheck));
  for (const text of ['화면', '홈 화면 앱', '음성 인식', '영어 읽기 목소리', '2개', '마이크 권한', '조회 미지원', '저장 보호', '보호됨', '마지막 백업(받기 시작)', '2026-09-27']) expect(host.textContent).toContain(text);
  await click('🔊 소리 시험'); expect(speech.speak).toHaveBeenCalledWith(expect.any(String), { lang: 'en-US' });
  let resolve!: () => void; const stop = vi.fn();
  vi.mocked(startMicrophoneTest).mockImplementation(onVolume => { onVolume(0.5); return { done: new Promise(done => { resolve = done; }), stop }; });
  await click('🎤 마이크 시험'); expect(host.querySelector('meter')?.getAttribute('value')).toBe('0.5'); expect(button('마이크 시험 중…').disabled).toBe(true);
  await act(async () => root.render(null)); expect(stop).toHaveBeenCalledOnce(); await act(async () => resolve());
});
it('마이크 재개가 멈춰도 시간 초과·화면 숨김 뒤 시험 버튼을 다시 쓸 수 있다', async () => {
  vi.useFakeTimers();
  const actual = await vi.importActual<typeof import('../lib/microphoneTest')>('../lib/microphoneTest');
  vi.mocked(startMicrophoneTest).mockImplementation(actual.startMicrophoneTest);
  const stop = vi.fn(), close = vi.fn().mockResolvedValue(undefined);
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  vi.stubGlobal('AudioContext', class { state = 'suspended'; close = close; resume = () => new Promise<void>(() => {}); });
  await mount(createElement(DeviceCheck)); await click('🎤 마이크 시험');
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(stop).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(button('🎤 마이크 시험').disabled).toBe(false);
  expect(host.textContent).toContain('마이크를 쓰지 못했어요');
  await click('🎤 마이크 시험');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(stop).toHaveBeenCalledTimes(2); expect(close).toHaveBeenCalledTimes(2); expect(button('🎤 마이크 시험').disabled).toBe(false);
});
it('내보내기 시작 성공 때만 백업 날짜를 갱신하며 학습 데이터는 그대로다', async () => {
  await mount(); await click('백업·보안'); const before = saved();
  vi.spyOn(URL, 'createObjectURL').mockImplementationOnce(() => { throw new Error('download-failed'); });
  await click('백업 파일 받기'); expect(saved().settings.parent.lastBackupAt).toBe('2026-09-27'); expect(host.textContent).toContain('백업 파일을 만들지 못했어요');
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {}); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await click('백업 파일 받기'); expect(saved().settings.parent.lastBackupAt).toBe(toDateKey()); expect(saved().data).toEqual(before.data); expect(saved().version).toBe(2);
  expect(host.textContent).toContain('백업 파일 받기를 시작했어요. 저장된 파일을 확인해 주세요.');
  expect(host.textContent).not.toContain('백업 파일을 받았어요');
});
