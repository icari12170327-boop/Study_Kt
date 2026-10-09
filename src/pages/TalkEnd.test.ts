// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TalkSession } from './TalkSession';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { startTalk, type TalkCallbacks } from '../lib/realtime';
import { fetchUsage, generate } from '../lib/ai';
vi.mock('../lib/realtime', async original => ({ ...await original<typeof import('../lib/realtime')>(), startTalk: vi.fn() }));
vi.mock('../lib/ai', async original => ({ ...await original<typeof import('../lib/ai')>(), fetchUsage: vi.fn(), generate: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, callbacks: TalkCallbacks;
const stop = vi.fn();
beforeEach(() => {
  localStorage.clear(); const state = defaultState(); state.ai = { endpoint: 'https://worker.example', token: 't'.repeat(32) };
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.mocked(fetchUsage).mockResolvedValue({ today: { kid1: { talkSeconds: 0, generates: 0 }, kid2: { talkSeconds: 0, generates: 0 }, parent: { talkSeconds: 0, generates: 0 } }, month: { talkSeconds: 0, estimatedKrw: 0 } });
  vi.mocked(generate).mockRejectedValue(new Error('요약 없음'));
  stop.mockReset().mockImplementation(async () => { callbacks.onEndStatus?.('pending'); });
  vi.mocked(startTalk).mockImplementation(async (_cfg, _req, cb) => { callbacks = cb; cb.onConnected?.(60); return { stop, setMicEnabled: vi.fn(), sendSystemNote: vi.fn(), beginPushToTalk: vi.fn(), endPushToTalk: vi.fn() }; });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); });
async function click(text: string) { await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!.click()); }
it.each(['kid1', 'parent'] as const)('%s 완료 화면은 확인 대기·실패 안내와 보호자 전용 바로가기를 표시한다', async profileId => {
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId, go: vi.fn() }))));
  const start = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('시작') && !b.disabled)!;
  await act(async () => start.click()); await click('끝내기');
  expect(stop).toHaveBeenCalledTimes(1); expect(host.textContent).toContain('대화를 정리하고 있어요…');
  await act(async () => callbacks.onEndStatus?.('failed'));
  expect(host.textContent).toContain('연결 정리가 안 됐어요. 보호자 모드 → AI 연결에서 끝내 주세요');
  expect(host.textContent?.includes('보호자 모드로 가기')).toBe(profileId === 'parent');
  await act(async () => callbacks.onEndStatus?.('confirmed'));
  expect(host.textContent).not.toContain('대화를 정리하고 있어요…');
  expect(host.textContent).not.toContain('연결 정리가 안 됐어요.');
});
