// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingQuizPanel } from './ReadingQuizPanel';
import { Reading } from '../pages/Reading';
import { Parent } from '../pages/Parent';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { normalizeState } from '../store/storage';
import { applyProgress } from '../lib/progress';
import { toDateKey } from '../lib/date';
import { AiError, generate } from '../lib/ai';
import type { AppState, ProfileId, QaCard } from '../types';

vi.mock('../lib/ai', async original => ({ ...await original<typeof import('../lib/ai')>(), generate: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const generated = vi.mocked(generate), summary = '작은 섬에서 친구들이 힘을 모아 다리를 만들고 함께 건너며 기뻐한 이야기예요.'.repeat(2);
const response = { cards: [{ q: '누구와 힘을 모았나요?', a: '친구들과 힘을 모았어요.', type: 'fact' }, { q: '왜 다리를 만들었나요?', a: '섬을 건너기 위해서예요.', type: 'why' }] };
let root: Root, container: HTMLDivElement;
let state: AppState;
beforeEach(() => {
  generated.mockReset(); localStorage.clear(); state = normalizeState(defaultState());
  state.ai = { endpoint: 'https://worker.example', token: 't'.repeat(32) };
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); localStorage.clear(); });
async function mount(element: ReturnType<typeof createElement>) {
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  await act(async () => root.render(createElement(StoreProvider, null, element)));
}
const saved = (): AppState => JSON.parse(localStorage.getItem('study-kt:v1')!);
const button = (text: string): HTMLButtonElement => [...container.querySelectorAll('button')].find(row => row.textContent?.trim() === text)!;
async function click(element: HTMLElement) { await act(async () => element.click()); }
async function fill(labelText: string, value: string) {
  const label = [...container.querySelectorAll('label')].find(label => label.textContent?.trim().startsWith(labelText))!;
  const input = label.querySelector('input,textarea')! as HTMLInputElement | HTMLTextAreaElement;
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
function panel(profileId: ProfileId = 'kid2', onAdd = vi.fn(), existing: QaCard[] = []) {
  return createElement(ReadingQuizPanel, { existing, level: profileId === 'parent' ? 'adult' : profileId === 'kid1' ? 'g5' : 'g3', profileId, title: '작은 섬', author: '', summary, onAdd });
}
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise<unknown>(done => { resolve = done; }); return { promise, resolve }; }

describe('가짜 generate로 실제 후보 화면 동작', () => {
  it.each([['parent', 5], ['kid1', 4], ['kid2', 3]] as const)('%s는 요청 개수 %s를 보내고 성공 후보를 화면에만 보관한다', async (pid, count) => {
    generated.mockResolvedValue(response); await mount(panel(pid)); const before = saved();
    expect(generated).not.toHaveBeenCalled(); await click(button('🤖 질문 만들기'));
    expect(generated).toHaveBeenCalledTimes(1);
    expect(generated.mock.calls[0][1]).toMatchObject({ profileId: pid, kind: 'reading-quiz', input: { count, summary } });
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(2); expect(saved()).toEqual(before);
    expect([...container.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].every(row => row.checked)).toBe(true);
  });
  it('모든 후보가 기존 질문과 같으면 빈 후보 안내를 보이고 추가할 수 없다', async () => {
    generated.mockResolvedValue(response);
    await mount(panel('kid2', vi.fn(), response.cards.map((card, index) => ({ id: String(index), q: card.q, a: card.a }))));
    await click(button('🤖 질문 만들기'));
    expect(container.textContent).toContain('이미 있는 질문과 같아서 새 후보가 없어요.');
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(0); expect(button('고른 질문 추가').disabled).toBe(true);
  });
  it('다시 만들기는 새 응답의 후보만 표시하며 이전 후보를 저장하지 않는다', async () => {
    generated.mockResolvedValueOnce(response).mockResolvedValueOnce({ cards: [{ q: '새 후보', a: '새 답', type: 'fact' }] });
    await mount(panel()); const before = saved();
    await click(button('🤖 질문 만들기')); await click(button('다시 만들기'));
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>('.reading-quiz-candidate input:not([type=checkbox])')?.value).toBe('새 후보');
    expect(saved()).toEqual(before);
  });
  it('편집한 후보가 모두 기존 질문과 같으면 안내와 후보를 유지하고 고치면 다시 추가한다', async () => {
    const add = vi.fn(); generated.mockResolvedValue(response);
    await mount(panel('kid2', add, [{ id: 'old', q: '기존 질문?', a: '기존 답' }])); const before = saved();
    await click(button('🤖 질문 만들기'));
    await fill('후보 질문 1', ' 기존   질문？ '); await fill('후보 질문 2', '기존 질문.');
    const addButton = button('고른 질문 추가');
    expect(addButton.disabled).toBe(true);
    expect(container.querySelector('[role=status]')?.textContent).toContain('이미 있는 질문이에요.');
    expect(addButton.getAttribute('aria-describedby')).toBe('reading-quiz-duplicate');
    await click(addButton);
    expect(add).not.toHaveBeenCalled(); expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(2);
    expect(button('다시 만들기')).toBeTruthy(); expect(saved()).toEqual(before);
    await fill('후보 질문 2', '새 질문');
    expect(button('고른 질문 추가').disabled).toBe(false); expect(container.querySelector('[role=status]')).toBeNull();
    await click(button('고른 질문 추가'));
    expect(add).toHaveBeenCalledTimes(1); expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
    expect(saved()).toEqual(before);
  });
  it('후보 생성 뒤 기존 질문이 바뀌어 모두 중복되어도 추가를 막는다', async () => {
    const add = vi.fn(); generated.mockResolvedValue(response); await mount(panel('kid2', add));
    await click(button('🤖 질문 만들기'));
    await act(async () => root.render(createElement(StoreProvider, null, panel('kid2', add, response.cards.map((card, index) => ({ id: `old-${index}`, q: card.q, a: card.a }))))));
    expect(button('고른 질문 추가').disabled).toBe(true);
    expect(container.querySelector('[role=status]')?.textContent).toContain('이미 있는 질문이에요.');
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(2); expect(add).not.toHaveBeenCalled();
  });
  it('요청 중 빠른 연타는 한 번만 호출하고 완료 후 버튼을 다시 사용할 수 있다', async () => {
    const result = deferred(); generated.mockReturnValue(result.promise); await mount(panel());
    const make = button('🤖 질문 만들기');
    await act(async () => { make.click(); make.click(); });
    expect(generated).toHaveBeenCalledTimes(1); expect(button('질문을 만들고 있어요…').disabled).toBe(true);
    await act(async () => result.resolve(response)); expect(button('다시 만들기').disabled).toBe(false);
  });
  it.each(['limit', 'unsafe', 'network', 'server'] as const)('%s 오류는 기존 메시지를 표시하고 초안을 유지한 채 재시도한다', async kind => {
    generated.mockRejectedValueOnce(new AiError(kind)).mockResolvedValueOnce(response); await mount(panel()); const before = saved();
    await click(button('🤖 질문 만들기'));
    expect(container.querySelector('[role=alert]')?.textContent).toBe(new AiError(kind).message); expect(saved()).toEqual(before);
    await click(button('다시 시도')); expect(generated).toHaveBeenCalledTimes(2); expect(button('고른 질문 추가')).toBeTruthy();
  });
  it('잘못된 응답은 서버 오류이며 후보로 나타나지 않는다', async () => {
    generated.mockResolvedValue({ cards: [{ q: 3, a: '답', type: 'fact' }] }); await mount(panel());
    await click(button('🤖 질문 만들기'));
    expect(container.querySelector('[role=alert]')?.textContent).toBe(new AiError('server').message); expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
  });
  it('닫기와 화면 이동은 signal을 취소하고 늦은 응답을 저장하지 않는다', async () => {
    const result = deferred(); generated.mockReturnValue(result.promise); await mount(panel()); const before = saved();
    await click(button('🤖 질문 만들기')); const signal = generated.mock.calls[0][2]!;
    await click(button('닫기')); expect(signal.aborted).toBe(true);
    await act(async () => result.resolve(response)); expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(0); expect(saved()).toEqual(before);
    const next = deferred(); generated.mockReturnValue(next.promise); await click(button('🤖 질문 만들기')); const second = generated.mock.calls[1][2]!;
    await act(async () => root.render(createElement('div', null, '다른 화면'))); expect(second.aborted).toBe(true);
    await act(async () => next.resolve(response)); expect(container.textContent).toBe('다른 화면'); expect(saved()).toEqual(before);
  });
  it('후보 체크 해제·질문/답 수정·추가를 전달하고 닫기는 후보를 버린다', async () => {
    const add = vi.fn(); generated.mockResolvedValue(response); await mount(panel('kid2', add));
    await click(button('🤖 질문 만들기')); await fill('후보 질문 1', '고친 질문'); await fill('후보 답 1', '고친 답');
    await click(container.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1]);
    await click(button('고른 질문 추가'));
    expect(add.mock.calls[0][0]).toMatchObject([{ q: '고친 질문', a: '고친 답', checked: true }, { checked: false }]);
    expect(button('🤖 질문 만들기')).toBeTruthy(); expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
  });
});

describe('기존 저장·미션·별·SRS 흐름 회귀', () => {
  it('추가만 하고 나가면 기록이 없고, 저장한 카드만 기존 복습에서 나온다', async () => {
    generated.mockResolvedValue(response); await mount(createElement(Reading, { profileId: 'kid2', go: vi.fn() })); const before = saved();
    const writeNote = async () => { await click(button('✏️ 새 독서록 쓰기')); await fill('책 제목', '작은 섬'); await fill('줄거리와 느낀 점', summary); await click(button('🤖 질문 만들기')); await click(button('고른 질문 추가')); };
    await writeNote(); expect(saved()).toEqual(before);
    await click(container.querySelector<HTMLButtonElement>('[aria-label=뒤로]')!); expect(saved()).toEqual(before);
    await writeNote(); await click(button('저장'));
    const after = saved(); expect(after.data.kid2.notes).toHaveLength(1); expect(after.data.kid2.notes[0].cards).toHaveLength(2);
    const expected = structuredClone(before); expected.data.kid2.notes = after.data.kid2.notes;
    applyProgress(expected.data.kid2, expected.settings.kid2, toDateKey(), { type: 'reading' }, { aiReady: true, profileId: 'kid2' });
    expect(after).toEqual(expected);
    expect(after.data.kid2.srs).toEqual(before.data.kid2.srs); expect(after.data.kid2.math).toEqual(before.data.kid2.math);
    expect(JSON.stringify(after)).not.toContain('checked'); expect(JSON.stringify(after)).not.toContain('"type":"fact"');
    await click([...container.querySelectorAll('button')].find(row => row.textContent?.includes('복습하기'))!);
    expect(container.textContent).toContain(response.cards[0].q); await click(button('정답 보기')); expect(container.textContent).toContain(response.cards[0].a);
    await click(button('알고 있었어요'));
    const reviewed = saved(); expect(Object.keys(reviewed.data.kid2.srs)[0]).toMatch(/^note:/);
  });
  it('생성 오류는 편집 중인 제목·저자·요약·수동 질문을 그대로 유지한다', async () => {
    generated.mockRejectedValue(new AiError('limit'));
    await mount(createElement(Reading, { profileId: 'kid2', go: vi.fn() }));
    await click(button('✏️ 새 독서록 쓰기')); await fill('책 제목', '작은 섬'); await fill('지은이', '책 저자'); await fill('줄거리와 느낀 점', summary);
    const question = container.querySelector<HTMLInputElement>('[placeholder="질문 1"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(question, '직접 쓴 질문'); question.dispatchEvent(new Event('input', { bubbles: true })); });
    const before = [...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')].map(row => row.value), stored = saved();
    await click(button('🤖 질문 만들기'));
    expect([...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')].map(row => row.value)).toEqual(before);
    expect(saved()).toEqual(stored); expect(button('다시 시도')).toBeTruthy();
  });
  it('아이 설정을 끄면 생성 버튼이 없고 보호자는 꺼져 있어도 버튼을 본다', async () => {
    state.settings.kid2.readingQuiz = { enabled: false }; state.settings.parent.readingQuiz = { enabled: false };
    await mount(createElement(Reading, { profileId: 'kid2', go: vi.fn() })); await click(button('✏️ 새 독서록 쓰기')); expect(button('🤖 질문 만들기')).toBeUndefined();
    await act(async () => root.render(createElement(StoreProvider, null, createElement(Reading, { key: 'parent', profileId: 'parent', go: vi.fn() }))));
    await click(button('✏️ 새 노트 쓰기')); expect(button('🤖 질문 만들기')).toBeTruthy();
  });
  it('보호자 설정 토글은 해당 아이의 readingQuiz만 바꾼다', async () => {
    await mount(createElement(Parent, { go: vi.fn() })); await click(button('미션 설정')); const before = saved();
    const label = [...container.querySelectorAll('label')].find(row => row.textContent?.includes('독서록 AI 질문 켜기/끄기'))!;
    await click(label.querySelector('input')!); const after = saved(); const changed = after.settings.kid1.readingQuiz;
    after.settings.kid1.readingQuiz = before.settings.kid1.readingQuiz; expect(after).toEqual(before); expect(changed).toEqual({ enabled: false });
  });
});
