// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ParentVoiceSettings, TalkRecords } from './TalkRecords';
import { TalkSession } from './TalkSession';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { startTalk, type TalkCallbacks } from '../lib/realtime';
import { AiError, fetchUsage, generate } from '../lib/ai';
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
it.each(['failed', 'confirmed'] as const)('먼저 확정된 종료 상태 %s를 오류·완료 콜백이 대기로 되돌리지 않는다', async status => {
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId: 'kid1', go: vi.fn() }))));
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent?.includes('시작') && !b.disabled)!.click());
  // 시간 종료처럼 stop이 이미 진행된 뒤 화면의 finish가 호출되는 순서를 재현한다.
  stop.mockResolvedValue(undefined);
  await act(async () => {
    callbacks.onEndStatus?.(status);
    if (status === 'failed') callbacks.onError(new AiError('network'));
    callbacks.onState('ended');
  });
  expect(host.textContent).not.toContain('대화를 정리하고 있어요…');
  expect(host.textContent?.includes('연결 정리가 안 됐어요.')).toBe(status === 'failed');
});

it('보호자 목소리 카드는 저장되고 코치·비즈니스 요청과 화면 이름을 바꾼다', async () => {
  await act(async () => root.render(createElement(StoreProvider, null, createElement(ParentVoiceSettings))));
  await click('🧑 차분한 남성 · Alex');
  expect(JSON.parse(localStorage.getItem('study-kt:v1')!).settings.parent.talk).toMatchObject({ voice: 'cedar', voiceStyle: 'calm-man', friendName: 'Alex' });
  await click('👩 젊고 친절한 여성 · Emma');
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId: 'parent', go: vi.fn() }))));
  expect(host.textContent).toContain('대화 상대: Emma');
  await click('🌱 코치 모드한국어로 대답하고 쉬운 영어를 따라 해요.');
  const start = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('시작') && !b.disabled)!;
  await act(async () => start.click());
  expect(vi.mocked(startTalk).mock.lastCall![1].persona).toMatchObject({ voice: 'coral', voiceStyle: 'young-woman', friendName: 'Emma' });
  await act(async () => callbacks.onAssistantText('a', 'Hello!', true));
  expect(host.textContent).toContain('Emma의 말을 먼저 들어 보세요…');
  expect(host.textContent).not.toContain('Alex의 말을');
});
it('아이 목소리 카드는 저장되고 고급 설정에 열 가지 목소리를 남긴다', async () => {
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkRecords))));
  await click('👧 또래 여자아이');
  expect(JSON.parse(localStorage.getItem('study-kt:v1')!).settings.kid1.talk).toMatchObject({ voice: 'shimmer', voiceStyle: 'kid-girl' });
  expect(host.querySelector('details select')!.querySelectorAll('option')).toHaveLength(10);
  expect(host.textContent).toContain('다음 대화부터 바뀌어요');
});
it.each(['server', 'network', 'unauthorized'] as const)('코치 연결의 %s 오류도 인증 실패일 때만 Worker 설정 안내를 보여 준다', async kind => {
  vi.mocked(startTalk).mockRejectedValueOnce(new AiError(kind));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId: 'parent', go: vi.fn() }))));
  await click('🌱 코치 모드한국어로 대답하고 쉬운 영어를 따라 해요.');
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent?.includes('시작') && !b.disabled)!.click());
  const error = host.querySelector('[role=alert]')!.textContent!;
  expect(error.includes('Worker')).toBe(kind === 'unauthorized');
  if (kind !== 'unauthorized') expect(error).toBe('대화를 연결하지 못했어요. 한 번 더 눌러 주세요.');
});
it('코치 모드로 바꾸면 이전 사용량 조회 오류를 남기지 않고 코치 오류 문구로 바꾼다', async () => {
  vi.mocked(fetchUsage).mockRejectedValue(new AiError('server'));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId: 'parent', go: vi.fn() }))));
  expect(host.querySelector('[role=alert]')!.textContent).toContain('Worker 설정');
  await click('🌱 코치 모드한국어로 대답하고 쉬운 영어를 따라 해요.');
  expect(host.querySelector('[role=alert]')!.textContent).toBe('대화를 연결하지 못했어요. 한 번 더 눌러 주세요.');
});
