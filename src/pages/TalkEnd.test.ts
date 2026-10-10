// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ParentVoiceSettings, TalkRecords } from './TalkRecords';
import { TalkSession } from './TalkSession';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { startTalk, type TalkCallbacks } from '../lib/realtime';
import { toDateKey, addDays } from '../lib/date';
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

it.each(['coach', 'biz'] as const)('T22a %s는 시작 전 복습 대상을 보내고 사용자 줄만 비교해 종료 때 한 번 갱신한다', async mode => {
  const today = toDateKey(), state = defaultState(); state.ai = { endpoint: 'https://worker.example', token: 't'.repeat(32) };
  const target = { id: 'r1', text: 'I went yesterday.', mode, source: 'correction' as const, stage: 0 as const, misses: 0, createdAt: today, dueDate: today };
  state.data.parent.retrieval = [target, { ...target, id: 'r2', text: 'I enjoy tea.' }];
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  vi.mocked(generate).mockImplementation(async (_cfg, req) => req.kind === 'talk-corrections' ? { items: [], praiseKo: '뜻을 잘 전했어요.' } : req.kind === 'coach-wrapup' ? { sentences: [] } : Promise.reject(new Error('피드백 없음')));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId: 'parent', go: vi.fn() }))));
  if (mode === 'coach') await click('🌱 코치 모드한국어로 대답하고 쉬운 영어를 따라 해요.');
  await click('대화 시작'); expect(vi.mocked(startTalk).mock.lastCall![1].reviewTargets).toEqual(['I went yesterday.', 'I enjoy tea.']);
  await act(async () => { callbacks.onAssistantText('a', 'I enjoy tea.', true); callbacks.onUserText('u', 'Yes, I went yesterday!'); callbacks.onUserText('u2', 'I like the place.'); callbacks.onUserText('u3', 'Thank you.'); });
  await click('끝내기'); await act(async () => callbacks.onState('ended'));
  const data = JSON.parse(localStorage.getItem('study-kt:v1')!).data.parent;
  expect(data.retrieval[0]).toMatchObject({ stage: 1, misses: 0 }); expect(data.retrieval[1]).toMatchObject({ stage: 0, misses: 1 });
  expect(data.talks).toHaveLength(1); expect(data.talks[0].reviewResult).toEqual({ targets: ['I went yesterday.', 'I enjoy tea.'], reused: ['I went yesterday.'] });
  expect(host.textContent).toContain('지난 표현 다시 쓰기: 2개 중 1개 성공 ✅');
  expect(vi.mocked(generate).mock.calls.filter(([, req]) => req.kind === 'talk-corrections')).toHaveLength(1);
  if (mode === 'coach') expect(host.querySelector('[aria-label="오늘의 교정"]')!.compareDocumentPosition(host.querySelector('[aria-label="코치 대화 마무리"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it.each(['kid1', 'kid2'] as const)('T22a는 %s 요청·완료·기록에 교정·복습 필드를 넣지 않는다', async profileId => {
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId, go: vi.fn() })))); await click('대화 시작');
  const request = vi.mocked(startTalk).mock.lastCall![1]; expect(request.mode).toBe('kid-friend'); expect(request).not.toHaveProperty('reviewTargets');
  await act(async () => { callbacks.onUserText('u', 'I go yesterday.'); callbacks.onAssistantText('a', 'Nice!', true); }); await click('끝내기');
  expect(host.textContent).not.toContain('오늘의 교정'); expect(vi.mocked(generate).mock.calls.some(([, req]) => req.kind === 'talk-corrections')).toBe(false);
  const data = JSON.parse(localStorage.getItem('study-kt:v1')!).data[profileId]; expect(data.talks[0]).not.toHaveProperty('reviewResult'); expect(data.talks[0]).not.toHaveProperty('corrections'); expect(data).not.toHaveProperty('retrieval');
});

it.each([
  { seconds: 10, lines: ['Hello.'], miss: 0, stage: 0 },
  { seconds: 119, lines: ['Hello.', 'I like tea.'], miss: 0, stage: 0 },
  { seconds: 120, lines: [], miss: 1, stage: 0 },
  { seconds: 10, lines: ['Hi.', 'Yes.', 'I like tea.'], miss: 1, stage: 0 },
  { seconds: 10, lines: ["I've worked here since 2025."], miss: 0, stage: 1 },
])('T22a 짧은 대화의 기회·성공 반영: %j', async ({ seconds, lines, miss, stage }) => {
  let clock = 0; const timer = vi.spyOn(performance, 'now').mockImplementation(() => clock);
  try {
    const today = toDateKey(), state = defaultState(); state.ai = { endpoint: 'https://worker.example', token: 't'.repeat(32) };
    const target = { id: 'r-short', text: 'I have worked here since last year.', focus: 'have worked', mode: 'coach' as const, source: 'correction' as const, stage: 0 as const, misses: 0, createdAt: today, dueDate: today };
    state.data.parent.retrieval = [target]; localStorage.setItem('study-kt:v1', JSON.stringify(state));
    await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId: 'parent', go: vi.fn() }))));
    await click('🌱 코치 모드한국어로 대답하고 쉬운 영어를 따라 해요.'); await click('미리 보기 건너뛰고 대화 시작');
    expect(vi.mocked(startTalk).mock.lastCall![1]).not.toHaveProperty('previewChunks');
    // 실제 2분 대화도 상한에서 잘리지 않도록 충분한 서버 시간을 전달한다.
    await act(async () => { callbacks.onConnected?.(300); lines.forEach((text, i) => callbacks.onUserText(`u-${i}`, text)); }); clock = seconds * 1000;
    await click('끝내기'); await act(async () => callbacks.onState('ended'));
    const data = JSON.parse(localStorage.getItem('study-kt:v1')!).data.parent;
    expect(data.retrieval[0]).toMatchObject({ stage, misses: miss, dueDate: miss || stage ? addDays(today, 1) : today });
    if (!stage && !miss) expect(data.retrieval).toEqual([target]);
    expect(data.talks).toHaveLength(1); expect(data.talks[0].reviewResult.reused).toHaveLength(stage ? 1 : 0);
  } finally { timer.mockRestore(); }
});

it.each(['coach', 'biz'] as const)('T22b %s 미리 보기·요청·복습·성장 저장과 사용자 직후 리캐스트를 연결한다', async mode => {
  vi.mocked(generate).mockImplementation(async (_cfg, req) => req.kind === 'talk-corrections' ? { items: [], praiseKo: '좋아요.' } : req.kind === 'coach-wrapup' ? { sentences: [] } : Promise.reject(new Error('피드백 없음')));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId: 'parent', go: vi.fn() }))));
  if (mode === 'coach') await click('🌱 코치 모드한국어로 대답하고 쉬운 영어를 따라 해요.');
  const displayed = [...host.querySelectorAll('.t22b-chunk [lang=en]')].map(node => node.textContent!); expect(displayed).toHaveLength(3);
  const history = JSON.parse(localStorage.getItem('study-kt:v1')!).data.parent.previewHistory;
  expect(Object.keys(history).length).toBeGreaterThanOrEqual(3);
  await click('대화 시작'); expect(vi.mocked(startTalk).mock.lastCall![1].previewChunks).toEqual(displayed);
  await act(async () => { callbacks.onUserText('u1', displayed[0]); callbacks.onAssistantText('a0', displayed[1], true); callbacks.onUserText('u2', 'I go yesterday.'); callbacks.onAssistantText('a1', 'Oh, you went yesterday!', true); callbacks.onFriendFinished?.(); });
  expect(host.querySelector('u.t22b-recast')!.textContent).toBe('went');
  await click('끝내기'); const data = JSON.parse(localStorage.getItem('study-kt:v1')!).data.parent;
  expect(data.retrieval.find((item: { text: string }) => item.text === displayed[0]).stage).toBe(1); expect(data.retrieval.find((item: { text: string }) => item.text === displayed[1]).stage).toBe(0);
  expect(data.talks[0].previewChunks).toHaveLength(3); expect(data.talks[0].growth.reuseRate).toBeCloseTo(1 / 3);
  expect(host.querySelector('[aria-label="오늘 이야기 다시 말하기"]')).not.toBeNull();
});

it.each(['kid1', 'kid2'] as const)('T22b도 %s 미리 보기·리캐스트·다시 말하기·성장 필드를 넣지 않는다', async profileId => {
  await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkSession, { profileId, go: vi.fn() }))));
  expect(host.querySelector('.t22b-preview')).toBeNull(); await click('대화 시작'); expect(vi.mocked(startTalk).mock.lastCall![1]).not.toHaveProperty('previewChunks');
  await act(async () => { callbacks.onUserText('u', 'I go yesterday.'); callbacks.onAssistantText('a', 'Oh, you went yesterday!', true); }); expect(host.querySelector('.t22b-recast')).toBeNull(); await click('끝내기');
  const data = JSON.parse(localStorage.getItem('study-kt:v1')!).data[profileId];
  for (const key of ['growth', 'retells', 'previewChunks', 'retrievalApplied']) expect(data.talks[0]).not.toHaveProperty(key); expect(host.querySelector('.t22b-retell')).toBeNull();
});
