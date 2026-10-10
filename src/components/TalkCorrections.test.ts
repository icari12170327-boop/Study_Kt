// @vitest-environment happy-dom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TalkCorrections } from './TalkCorrections';
import { BusinessFeedback } from './BusinessFeedback';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import type { TalkLog } from '../types';
import { AiError, generate } from '../lib/ai';
import * as speech from '../lib/speech';
vi.mock('../lib/ai', async original => ({ ...await original<typeof import('../lib/ai')>(), generate: vi.fn() }));
vi.mock('../lib/speech', async original => ({ ...await original<typeof import('../lib/speech')>(), canSpeak: vi.fn(() => false), canRecognize: vi.fn(() => false), speak: vi.fn(), listenOnce: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const item = { said: 'I go yesterday.', better: 'I went yesterday.', focus: 'went', whyKo: '지난 일이에요.', hintKo: '언제 한 일인가요?', pattern: 'tense' as const };
const result = { items: [item, { ...item, said: 'I like tea.', better: 'I enjoy tea.', focus: 'enjoy' }], praiseKo: '뜻을 잘 전했어요.' };
let host: HTMLDivElement, root: Root, log: TalkLog;
const saved = () => JSON.parse(localStorage.getItem('study-kt:v1')!);
const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent?.trim() === text)!;
async function click(text: string) { await act(async () => button(text).click()); }
async function mount(auto = true, history = false, strict = false) {
  const child = createElement(StoreProvider, null, createElement(TalkCorrections, { log, auto, history }));
  await act(async () => root.render(strict ? createElement(StrictMode, null, child) : child));
}
function store() { const state = defaultState(); state.ai = { endpoint: 'https://worker.example', token: 't'.repeat(32) }; state.data.parent.talks = [log]; localStorage.setItem('study-kt:v1', JSON.stringify(state)); }
beforeEach(() => {
  localStorage.clear(); vi.mocked(generate).mockReset(); vi.mocked(speech.canRecognize).mockReturnValue(false); vi.mocked(speech.canSpeak).mockReturnValue(false);
  log = { id: 'parent-talk', date: '2026-10-10', seconds: 60, mode: 'coach', englishRatio: 1, lines: [{ role: 'kid', text: 'I go yesterday.', at: 1 }, { role: 'friend', text: 'Oh, you went yesterday!', at: 2 }, { role: 'kid', text: 'I like tea.', at: 3 }], reviewResult: { targets: ['I like tea.', 'I enjoy work.'], reused: ['I like tea.'] } };
  store(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); });
it('StrictMode에서도 종료 후 자동 생성은 한 번이며 처음에는 답을 숨기고 한 장씩 보여 준다', async () => {
  vi.mocked(generate).mockResolvedValue(result); await mount(true, false, true);
  expect(generate).toHaveBeenCalledOnce(); const request = vi.mocked(generate).mock.calls[0][1];
  expect(request).toEqual({ profileId: 'parent', level: 'adult', kind: 'talk-corrections', input: { mode: 'coach', level: 'zero', lines: [{ role: 'user', text: item.said }, { role: 'ai', text: 'Oh, you went yesterday!' }, { role: 'user', text: 'I like tea.' }] } });
  expect(host.textContent).toContain('먼저 고쳐 보기'); expect(host.textContent).toContain(item.hintKo); expect(host.textContent).not.toContain(item.better); expect(host.textContent).not.toContain('I like tea.');
  expect(host.textContent).toContain('지난 표현 다시 쓰기: 2개 중 1개 성공 ✅'); expect(saved().data.parent.talks[0].corrections.items).toHaveLength(2);
});
it('음성 인식 없이 입력→정답→연습→저장으로 selfFixed·내 표현·다음 날 복습을 기록한다', async () => {
  vi.mocked(generate).mockResolvedValue(result); await mount();
  const before = saved();
  await click('⌨️ 입력'); expect(document.activeElement).toBe(host.querySelector('textarea'));
  await act(async () => { const input = host.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'I went yesterday!'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('고친 문장 확인'); expect(host.textContent).toContain('직접 고쳤어요! 👏'); expect(host.querySelector('.coach-sentence strong')?.textContent).toBe('went');
  expect(saved().data.parent.talks[0].corrections.items[0].selfFixed).toBe(true);
  await click('듣고 따라 말하기'); expect(button('저장으로')).toBeTruthy(); await click('저장으로'); expect(host.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);
  await click('저장하고 다음'); expect(host.textContent).toContain('2 / 2'); expect(host.textContent).not.toContain(item.better);
  const after = saved(); expect(after.data.parent.customCards[0]).toMatchObject({ en: item.better, ko: item.whyKo, source: '교정' }); expect(after.data.parent.retrieval[0]).toMatchObject({ stage: 0, misses: 0, text: item.better });
  for (const key of ['days', 'stars', 'streak', 'coupons', 'math', 'wrongNotes', 'srs']) expect(after.data.parent[key]).toEqual(before.data.parent[key]); expect(after.data.kid1).toEqual(before.data.kid1);
  await click('모르겠어요'); await click('듣고 따라 말하기'); await click('저장으로');
  await act(async () => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click()); await click('저장 없이 다음');
  expect(host.textContent).toContain('오늘의 교정을 모두 확인했어요.'); expect(saved().data.parent.customCards).toHaveLength(1); expect(saved().data.parent.retrieval).toHaveLength(1); expect(saved().data.parent.talks[0].corrections.items[1].selfFixed).toBeUndefined();
});
it('실패하면 기록을 그대로 두고 다시 받기 중 중복 클릭을 차단한다', async () => {
  vi.mocked(generate).mockRejectedValueOnce(new AiError('network')); await mount();
  expect(host.textContent).toContain('다시 받기를 눌러 주세요'); expect(saved().data.parent.talks[0].corrections).toBeUndefined(); expect(saved().data.parent.talks[0].lines).toEqual(log.lines);
  let resolve!: (value: unknown) => void; vi.mocked(generate).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await act(async () => { button('다시 받기').click(); button('다시 받기').click(); }); expect(generate).toHaveBeenCalledTimes(2);
  await act(async () => resolve({ items: [], praiseKo: '잘했어요.' })); expect(host.textContent).toContain('오늘은 고칠 곳이 거의 없었어요 👏'); expect(generate).toHaveBeenCalledTimes(2);
});
it.each([null, { items: Array(4).fill(item), praiseKo: '잘했어요.' }, { items: [item], praiseKo: 123 }])('잘못된 형태 %j는 저장하지 않는다', async raw => {
  vi.mocked(generate).mockResolvedValue(raw); await mount(); expect(saved().data.parent.talks[0].corrections).toBeUndefined(); expect(host.querySelector('[role=alert]')).not.toBeNull();
});
it('서버가 놓친 잘못된 인용·핵심 부분은 앱에서도 버리고 AI selfFixed는 믿지 않는다', async () => {
  vi.mocked(generate).mockResolvedValue({ ...result, items: [{ ...item, selfFixed: true }, { ...item, said: 'Oh, you went yesterday!' }, { ...item, focus: 'go' }] }); await mount();
  expect(saved().data.parent.talks[0].corrections.items).toEqual([item]); expect(host.textContent).not.toContain('직접 고쳤어요!');
});
it('화면을 나가면 요청을 취소하고 늦은 응답은 저장하지 않는다', async () => {
  let resolve!: (value: unknown) => void; vi.mocked(generate).mockImplementationOnce(() => new Promise(done => { resolve = done; })); await mount();
  const signal = vi.mocked(generate).mock.calls[0][2]!; await act(async () => root.render(null)); expect(signal.aborted).toBe(true);
  await act(async () => resolve(result)); expect(saved().data.parent.talks[0].corrections).toBeUndefined();
});
it('기록 화면은 저장된 카드를 모두 보여 주고 자동 요청하지 않는다', async () => {
  log.corrections = { ...result, items: result.items.map(item => ({ ...item, selfFixed: true })), createdAt: log.date }; store(); await mount(false, true);
  expect(generate).not.toHaveBeenCalled(); expect(host.querySelectorAll('article')).toHaveLength(2); expect(host.textContent).toContain('직접 고쳤어요! 👏'); expect(host.querySelector('textarea')).toBeNull();
});
it.each([false, true])('비즈니스 피드백은 새 기록=%s일 때만 기존 교정 목록을 숨긴다', async modern => {
  log.mode = undefined; log.scenarioId = 'biz-free'; if (!modern) delete log.reviewResult;
  log.feedback = { overallKo: '총평', corrections: [{ said: 'legacy said', better: 'legacy better', why: '예전 교정' }], nextExpressions: Array(3).fill({ en: 'Next phrase.', ko: '다음 표현' }) }; store();
  await act(async () => root.render(createElement(StoreProvider, null, createElement(BusinessFeedback, { log }))));
  expect(host.textContent?.includes('legacy better')).toBe(!modern); expect(host.textContent).toContain('총평'); expect(host.textContent).toContain('다음 표현');
});
it('음성 인식·듣기를 재사용하고 나갈 때 인식을 정리한다', async () => {
  vi.mocked(speech.canRecognize).mockReturnValue(true); vi.mocked(speech.canSpeak).mockReturnValue(true);
  vi.stubGlobal('speechSynthesis', { cancel: vi.fn() }); vi.mocked(speech.speak).mockResolvedValue(undefined);
  let resolve!: (value: string[]) => void; const stop = vi.fn(); vi.mocked(speech.listenOnce).mockReturnValue({ promise: new Promise(done => { resolve = done; }), stop });
  vi.mocked(generate).mockResolvedValue(result); await mount(); await click('🎤 말하기'); await act(async () => resolve([item.better])); await click('고친 문장 확인'); await click('듣고 따라 말하기'); await click('🔊 듣기');
  expect(speech.speak).toHaveBeenCalledWith(item.better, { lang: 'en-US', rate: 0.85 });
  vi.mocked(speech.listenOnce).mockReturnValue({ promise: new Promise(() => {}), stop }); await click('🎤 따라 말하기'); await act(async () => root.render(null)); expect(stop).toHaveBeenCalled();
});

it('대상이 없는 새 기록은 0개 성공 안내 없이 새 교정 흐름 표식을 유지한다', async () => {
  log.reviewResult = { targets: [], reused: [] }; store(); vi.mocked(generate).mockResolvedValue(result); await mount();
  expect(host.textContent).not.toContain('지난 표현 다시 쓰기'); expect(saved().data.parent.talks[0].reviewResult).toEqual({ targets: [], reused: [] });
  expect(saved().data.parent.retrieval).toEqual([]); expect(saved().data.parent.customCards).toEqual([]);
});
it('음성·입력 버튼은 테마 색상을 명시하며 저장 전에는 복습 대상을 만들지 않는다', async () => {
  vi.mocked(speech.canRecognize).mockReturnValue(true); vi.mocked(speech.canSpeak).mockReturnValue(true); vi.stubGlobal('speechSynthesis', { cancel: vi.fn() });
  vi.mocked(generate).mockResolvedValue(result); await mount();
  for (const label of ['🎤 말하기', '⌨️ 입력']) expect(button(label).classList.contains('btn-soft')).toBe(true);
  await click('모르겠어요'); await click('듣고 따라 말하기');
  for (const label of ['🔊 듣기', '🎤 따라 말하기']) expect(button(label).classList.contains('btn-soft')).toBe(true);
  expect(saved().data.parent.retrieval).toEqual([]); expect(saved().data.parent.customCards).toEqual([]);
});
