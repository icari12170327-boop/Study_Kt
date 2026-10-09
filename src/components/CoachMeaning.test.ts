// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CoachMeaning } from './CoachMeaning';
import { CoachWrapup } from './CoachWrapup';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import type { TalkLog } from '../types';
import { AiError, generate } from '../lib/ai';
vi.mock('../lib/ai', async original => ({ ...await original<typeof import('../lib/ai')>(), generate: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cfg = { endpoint: 'https://worker.example', token: 't'.repeat(32) };
let root: Root, host: HTMLDivElement;
beforeEach(() => { localStorage.clear(); vi.mocked(generate).mockReset(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); });
async function mount(text: string, onMeaning = vi.fn()) { await act(async () => root.render(createElement(CoachMeaning, { cfg, text, onMeaning }))); return onMeaning; }
async function click() { await act(async () => host.querySelector('button')!.click()); }
it.each([240, 300])('%s자 자막의 250자 번역도 화면에 표시한다', async length => {
  vi.mocked(generate).mockResolvedValue({ ko: '가'.repeat(250) }); const onMeaning = await mount('a'.repeat(length));
  await click(); expect(host.querySelector('p[lang=ko]')?.textContent).toHaveLength(250); expect(onMeaning).toHaveBeenCalledOnce();
});
it.each([200, 201, 400])('뜻 %s자 응답을 정상 표시한다', async length => {
  vi.mocked(generate).mockResolvedValue({ ko: '가'.repeat(length) }); await mount('Hello.'); await click();
  expect(host.querySelector('p[lang=ko]')?.textContent).toHaveLength(length);
});
it.each([{ ko: '가'.repeat(401) }, { ko: '' }, { ko: '   ' }, { ko: 1 }, [], null])('잘못된 응답 %j는 화면에 표시하지 않는다', async result => {
  vi.mocked(generate).mockResolvedValue(result); const onMeaning = await mount('Hello.'); await click();
  expect(host.querySelector('p[lang=ko]')).toBeNull(); expect(onMeaning).not.toHaveBeenCalled();
  expect(host.querySelector('[role=alert]')?.textContent).toBe('뜻을 받지 못했어요. 한 번 더 눌러 주세요.');
});
it('3묶음을 순서대로 요청해 모두 검증한 뒤 합치고 중복 클릭을 막는다', async () => {
  const text = 'a'.repeat(750), onMeaning = await mount(text);
  let resolve!: (value: unknown) => void;
  vi.mocked(generate).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  vi.mocked(generate).mockResolvedValueOnce({ ko: '둘째 뜻' }).mockResolvedValueOnce({ ko: '셋째 뜻' });
  await act(async () => { host.querySelector('button')!.click(); host.querySelector('button')!.click(); });
  expect(generate).toHaveBeenCalledOnce(); expect(host.querySelector('button')!.disabled).toBe(true);
  await act(async () => resolve({ ko: '첫째 뜻' }));
  expect(generate).toHaveBeenCalledTimes(3);
  expect(vi.mocked(generate).mock.calls.map(([, request]) => (request.input as { text: string }).text.length)).toEqual([300, 300, 150]);
  expect(host.querySelector('p[lang=ko]')?.textContent).toBe('첫째 뜻\n둘째 뜻\n셋째 뜻');
  expect(onMeaning).toHaveBeenCalledExactlyOnceWith('첫째 뜻\n둘째 뜻\n셋째 뜻');
});
it('4묶음이 필요할 때만 긴 자막 안내를 표시하고 요청하지 않는다', async () => {
  await mount('a'.repeat(301)); expect(host.textContent).not.toContain('긴 자막은');
  await mount('a'.repeat(901)); expect(host.textContent).toContain('긴 자막은 뜻을 받을 수 없어요.');
  await click(); expect(generate).not.toHaveBeenCalled();
});
it.each(['server', 'network', 'unauthorized', 'limit'] as const)('%s 오류 안내를 구분하고 다시 누를 수 있다', async kind => {
  vi.mocked(generate).mockRejectedValueOnce(new AiError(kind)); await mount('Hello.'); await click();
  const message = host.querySelector('[role=alert]')!.textContent;
  expect(message?.includes('Worker')).toBe(kind === 'unauthorized');
  if (kind === 'server' || kind === 'network') expect(message).toBe('뜻을 받지 못했어요. 한 번 더 눌러 주세요.');
  expect(host.querySelector('button')!.disabled).toBe(false);
  vi.mocked(generate).mockResolvedValueOnce({ ko: '뜻' }); await click(); expect(host.querySelector('p[lang=ko]')!.textContent).toBe('뜻');
});
it('둘째 묶음이 실패하면 일부 뜻을 남기지 않고 전체 요청을 다시 시작한다', async () => {
  vi.mocked(generate).mockResolvedValueOnce({ ko: '일부 뜻' }).mockRejectedValueOnce(new AiError('server'));
  const onMeaning = await mount('a'.repeat(301)); await click();
  expect(host.querySelector('p[lang=ko]')).toBeNull(); expect(onMeaning).not.toHaveBeenCalled();
  vi.mocked(generate).mockResolvedValue({ ko: '뜻' }); await click();
  expect(onMeaning).toHaveBeenCalledExactlyOnceWith('뜻\n뜻'); expect(generate).toHaveBeenCalledTimes(4);
});
it('자막이 바뀌면 이전 요청을 취소하고 늦은 뜻을 적용하거나 다음 묶음을 보내지 않는다', async () => {
  let resolve!: (value: unknown) => void; vi.mocked(generate).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const previous = await mount('a'.repeat(301)); await click();
  const signal = vi.mocked(generate).mock.lastCall![2]!;
  const current = await mount('New line.'); expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ko: '이전 뜻' }));
  expect(generate).toHaveBeenCalledOnce(); expect(previous).not.toHaveBeenCalled(); expect(current).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('이전 뜻');
  vi.mocked(generate).mockResolvedValueOnce({ ko: '새 뜻' }); await click(); expect(current).toHaveBeenCalledExactlyOnceWith('새 뜻');
});
it.each(['server', 'network', 'unauthorized'] as const)('코치 마무리·문장 확인도 %s에서 같은 오류 기준을 쓴다', async kind => {
  const log: TalkLog = { id: 'coach-test', date: '2026-10-10', seconds: 60, mode: 'coach', coachTopic: 'daily', englishRatio: 1, lines: [{ role: 'friend', text: 'Hello.', at: 1 }] };
  const state = defaultState(); state.ai = cfg; state.data.parent.talks = [log];
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  vi.mocked(generate).mockRejectedValue(new AiError(kind));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(CoachWrapup, { log }))));
  await click(); let message = host.querySelector('[role=alert]')!.textContent!;
  expect(message.includes('Worker')).toBe(kind === 'unauthorized');
  if (kind !== 'unauthorized') expect(message).toContain('마무리를 받지 못했어요. 한 번 더 눌러 주세요.');
  expect(message).toContain('대화 기록은 저장되어 있어요.');
  await act(async () => root.render(null));
  log.coachWrapup = { sentences: [{ en: 'Hello.', ko: '안녕.' }] }; log.coachCheck = { text: 'Hello.', corrected: 'Hello.', noteKo: '설명' };
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(CoachWrapup, { log }))));
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === '문장 확인')!.click());
  message = host.querySelector('[role=alert]')!.textContent!;
  expect(message.includes('Worker')).toBe(kind === 'unauthorized');
  if (kind !== 'unauthorized') expect(message).toBe('문장을 확인하지 못했어요. 한 번 더 눌러 주세요.');
});
