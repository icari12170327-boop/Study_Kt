// @vitest-environment happy-dom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RewardGames } from './RewardGames';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { normalizeState } from '../store/storage';
import { emptyDay } from '../lib/progress';
import { toDateKey } from '../lib/date';
import type { AppState, MathProblem } from '../types';

const { filler } = vi.hoisted(() => ({ filler: Array.from({ length: 64 }, (_, n) => ({ skill: 'g3-add3', question: `${n + 10} + 1 = ?`, answer: { kind: 'int' as const, value: n + 11 } })) }));
vi.mock('../content/math/session', () => ({ buildLevelQueue: vi.fn(() => filler.map(problem => ({ problem }))) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, container: HTMLDivElement, state: AppState, now: number, id: number;
let frames: Map<number, FrameRequestCallback>;
const problem: MathProblem = { skill: 'g3-add3', question: '2 + 3 = ?', answer: { kind: 'int', value: 5 } };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 9, 12));
  now = 0; id = 0; frames = new Map();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++id, callback); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((key: number) => frames.delete(key)));
  vi.stubGlobal('confirm', vi.fn(() => true));
  state = normalizeState(defaultState());
  const day = emptyDay(toDateKey()); day.progress.math = 20;
  day.mathAttempts = [{ skill: problem.skill, correct: false, guessed: false, activeMs: 8000, problem }];
  day.mathBySkill = { [problem.skill]: { total: 1, correct: 0 } }; state.data.kid2.days[day.date] = day;
  state.data.kid2.stars = 50; state.data.kid2.streak = 4; state.data.kid2.coupons = [{ id: 'coupon', label: '쿠폰', earnedAt: day.date }];
  state.data.kid2.wrongNotes = [{ id: 'wrong', problem, given: '0', addedAt: day.date }];
  state.data.kid2.obby = { best: 20, color: 'blue', hat: 'tophat' };
  localStorage.clear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });
const saved = (): AppState => JSON.parse(localStorage.getItem('study-kt:v1')!);
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(row => row.textContent?.trim() === text)!;
async function click(element: HTMLElement) { await act(async () => element.click()); }
async function key(key: string, options: KeyboardEventInit = {}) { await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))); }
async function frame(at: number) {
  now = at;
  await act(async () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now)); });
}
async function mount(go = vi.fn(), strict = false) {
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  const game = createElement(RewardGames, { profileId: 'kid2', initial: 'obby', go });
  await act(async () => root.render(createElement(StoreProvider, null, strict ? createElement(StrictMode, null, game) : game)));
  return go;
}
function learningOnly(value: AppState) {
  const copy = structuredClone(value); delete copy.data.kid2.games; delete copy.data.kid2.obby; return copy;
}
describe('오비 실제 DOM 입력·종료·학습 분리', () => {
  it('시작 전에는 판 수를 쓰지 않고 색·모자를 고른 뒤 연타해도 한 판만 확보한다', async () => {
    await mount(vi.fn(), true); const before = saved();
    expect(before.data.kid2.games).toEqual([]); expect(container.textContent).toContain('Stage 30에서 열려요');
    expect(button('🪖 Stage 30에서 열려요').disabled).toBe(true);
    await key('ArrowRight'); expect(container.querySelector('[data-obby-color=green]')?.getAttribute('aria-pressed')).toBe('true');
    await click(button('🧢 열렸어요')); const start = button('🏃 달리기 시작');
    await act(async () => { start.click(); start.click(); });
    expect(saved().data.kid2.games).toHaveLength(1); expect(saved().data.kid2.obby).toEqual({ best: 20, color: 'green', hat: 'cap' });
    expect(learningOnly(saved())).toEqual(learningOnly(before));
  });
  it('정답 점프·오답 3초 잠금·90초 종료에서 오답 입력만 막고 학습·보상은 유지한다', async () => {
    await mount(); const before = saved(); await click(button('🏃 달리기 시작'));
    expect(container.querySelector('.obby-bubble')?.textContent).toBe('2 + 3 = ?');
    expect(container.textContent).toContain('🔥 용암 · 30점');
    await key('5'); await key('Enter');
    expect(container.textContent).toContain('Stage 2'); expect(container.textContent).toContain('점프! +30점');
    expect(button('확인').disabled).toBe(false); await key('Enter'); expect(container.textContent).toContain('Stage 2');
    await frame(600); expect(button('확인').disabled).toBe(false);
    await click(button('0')); await click(button('확인')); expect(container.textContent).toContain('으악, 떨어졌다!');
    const question = container.querySelector('.obby-bubble')?.textContent;
    await key('9'); await key('Enter'); await click(button('9')); await click(button('확인'));
    expect(container.querySelector<HTMLInputElement>('[aria-label=답]')?.value).toBe('');
    expect(container.querySelector('.obby-bubble')?.textContent).toBe(question);
    await frame(3599); expect(button('확인').disabled).toBe(true);
    await frame(3600); expect(button('확인').disabled).toBe(false);
    expect(container.querySelectorAll('.obby-character')).toHaveLength(1); expect(container.querySelectorAll('.obby-obstacle')).toHaveLength(1);
    expect(container.querySelector('.obby-bubble')?.textContent).toBe('11 + 1 = ?');
    await key('1'); await key('2'); await key('Enter'); await frame(90000);
    expect(container.textContent).toContain('달리기 끝!'); expect(container.textContent).toContain('도달 Stage 3');
    expect(saved().data.kid2.games).toEqual([{ date: toDateKey(), game: 'obby', score: 40, stage: 3, caught: 2, golden: 1 }]);
    expect(saved().data.kid2.obby?.best).toBe(20); expect(learningOnly(saved())).toEqual(learningOnly(before));
    expect(frames.size).toBe(0);
  });
  it.each(['키보드', '키패드'])('점프 시작 150ms 뒤 %s로 두 자리 답을 입력하고 바로 제출할 수 있다', async method => {
    await mount(); const before = saved(); await click(button('🏃 달리기 시작')); await key('5'); await key('Enter');
    await frame(150); expect(container.querySelector('.obby-jump')).not.toBeNull();
    expect(button('확인').disabled).toBe(false);
    for (const digit of '11') {
      if (method === '키보드') await key(digit); else await click(button(digit));
    }
    expect(container.querySelector<HTMLInputElement>('[aria-label=답]')?.value).toBe('11');
    if (method === '키보드') await key('Enter'); else await click(button('확인'));
    expect(container.textContent).toContain('Stage 3'); expect(container.querySelector('.obby-fall')).toBeNull();
    await frame(90000);
    expect(saved().data.kid2.games![0]).toMatchObject({ stage: 3, score: 40, caught: 2 });
    expect(learningOnly(saved())).toEqual(learningOnly(before));
  });
  it('두 자리 답의 첫 글자를 점프 중에 입력해도 애니메이션 종료 뒤 이어서 제출한다', async () => {
    await mount(); await click(button('🏃 달리기 시작')); await key('5'); await key('Enter');
    await frame(150); await key('1'); await frame(650);
    expect(container.querySelector<HTMLInputElement>('[aria-label=답]')?.value).toBe('1');
    await key('1'); await key('Enter'); expect(container.textContent).toContain('Stage 3');
  });
  it('확인 연타는 이전 답으로 다음 문제까지 채점하지 않는다', async () => {
    await mount(); await click(button('🏃 달리기 시작')); await key('5');
    const submit = button('확인'); await act(async () => { submit.click(); submit.click(); });
    expect(container.textContent).toContain('Stage 2'); expect(container.querySelector('.obby-fall')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('[aria-label=답]')?.value).toBe('');
    await key('1'); await key('1'); await key('Enter'); expect(container.textContent).toContain('Stage 3');
  });
  it('오답 잠금 뒤 다른 문제 세 개를 넘으면 틀린 장애물이 다시 나온다', async () => {
    await mount(); await click(button('🏃 달리기 시작')); await key('0'); await key('Enter'); await frame(3000);
    for (let i = 0; i < 3; i++) {
      for (const digit of String(i + 11)) await key(digit);
      await key('Enter'); await frame(3600 + i * 600);
    }
    expect(container.querySelector('.obby-bubble')?.textContent).toBe('2 + 3 = ?');
    expect(container.textContent).toContain('🔥 용암 · 30점');
  });
  it('다섯 번째 장애물에서 체크포인트·보너스·코스 색을 바꾼다', async () => {
    await mount(); await click(button('🏃 달리기 시작'));
    for (const [index, answer] of [5, 11, 12, 13, 14].entries()) {
      for (const digit of String(answer)) await key(digit);
      await key('Enter'); await frame((index + 1) * 600);
      expect(container.querySelectorAll('.obby-character')).toHaveLength(1); expect(container.querySelectorAll('.obby-obstacle')).toHaveLength(1);
    }
    expect(container.textContent).toContain('🚩 체크포인트! +10점 +20점');
    expect(container.querySelector('.obby-course')?.classList.contains('obby-zone-1')).toBe(true);
    await frame(90000); expect(saved().data.kid2.games![0]).toMatchObject({ stage: 6, score: 90 });
  });
  it('늦은 프레임이나 만료 뒤 입력은 추가 장애물을 넘기지 않는다', async () => {
    await mount(); await click(button('🏃 달리기 시작')); await key('5'); now = 90001; await key('Enter');
    expect(container.textContent).toContain('달리기 끝!'); expect(saved().data.kid2.games![0]).toMatchObject({ stage: 1, score: 0 });
  });
  it('중간 이탈도 한 판과 도달 Stage를 기록하고 프레임·키 리스너를 제거한다', async () => {
    const add = vi.spyOn(window, 'addEventListener'), remove = vi.spyOn(window, 'removeEventListener');
    await mount(); await click(button('🏃 달리기 시작')); await key('5'); await key('Enter');
    await act(async () => root.render(createElement(StoreProvider, null, createElement('div', null, '다른 화면'))));
    expect(saved().data.kid2.games).toHaveLength(1); expect(saved().data.kid2.games![0]).toMatchObject({ stage: 2, score: 30 });
    expect(frames.size).toBe(0);
    const added = add.mock.calls.filter(([event]) => event === 'keydown').map(([, handler]) => handler);
    const removed = remove.mock.calls.filter(([event]) => event === 'keydown').map(([, handler]) => handler);
    expect(added.every(handler => removed.includes(handler))).toBe(true);
    const before = saved(); await key('5'); await key('Enter'); expect(saved()).toEqual(before);
  });
  it('뒤로에서 취소하면 계속 달리고 확인하면 한 번만 종료 기록을 쓴다', async () => {
    const go = await mount(); await click(button('🏃 달리기 시작'));
    vi.mocked(confirm).mockReturnValueOnce(false); await click(container.querySelector('[aria-label=뒤로]')!);
    expect(go).not.toHaveBeenCalled(); expect(container.querySelector('.obby-course')).not.toBeNull();
    await click(container.querySelector('[aria-label=뒤로]')!); expect(go).toHaveBeenCalledWith({ name: 'home', profileId: 'kid2' });
    expect(saved().data.kid2.games).toHaveLength(1); expect(saved().data.kid2.games![0].stage).toBe(1);
  });
  it('PIN 모달과 다른 입력 칸의 키를 받지 않으며 동시에 활성 키 리스너는 하나다', async () => {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const originalAdd = window.addEventListener.bind(window), originalRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, options) => { if (type === 'keydown') listeners.add(handler); originalAdd(type, handler, options); });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, handler, options) => { if (type === 'keydown') listeners.delete(handler); originalRemove(type, handler, options); });
    await mount(); expect(listeners.size).toBe(1); await key('Enter'); expect(container.querySelector('.obby-course')).not.toBeNull(); expect(listeners.size).toBe(1);
    const modal = document.createElement('div'); modal.className = 'modal-backdrop'; document.body.append(modal);
    await key('5'); await key('Enter'); expect(container.textContent).toContain('Stage 1'); modal.remove();
    const external = document.createElement('input'); document.body.append(external); external.focus();
    await key('5'); expect(container.querySelector<HTMLInputElement>('[aria-label=답]')?.value).toBe(''); external.remove();
    await key('5'); await key('Enter'); expect(listeners.size).toBe(1); await frame(90000); expect(listeners.size).toBe(0);
  });
  it('수학 미완료·판 수 소진은 직접 라우트로 들어가도 시작할 수 없다', async () => {
    state.data.kid2.days[toDateKey()].progress.math = 0; await mount();
    expect(button('🏃 달리기 시작').disabled).toBe(true); await key('Enter'); expect(saved().data.kid2.games).toEqual([]);
  });
  it('다른 게임으로 하루 세 판을 썼으면 오비도 시작하지 않는다', async () => {
    state.data.kid2.games = [{ date: toDateKey(), game: 'fishing', score: 10 }, { date: toDateKey(), game: 'duel', score: 20 }, { date: toDateKey(), game: 'obby', score: 0 }];
    await mount(); const before = saved();
    expect(button('🏃 달리기 시작').disabled).toBe(true); expect(container.textContent).toContain('오늘 판 수를 모두 썼어요.');
    await key('Enter'); expect(saved()).toEqual(before);
  });
  it('문제 본문 없는 옛 시도만 있어도 레벨 문제로 시작한다', async () => {
    delete state.data.kid2.days[toDateKey()].mathAttempts[0].problem;
    await mount(); await click(button('🏃 달리기 시작'));
    expect(container.querySelector('.obby-bubble')?.textContent).toBe('10 + 1 = ?');
    expect(container.textContent).not.toContain('🔥 용암 · 30점');
    await key('1'); await key('1'); await key('Enter'); await frame(90000);
    expect(saved().data.kid2.games![0]).toMatchObject({ stage: 2, score: 10, golden: 0 });
  });
});
