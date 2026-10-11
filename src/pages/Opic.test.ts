// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Opic } from './Opic';
import { Home } from './Home';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { normalizeState } from '../store/storage';
import { emptyOpic, reserveOpicQuestion } from '../lib/opic';
import { OPIC_QUESTIONS } from '../content/opic/questions';
import { toDateKey, addDays } from '../lib/date';
import { AiError, generate } from '../lib/ai';
import { transcribe, TranscribeError } from '../lib/opicApi';
import { startRecording, type Recording } from '../lib/recorder';
import { speak } from '../lib/speech';
import type { AppState } from '../types';
vi.mock('../lib/ai', async original => ({ ...await original<typeof import('../lib/ai')>(), generate: vi.fn() }));
vi.mock('../lib/opicApi', async original => ({ ...await original<typeof import('../lib/opicApi')>(), transcribe: vi.fn() }));
vi.mock('../lib/recorder', () => ({ startRecording: vi.fn() }));
vi.mock('../lib/speech', async original => ({ ...await original<typeof import('../lib/speech')>(), speak: vi.fn(async () => {}) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const feedback = { taskDone: true, taskNoteKo: '장소를 설명했어요.', textType: 'sentences', levelBand: 'IM1-IM2', strengthsKo: ['경험을 말했어요.'], corrections: [], nextStepKo: '세부 내용을 하나 더 말해요.', modelAnswer: 'I enjoy walking in the park.', upgrades: [{ from: 'like', to: 'enjoy walking' }], keyPhrases: ['I enjoy walking', 'in the park'] };
let root: Root, container: HTMLDivElement, state: AppState;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(speak).mockResolvedValue(); vi.mocked(generate).mockResolvedValue(feedback); localStorage.clear(); state = normalizeState(defaultState()); state.ai = { endpoint: 'https://worker.example', token: 't'.repeat(32) }; state.data.parent.opic = emptyOpic(); reserveOpicQuestion(state.data.parent.opic, OPIC_QUESTIONS.find(q => q.id === 'park-describe-01')!, toDateKey()); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); localStorage.clear(); vi.useRealTimers(); });
const saved = (): AppState => JSON.parse(localStorage.getItem('study-kt:v1')!);
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(el => el.textContent?.includes(text))!;
async function click(text: string) { await act(async () => button(text).click()); }
async function mount(element: ReactElement = createElement(Opic, { go: vi.fn() })) { localStorage.setItem('study-kt:v1', JSON.stringify(state)); await act(async () => root.render(createElement(StoreProvider, null, element))); }
async function fill(text: string) { const input = container.querySelector('textarea')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done; }), resolve: (value: T) => resolve(value) }; }
describe('보호자 오픽 하루 흐름', () => {
  it('아이 홈에는 없고 처음 설정은 IM2·4·12개 체크로 시작한다', async () => { await mount(createElement(Home, { profileId: 'kid1', go: vi.fn() })); expect(container.textContent).not.toContain('오픽'); delete state.data.parent.opic; await act(async () => root.unmount()); root = createRoot(container); await mount(); expect(container.querySelectorAll('input[type=checkbox]:checked')).toHaveLength(12); expect([...container.querySelectorAll('select')].map(el => el.value)).toEqual(['IM2', '4']); await click('설정 저장'); expect(saved().data.parent.opic?.settings.survey).toHaveLength(12); });
  it('글 답변도 피드백·강조·노트 저장·수치로 이어지며 기존 기록은 그대로다', async () => {
    await mount(); const before = saved(); await click('오늘의 한 문항'); await click('글로 답하기'); await fill('I like the park. 공원이 좋아요.'); await click('답변 끝내기'); expect(generate).toHaveBeenCalledTimes(1); expect(transcribe).not.toHaveBeenCalled(); expect(container.querySelector('strong')?.textContent).toContain('enjoy walking'); expect(container.textContent).toContain('참고용'); expect(container.textContent).toContain('연습 마치기를 눌러야 저장돼요.'); expect(container.querySelector<HTMLInputElement>('.opic-check input')?.checked).toBe(true); await click('연습 마치기'); const after = saved(); expect(after.data.parent.opic?.scripts).toHaveLength(1); expect(after.data.parent.opic?.attempts[0].words).toBe(4); delete after.data.parent.opic; delete before.data.parent.opic; expect(after.data).toEqual(before.data); expect(after.settings).toEqual(before.settings);
  });
  it('질문 TTS·20초 준비·녹음·받아쓰기 후 자동 피드백과 선택 다시 말하기는 받아쓰기만 한다', async () => {
    vi.useFakeTimers(); const first = deferred<Recording>(), second = deferred<Recording>(), stop = vi.fn(), dispose = vi.fn(); vi.mocked(startRecording).mockResolvedValueOnce({ result: first.promise, stop, dispose }).mockResolvedValueOnce({ result: second.promise, stop, dispose }); vi.mocked(transcribe).mockResolvedValueOnce('I like the park.').mockResolvedValueOnce('I enjoy walking in the park.');
    await mount(); await click('오늘의 한 문항'); await click('질문 듣고 시작'); expect(speak).toHaveBeenCalledTimes(1); expect(startRecording).not.toHaveBeenCalled(); const prepareButton = button('준비 시작'); await act(async () => { prepareButton.click(); prepareButton.click(); }); expect(container.textContent).toContain('준비 시간 20초'); await act(async () => vi.advanceTimersByTimeAsync(20000)); expect(startRecording).toHaveBeenCalledOnce(); await click('녹음 끝내기'); expect(stop).toHaveBeenCalledOnce(); await act(async () => first.resolve({ audio: new Blob(['memory']), durationSec: 60 })); expect(generate).toHaveBeenCalledOnce(); await click('🎤 다시 말하기'); await act(async () => second.resolve({ audio: new Blob(['retell-memory']), durationSec: 30 })); expect(transcribe).toHaveBeenCalledTimes(2); expect(generate).toHaveBeenCalledOnce(); expect(saved().data.parent.opic?.attempts[0].retell).toMatchObject({ words: 6, wpm: 12 }); expect(JSON.stringify(saved())).not.toContain('retell-memory');
  });
  it('마이크 거부·미지원이면 글 답변으로 끝까지 간다', async () => { vi.useFakeTimers(); vi.mocked(startRecording).mockRejectedValue(new Error('unsupported')); await mount(); await click('오늘의 한 문항'); await click('질문 듣고 시작'); await click('준비 시작'); await act(async () => vi.advanceTimersByTimeAsync(20000)); expect(container.textContent).toContain('글로 답해도 돼요'); await fill('I like parks.'); await click('답변 끝내기'); expect(container.textContent).toContain('모범 답안'); expect(generate).toHaveBeenCalledOnce(); });
  it('업로드 실패는 메모리 녹음으로 재전송하고 중복 클릭은 요청을 늘리지 않는다', async () => {
    vi.useFakeTimers(); vi.mocked(startRecording).mockResolvedValue({ result: Promise.resolve({ audio: new Blob(['memory-only']), durationSec: 30 }), stop: vi.fn(), dispose: vi.fn() }); vi.mocked(transcribe).mockRejectedValueOnce(new AiError('network')); await mount(); await click('오늘의 한 문항'); await click('질문 듣고 시작'); await click('준비 시작'); await act(async () => vi.advanceTimersByTimeAsync(20000)); expect(button('다시 보내기')).toBeDefined(); expect(JSON.stringify(saved())).not.toContain('memory-only'); const wait = deferred<string>(); vi.mocked(transcribe).mockReturnValueOnce(wait.promise); const retry = button('다시 보내기'); await act(async () => { retry.click(); retry.click(); }); expect(transcribe).toHaveBeenCalledTimes(2); await act(async () => wait.resolve('I like parks.')); expect(generate).toHaveBeenCalledOnce();
  });
  it('피드백 실패·잘못된 응답은 다시 받기로 회복하고 이탈 후 늦은 결과는 저장하지 않는다', async () => {
    vi.mocked(generate).mockResolvedValueOnce({ wrong: true }); await mount(); await click('오늘의 한 문항'); await click('글로 답하기'); await fill('I like parks.'); await click('답변 끝내기'); expect(saved().data.parent.opic?.attempts[0].feedback).toBeUndefined(); const wait = deferred<unknown>(); vi.mocked(generate).mockReturnValueOnce(wait.promise); await click('피드백 다시 받기'); const signal = vi.mocked(generate).mock.calls.at(-1)![2]!; await act(async () => root.render(createElement('div', null, '다른 화면'))); expect(signal.aborted).toBe(true); await act(async () => wait.resolve(feedback)); expect(saved().data.parent.opic?.attempts[0].feedback).toBeUndefined();
  });
  it('질문 다시 듣기는 한 번만, 글로 바꾸면 준비 타이머와 늦은 TTS를 무시한다', async () => { const wait = deferred<void>(); vi.mocked(speak).mockReturnValueOnce(wait.promise); await mount(); await click('오늘의 한 문항'); expect(button('질문 다시 듣기').disabled).toBe(true); await click('질문 듣고 시작'); await click('글로 답하기'); await act(async () => wait.resolve()); expect(container.querySelector('textarea')).not.toBeNull(); expect(startRecording).not.toHaveBeenCalled(); });
  it('내 답안은 고치기·듣기·삭제와 유형·주제 필터를 제공한다', async () => { state.data.parent.opic!.scripts = [{ id: 's', questionId: 'park-describe-01', type: 'description', topic: 'park', text: 'Original answer.', createdAt: toDateKey(), updatedAt: toDateKey() }]; await mount(); await click('내 답안 노트'); await click('고치기'); await fill('Updated answer.'); await click('고친 답안 저장'); expect(saved().data.parent.opic?.scripts[0].text).toBe('Updated answer.'); await click('답안 듣기'); expect(speak).toHaveBeenCalledWith('Updated answer.'); window.confirm = vi.fn(() => true); await click('삭제'); expect(saved().data.parent.opic?.scripts).toHaveLength(0); });
});

it('첫 듣기 후 기다리며 다시 듣기 1회를 누를 수 있고 재생 중 준비·녹음은 겹치지 않는다', async () => {
  vi.useFakeTimers(); await mount(); await click('오늘의 한 문항'); await click('질문 듣고 시작');
  expect(button('질문 다시 듣기').disabled).toBe(false);
  await act(async () => vi.advanceTimersByTimeAsync(20000)); expect(startRecording).not.toHaveBeenCalled();
  const wait = deferred<void>(); vi.mocked(speak).mockReturnValueOnce(wait.promise);
  const replay = button('질문 다시 듣기'); await act(async () => { replay.click(); replay.click(); });
  expect(speak).toHaveBeenCalledTimes(2); expect(button('질문 다시 듣기').disabled).toBe(true); expect(button('준비 시작')).toBeUndefined();
  await act(async () => vi.advanceTimersByTimeAsync(20000)); expect(startRecording).not.toHaveBeenCalled();
  await act(async () => wait.resolve()); expect(button('질문 다시 듣기').disabled).toBe(true);
  await click('준비 시작'); expect(container.textContent).toContain('준비 시간 20초');
  await click('글로 답하기'); await act(async () => vi.advanceTimersByTimeAsync(20000)); expect(startRecording).not.toHaveBeenCalled();
});
it.each(['empty-recording', 'no-speech'] as const)('%s는 같은 파일 재전송 대신 글 답변·다시 녹음으로 안내한다', async kind => {
  vi.useFakeTimers(); vi.mocked(startRecording).mockResolvedValue({ result: Promise.resolve({ audio: new Blob(kind === 'empty-recording' ? [] : ['audio']), durationSec: 10 }), stop: vi.fn(), dispose: vi.fn() });
  vi.mocked(transcribe).mockRejectedValueOnce(new TranscribeError('no-speech'));
  await mount(); await click('오늘의 한 문항'); await click('질문 듣고 시작'); await click('준비 시작'); await act(async () => vi.advanceTimersByTimeAsync(20000));
  expect(container.querySelector('[role=alert]')?.textContent).toBe(new TranscribeError(kind).message);
  expect(button('다시 보내기')).toBeUndefined(); expect(button('준비 시작')).toBeDefined();
  expect(transcribe).toHaveBeenCalledTimes(kind === 'empty-recording' ? 0 : 1);
  await click('글로 답하기'); await fill('I like the park.'); await click('답변 끝내기'); expect(container.textContent).toContain('오늘의 피드백');
});
it('선택 다시 말하기 업로드 실패에도 피드백·모범 답안·저장을 유지하고 건너뛸 수 있다', async () => {
  await mount(); await click('오늘의 한 문항'); await click('글로 답하기'); await fill('I like parks.'); await click('답변 끝내기');
  vi.mocked(startRecording).mockResolvedValue({ result: Promise.resolve({ audio: new Blob(['retell']), durationSec: 20 }), stop: vi.fn(), dispose: vi.fn() });
  vi.mocked(transcribe).mockRejectedValueOnce(new AiError('network'));
  await click('🎤 다시 말하기');
  expect(container.textContent).toContain('오늘의 피드백'); expect(container.textContent).toContain('한 단계 위 모범 답안');
  expect(container.querySelector('.opic-check input')).not.toBeNull(); expect(button('연습 마치기')).toBeDefined(); expect(button('다시 보내기')).toBeDefined();
  await click('다시 말하기 건너뛰기'); expect(button('다시 보내기')).toBeUndefined(); expect(container.querySelector('[role=alert]')).toBeNull();
  await click('연습 마치기'); expect(saved().data.parent.opic?.scripts).toHaveLength(1); expect(generate).toHaveBeenCalledOnce();
});
it('선택 다시 말하기 재전송은 받아쓰기만 다시 요청하고 기존 피드백은 그대로다', async () => {
  await mount(); await click('오늘의 한 문항'); await click('글로 답하기'); await fill('I like parks.'); await click('답변 끝내기');
  vi.mocked(startRecording).mockResolvedValue({ result: Promise.resolve({ audio: new Blob(['retell']), durationSec: 30 }), stop: vi.fn(), dispose: vi.fn() });
  vi.mocked(transcribe).mockRejectedValueOnce(new AiError('network')).mockResolvedValueOnce('I enjoy walking in the park.');
  await click('🎤 다시 말하기'); await click('다시 보내기');
  expect(transcribe).toHaveBeenCalledTimes(2); expect(generate).toHaveBeenCalledOnce(); expect(saved().data.parent.opic?.attempts[0].retell?.words).toBe(6);
  expect(container.textContent).toContain('오늘의 피드백'); expect(button('다시 말하기 건너뛰기')).toBeUndefined();
});
it('날짜별 기록에서 원래 질문의 영어·한국어를 펼쳐 볼 수 있다', async () => {
  const q = OPIC_QUESTIONS.find(q => q.id === 'park-describe-01')!;
  state.data.parent.opic!.attempts[0].transcript = 'I like parks.';
  await mount(); await click('📊 기록'); const question = [...container.querySelectorAll('details')].find(el => el.querySelector('summary')?.textContent === '질문 보기')!;
  expect(question.textContent).toContain(q.en); expect(question.textContent).toContain(q.ko);
});
it('시험 날짜를 바꾸면 그날부터 짧은 계획을 시작하고 같은 날짜 저장은 시작일을 유지한다', async () => {
  state.data.parent.opic!.planStartedAt = '2026-01-01'; state.data.parent.opic!.settings.examDate = addDays(toDateKey(), 30);
  await mount(); await click('⚙️ 설정'); await click('설정 저장'); expect(saved().data.parent.opic?.planStartedAt).toBe('2026-01-01');
  await click('⚙️ 설정'); const date = container.querySelector<HTMLInputElement>('input[type=date]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(date, addDays(toDateKey(),20)); date.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('설정 저장'); expect(saved().data.parent.opic?.planStartedAt).toBe(toDateKey()); expect(container.textContent).toContain('이번 주 초점: 자기소개');
});
