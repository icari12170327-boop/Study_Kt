// @vitest-environment happy-dom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { TalkRetell } from './TalkRetell';
import { TalkPreview } from './TalkPreview';
import { RecastText } from './RecastText';
import { ParentEnglishReport } from './ParentEnglishReport';
import { TalkCorrections } from './TalkCorrections';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { buildTalkGrowth } from '../lib/talkGrowth';
import { generate } from '../lib/ai';
import { startTalk } from '../lib/realtime';
import * as speech from '../lib/speech';
import { TALK_CHUNKS } from '../content/talk/chunks';
import type { TalkLog } from '../types';
vi.mock('../lib/ai', async original => ({ ...await original<typeof import('../lib/ai')>(), generate: vi.fn() }));
vi.mock('../lib/realtime', async original => ({ ...await original<typeof import('../lib/realtime')>(), startTalk: vi.fn() }));
vi.mock('../lib/speech', async original => ({ ...await original<typeof import('../lib/speech')>(), canSpeak: vi.fn(() => false), canRecognize: vi.fn(() => false), speak: vi.fn(), listenOnce: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, log: TalkLog, clock: number;
const item = { said: 'I go yesterday.', better: 'I went yesterday.', focus: 'went', hintKo: '언제 한 일인가요?', whyKo: '지난 일이에요.', pattern: 'tense' as const };
const saved = () => JSON.parse(localStorage.getItem('study-kt:v1')!);
const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent?.trim() === text)!;
async function click(text: string) { await act(async () => button(text).click()); }
async function input(text: string) { await act(async () => { const box = host.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, text); box.dispatchEvent(new Event('input', { bubbles: true })); }); }
function store() {
  const state = defaultState(); state.ai = { endpoint: 'https://worker.example', token: 't'.repeat(32) }; state.data.parent.talks = [log];
  state.data.parent.retrieval = [{ id: 'r1', text: item.better, focus: item.focus, source: 'correction', mode: 'coach', stage: 1, dueDate: '2026-10-11', misses: 0, createdAt: log.date }, { id: 'r2', text: TALK_CHUNKS[0].en, source: 'preview', mode: 'coach', stage: 0, dueDate: '2026-10-11', misses: 0, createdAt: log.date }];
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T12:00:00Z')); clock = 0; vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.mocked(generate).mockReset(); vi.mocked(startTalk).mockReset(); vi.mocked(speech.canRecognize).mockReturnValue(false); vi.mocked(speech.canSpeak).mockReturnValue(false);
  log = { id: 'talk', date: '2026-10-10', mode: 'coach', seconds: 60, englishRatio: 1, lines: [{ role: 'kid', text: item.said, at: 1 }], corrections: { items: [item], praiseKo: '좋아요.', createdAt: '2026-10-10' }, previewChunks: [TALK_CHUNKS[0].id], retrievalApplied: [item.better] };
  log.growth = buildTalkGrowth(log); localStorage.clear(); store(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
const mountRetell = async () => { await act(async () => root.render(createElement(StoreProvider, null, createElement(TalkRetell, { log })))); };
it('음성 인식 없이 두 번 입력하고 단어·교정 사용·성장 지표를 저장하며 같은 표현은 한 번만 올린다', async () => {
  await mountRetell(); const before = saved(); await click('2분 다시 말하기 시작');
  await input(`We went to a cafe. ${TALK_CHUNKS[0].en}`); clock = 60000; await click('다시 말하기 끝내기');
  expect(host.textContent).toContain('교정 표현 1/1 사용 ✅'); expect(host.textContent).not.toContain('다시 말하기 건너뛰기'); expect(host.textContent).toContain('영어 단어 9개');
  await click('1분 30초로 한 번 더'); await input(`We went home. ${TALK_CHUNKS[0].en}`); clock = 70000; await click('다시 말하기 끝내기');
  const after = saved(); expect(after.data.parent.talks[0].retells).toHaveLength(2); expect(after.data.parent.retrieval.map((item: { stage: number }) => item.stage)).toEqual([1, 1]);
  expect(after.data.parent.talks[0].growth.reuseRate).toBe(1); expect(after.data.parent.talks[0].growth.retellWordsPerMinute).toBeCloseTo(16 * 60 / 70);
  expect(host.textContent).not.toContain('1분 30초로 한 번 더'); expect(generate).not.toHaveBeenCalled(); expect(startTalk).not.toHaveBeenCalled();
  for (const key of ['days', 'stars', 'streak', 'coupons', 'math', 'wrongNotes', 'srs']) expect(after.data.parent[key]).toEqual(before.data.parent[key]); expect(after.data.kid1).toEqual(before.data.kid1);
});
it('타이머는 콜백 수 대신 경과 시간으로 끝내고 상한 초만 저장한다', async () => {
  await mountRetell(); await click('2분 다시 말하기 시작'); await input(item.better);
  clock = 120500; await act(async () => vi.advanceTimersByTime(250));
  expect(saved().data.parent.talks[0].retells[0].seconds).toBe(120); expect(host.textContent).toContain('교정 표현 1/1'); expect(vi.getTimerCount()).toBe(0);
});
it('건너뛰기는 데이터와 요청을 바꾸지 않는다', async () => {
  await mountRetell(); const before = saved(); await click('다시 말하기 건너뛰기');
  expect(saved()).toEqual(before); expect(generate).not.toHaveBeenCalled(); expect(startTalk).not.toHaveBeenCalled();
});
it('녹음 결과는 문장별로 이어 붙이고 종료 후 늦은 응답은 무시하며 타이머와 녹음을 정리한다', async () => {
  vi.mocked(speech.canRecognize).mockReturnValue(true); let resolve!: (text: string[]) => void; const stop = vi.fn();
  vi.mocked(speech.listenOnce).mockReturnValue({ promise: new Promise(done => { resolve = done; }), stop });
  await mountRetell(); await click('2분 다시 말하기 시작'); await click('🎤 문장 말하기'); await act(async () => resolve(['We went home.']));
  expect(host.querySelector('textarea')!.value).toBe('We went home.');
  vi.mocked(speech.listenOnce).mockReturnValue({ promise: new Promise(done => { resolve = done; }), stop }); await click('🎤 문장 말하기'); clock = 10000; await click('다시 말하기 끝내기');
  await act(async () => resolve(['Late transcript.'])); expect(saved().data.parent.talks[0].retells[0].text).toBe('We went home.'); expect(stop).toHaveBeenCalled();
  await click('1분 30초로 한 번 더'); await click('🎤 문장 말하기'); await act(async () => root.render(null)); expect(vi.getTimerCount()).toBe(0);
});
it('미리 보기는 영어·뜻·듣기·건너뛰기를 제공하고 브라우저 TTS만 사용한다', async () => {
  vi.mocked(speech.canSpeak).mockReturnValue(true); vi.mocked(speech.speak).mockResolvedValue(); const skip = vi.fn();
  await act(async () => root.render(createElement(TalkPreview, { chunks: TALK_CHUNKS.slice(0, 3), speed: .85, disabled: false, onSkip: skip })));
  expect(host.querySelectorAll('.t22b-chunk')).toHaveLength(3); expect(host.textContent).toContain(TALK_CHUNKS[0].ko);
  await act(async () => host.querySelector('button')!.click()); expect(speech.speak).toHaveBeenCalledWith(TALK_CHUNKS[0].en, { lang: 'en-US', rate: .85 });
  await click('미리 보기 건너뛰고 대화 시작'); expect(skip).toHaveBeenCalledOnce(); expect(generate).not.toHaveBeenCalled();
});
it('보호자 리포트는 6개 지표·4주 CSS 막대·전주 화살표를 표시하고 데이터는 읽기만 한다', async () => {
  const previous = { ...log, id: 'old', date: '2026-10-03', growth: { ...log.growth!, averageEnglishWords: 1 } }, before = JSON.stringify([previous, log]);
  await act(async () => root.render(createElement(ParentEnglishReport, { logs: [previous, log], today: log.date, offset: 0 })));
  expect(host.textContent).toContain('보호자 영어'); expect(host.querySelectorAll('.t22b-growth-track')).toHaveLength(24); expect(host.querySelector('[aria-label="지난주 대비 증가"]')).not.toBeNull(); expect(JSON.stringify([previous, log])).toBe(before);
  await act(async () => root.render(createElement(ParentEnglishReport, { logs: [log], today: log.date, offset: 0 }))); expect(host.querySelector('[aria-label^="지난주 대비"]')).toBeNull();
});
it('리캐스트의 변경 구절만 밑줄이고 맞장구는 그대로이며 HTML은 글자로만 표시한다', async () => {
  await act(async () => root.render(createElement(RecastText, { user: item.said, text: 'Oh, you went yesterday!' }))); expect(host.querySelector('u')!.textContent).toBe('went'); expect(host.textContent).toContain('✏️ 이렇게도 말해요');
  await act(async () => root.render(createElement(RecastText, { user: item.said, text: '<img src=x>Great!' }))); expect(host.querySelector('img')).toBeNull(); expect(host.querySelector('u')).toBeNull();
});
it('교정이 0개면 다시 말하기로 넘어갈 수 있고 성장 지표 갱신은 StrictMode에서도 안전하다', async () => {
  log.corrections = undefined; log.growth = buildTalkGrowth(log); store(); vi.mocked(generate).mockResolvedValue({ items: [], praiseKo: '잘했어요.' }); const complete = vi.fn();
  await act(async () => root.render(createElement(StrictMode, null, createElement(StoreProvider, null, createElement(TalkCorrections, { log, auto: true, onComplete: complete })))));
  expect(complete).toHaveBeenCalled(); expect(generate).toHaveBeenCalledOnce(); expect(saved().data.parent.talks[0].growth.correctionRate).toBe(0);
});

it('교정이 없으면 0/0을 표시하지 않고 결과 화면에는 건너뛰기가 없다', async () => {
  log.corrections = { items: [], praiseKo: '좋아요.', createdAt: log.date }; store();
  await mountRetell(); await click('2분 다시 말하기 시작'); await input('I had a nice day.'); clock = 30000; await click('다시 말하기 끝내기');
  expect(host.textContent).not.toContain('교정 표현'); expect(host.textContent).not.toContain('0/0'); expect(host.textContent).not.toContain('다시 말하기 건너뛰기');
  expect(host.textContent).toContain('영어 단어 5개'); expect(host.textContent).toContain('1분 30초로 한 번 더');
});
it.each([
  ['I am happy.', 'You are happy!'], ['I am a manager.', 'Oh, you are a manager!'],
  ["I'm working on a project.", "Oh, you're working on a project!"], ['I was tired.', 'You were tired?'],
  ['I was born in Busan.', 'You were born in Busan!'], ['I am from Korea.', 'Oh, you are from Korea!'],
])('올바른 되받기 %s → %s 는 DOM에 밑줄·교정 안내를 만들지 않는다', async (user, text) => {
  await act(async () => root.render(createElement(RecastText, { user, text })));
  expect(host.querySelector('u')).toBeNull(); expect(host.textContent).not.toContain('✏️ 이렇게도 말해요'); expect(host.textContent).toBe(text);
});
