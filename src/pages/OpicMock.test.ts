// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { normalizeState } from '../store/storage';
import { emptyOpic, opicMetrics } from '../lib/opic';
import { buildOpicMock } from '../lib/opicMock';
import { seededRng } from '../lib/random';
import { toDateKey, addDays } from '../lib/date';
import { QUESTION_MAP } from '../content/opic/questions';
import { fetchUsage, generate, AiError } from '../lib/ai';
import { startRecording, type Recording } from '../lib/recorder';
import { transcribe } from '../lib/opicApi';
import { speak } from '../lib/speech';
import { OpicMockPractice, OpicMockHistory } from './OpicMock';
import { OpicScriptReview } from '../components/OpicScriptReview';
import type { AppState } from '../types';
vi.mock('../lib/ai', async original => ({ ...await original<typeof import('../lib/ai')>(), generate: vi.fn(), fetchUsage: vi.fn() }));
vi.mock('../lib/recorder', () => ({ startRecording: vi.fn() }));
vi.mock('../lib/opicApi', async original => ({ ...await original<typeof import('../lib/opicApi')>(), transcribe: vi.fn() }));
vi.mock('../lib/speech', async original => ({ ...await original<typeof import('../lib/speech')>(), speak: vi.fn(async () => {}) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const fb = { taskDone: true, taskNoteKo: '경험을 말했어요.', textType: 'sentences', levelBand: 'IM1-IM2', strengthsKo: ['내 경험을 말했어요.'], corrections: [], nextStepKo: '세부 내용을 더 말해요.', modelAnswer: 'I enjoy walking in the park.', upgrades: [], keyPhrases: ['I enjoy walking', 'in the park'] };
let root: Root, host: HTMLDivElement, state: AppState;
const done = vi.fn();
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); state = normalizeState(defaultState()); state.ai = { endpoint: 'https://fixture.invalid', token: 't'.repeat(32) }; state.data.parent.opic = emptyOpic();
  vi.mocked(fetchUsage).mockResolvedValue({ opicRemaining: { transcribes: 60, transcribeSeconds: 3600, generates: 200 } } as Awaited<ReturnType<typeof fetchUsage>>);
  vi.mocked(generate).mockResolvedValue(fb); vi.mocked(speak).mockResolvedValue();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.useRealTimers(); });
const saved = (): AppState => JSON.parse(localStorage.getItem('study-kt:v1')!);
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes(text))!;
const click = async (text: string) => { await act(async () => button(text).click()); };
async function mount(element: ReactElement = createElement(OpicMockPractice, { onDone: done })) { localStorage.setItem('study-kt:v1', JSON.stringify(state)); await act(async () => root.render(createElement(StoreProvider, null, element))); }
async function fill(text: string) { const input = host.querySelector('textarea')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
function defer<T>() { let resolve!: (v: T) => void; return { promise: new Promise<T>(r => { resolve = r; }), resolve: (v: T) => resolve(v) }; }
function mockWithAnswers(n: number) {
  const mock = buildOpicMock(state.data.parent.opic!.settings, toDateKey(), seededRng(1), 'mock');
  mock.answers = mock.questionIds.slice(0, n).map((id, i) => { const q = QUESTION_MAP.get(id)!; return { id: `a${i}`, date: mock.date, questionId: id, type: q.type, topic: q.topic, transcript: 'I enjoy walking in the park.', durationSec: 30, ...opicMetrics('I enjoy walking in the park.', 30) }; });
  return mock;
}
it('남은 실제 한도를 먼저 표시하고, 부족하거나 누락되면 시작하지 않는다', async () => {
  vi.mocked(fetchUsage).mockResolvedValueOnce({ opicRemaining: { transcribes: 14, transcribeSeconds: 3600, generates: 200 } } as Awaited<ReturnType<typeof fetchUsage>>);
  await mount(); await click('남은 한도 확인'); expect(host.textContent).toContain('오늘은 14회'); expect(host.textContent).toContain('남은 한도: 받아쓰기 14회'); expect(host.textContent).toContain('아이들 사용량까지 합친 가족 전체'); expect(saved().data.parent.opic?.currentMock).toBeUndefined();
  await click('남은 한도 확인'); expect(saved().data.parent.opic?.currentMock).toBeUndefined(); await click('모의고사 시작'); expect(saved().data.parent.opic?.currentMock).toBeDefined();
});
it('한도 확인·시작 중 중복 클릭과 이탈 뒤 늦은 한도 응답을 막는다', async () => {
  const wait = defer<Awaited<ReturnType<typeof fetchUsage>>>(); vi.mocked(fetchUsage).mockReturnValue(wait.promise); await mount();
  const check = button('남은 한도 확인'); await act(async () => { check.click(); check.click(); }); expect(fetchUsage).toHaveBeenCalledOnce();
  const signal = vi.mocked(fetchUsage).mock.calls[0][1]!; await act(async () => root.render(createElement('div'))); expect(signal.aborted).toBe(true);
  await act(async () => wait.resolve({ opicRemaining: { transcribes: 60, transcribeSeconds: 3600, generates: 200 } } as Awaited<ReturnType<typeof fetchUsage>>)); expect(saved().data.parent.opic?.currentMock).toBeUndefined();
});
it('15문항 글 답변·7번 뒤 조정·자동 피드백·실패만 재시도·기록을 끝까지 진행한다', async () => {
  vi.mocked(generate).mockRejectedValueOnce(new AiError('network')); await mount(); await click('남은 한도 확인'); expect(saved().data.parent.opic?.currentMock).toBeUndefined(); await click('모의고사 시작');
  for (let i = 0; i < 15; i++) { if (i === 7) { expect(host.textContent).toContain('난이도 변형이 없는 유형은 같은 수준'); await click('그대로'); } await click('글로 답하기'); await fill('I enjoy walking in the park.'); await click('답변 끝내기'); }
  expect(saved().data.parent.opic?.mocks).toHaveLength(1); expect(saved().data.parent.opic?.mocks?.[0].answers).toHaveLength(15); expect(generate).toHaveBeenCalledTimes(15); expect(host.textContent).toContain('1문항의 피드백'); expect(saved().data.parent.opic?.currentMock?.answers.filter(a => a.feedback)).toHaveLength(14);
  await click('실패한 문항만 다시 받기'); expect(generate).toHaveBeenCalledTimes(16); expect(saved().data.parent.opic?.mocks?.[0].answers.every(a=>a.feedback)).toBe(true); expect(normalizeState(saved(), addDays(toDateKey(),1)).data.parent.opic?.mocks).toHaveLength(1); expect(host.textContent).toContain('피드백 15/15문항');
  await click('모의고사 마치기'); expect(done).toHaveBeenCalledOnce(); expect(saved().data.parent.opic?.mocks).toHaveLength(1); expect(saved().data.parent.opic?.currentMock).toBeUndefined(); expect(transcribe).not.toHaveBeenCalled();
});
it('오늘만 이어 보고 40분을 넘어도 끊지 않으며 타이머와 늦은 피드백은 이탈 때 정리한다', async () => {
  vi.useFakeTimers(); state.data.parent.opic!.currentMock = { ...mockWithAnswers(15), adjustment: 'same', elapsedSec: 2400 };
  const wait = defer<unknown>(); vi.mocked(generate).mockReturnValue(wait.promise); await mount(); await click('이어 보기');
  expect(host.textContent).toContain('40분 초과'); expect(generate).toHaveBeenCalledTimes(3); const signal = vi.mocked(generate).mock.calls[0][2]!;
  await act(async () => vi.advanceTimersByTimeAsync(10000)); expect(saved().data.parent.opic?.currentMock?.elapsedSec).toBeGreaterThanOrEqual(2410);
  await act(async () => root.render(createElement('div'))); expect(signal.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  await act(async () => wait.resolve(fb)); expect(saved().data.parent.opic?.currentMock?.answers.some(a => a.feedback)).toBe(false); expect(generate).toHaveBeenCalledTimes(3);
});
it('첫 질문 듣기 뒤 5초 안에 한 번 다시 듣고 150초 녹음을 시작하며 이탈하면 취소한다', async () => {
  vi.useFakeTimers(); state.data.parent.opic!.currentMock = mockWithAnswers(0); const wait = defer<Recording>(), dispose = vi.fn(); vi.mocked(startRecording).mockResolvedValue({ result: wait.promise, stop: vi.fn(), dispose });
  await mount(); await click('이어 보기'); await click('질문 듣기'); expect(startRecording).not.toHaveBeenCalled(); await click('다시 듣기');
  expect(speak).toHaveBeenCalledTimes(2); expect(vi.mocked(startRecording).mock.calls[0][0]).toMatchObject({ maxSeconds: 150 }); const signal = vi.mocked(startRecording).mock.calls[0][0]!.signal!;
  await act(async () => root.render(createElement('div'))); expect(signal.aborted).toBe(true); expect(dispose).toHaveBeenCalledOnce(); await act(async () => wait.resolve({ audio: new Blob(['private']), durationSec: 100 })); expect(transcribe).not.toHaveBeenCalled();
});
it('다시 듣지 않으면 5초 뒤 자동 녹음, 지원하지 않으면 글로 끝까지 간다', async () => {
  vi.useFakeTimers(); state.data.parent.opic!.currentMock = mockWithAnswers(0); vi.mocked(startRecording).mockRejectedValue(new Error('unsupported')); await mount(); await click('이어 보기'); await click('질문 듣기'); await act(async () => vi.advanceTimersByTimeAsync(5000)); expect(host.textContent).toContain('마이크를 사용할 수 없어요'); await fill('I like parks.'); await click('답변 끝내기'); expect(saved().data.parent.opic?.currentMock?.answers).toHaveLength(1); expect(generate).not.toHaveBeenCalled();
});
it('답안은 숨기고 키워드 3개만 보여 주며 건너뛰기는 단계를 바꾸지 않는다', async () => {
  const script = { id: 's', questionId: 'park-describe-01', type: 'description' as const, topic: 'park', text: 'I enjoy walking in the park with my family. The full answer is private.', createdAt: addDays(toDateKey(), -1), updatedAt: toDateKey(), keyPhrases: ['I enjoy walking', 'in the park', 'with my family'] };
  state.data.parent.opic!.scripts = [script]; await mount(createElement(OpicScriptReview, { id: 's', onDone: done })); expect(host.textContent).not.toContain('The full answer'); expect(host.querySelectorAll('li')).toHaveLength(3); await click('건너뛰고'); expect(saved().data.parent.opic?.scripts[0]).toEqual(script); expect(done).toHaveBeenCalledOnce();
  await click('글로 답하기'); await fill('I enjoy walking in the park.'); await click('답변 끝내기'); expect(saved().data.parent.opic?.scripts[0]).toMatchObject({ stage: 1, dueDate: addDays(toDateKey(), 1) }); expect(generate).not.toHaveBeenCalled(); expect(transcribe).not.toHaveBeenCalled();
});
it('답안 90초 녹음은 받아쓰기만 사용하고 결과 파일은 저장하지 않는다', async () => {
  state.data.parent.opic!.scripts = [{ id: 's', questionId: 'park-describe-01', type: 'description', topic: 'park', text: 'I enjoy walking in the park with my family.', createdAt: toDateKey(), updatedAt: toDateKey(), keyPhrases: ['I enjoy walking', 'in the park', 'with my family'] }];
  vi.mocked(startRecording).mockResolvedValue({ result: Promise.resolve({ audio: new Blob(['private-recording']), durationSec: 90 }), stop: vi.fn(), dispose: vi.fn() }); vi.mocked(transcribe).mockResolvedValue('I enjoy walking in the park.');
  await mount(createElement(OpicScriptReview, { id: 's', onDone: done })); await click('다시 말하기 시작'); expect(vi.mocked(startRecording).mock.calls[0][0]).toMatchObject({ maxSeconds: 90 }); expect(transcribe).toHaveBeenCalledOnce(); expect(generate).not.toHaveBeenCalled(); expect(JSON.stringify(saved())).not.toContain('private-recording');
});
it('완료 기록에서도 피드백이 없는 문항만 다시 받고 기존 성공은 유지한다', async () => {
  const mock = mockWithAnswers(15); mock.adjustment = 'same'; mock.answers.forEach((a, i) => { if (i !== 2) a.feedback = fb as typeof a.feedback; }); state.data.parent.opic!.mocks = [mock];
  await mount(createElement(OpicMockHistory)); await click('실패한 문항만'); expect(generate).toHaveBeenCalledOnce(); expect(saved().data.parent.opic?.mocks?.[0].answers.every(a => a.feedback)).toBe(true);
});
