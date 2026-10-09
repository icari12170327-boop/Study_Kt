// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BrainPuzzles } from './BrainPuzzles';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
import { generatePuzzle, GENERATORS } from '../content/puzzles/registry';
import { describePatternTile, explainRules, patternGenerator, type PatternView } from '../content/puzzles/pattern';
import type { Difficulty, Puzzle } from '../content/puzzles/types';
import type { AppState } from '../types';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, state: AppState;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T03:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(42 / 2 ** 32);
  state = normalizeState(defaultState()); localStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); });
const saved = (): AppState => JSON.parse(localStorage.getItem('study-kt:v1')!);
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text)!;
async function click(text: string) { await act(async () => button(text).click()); }
async function key(value: string, opts: KeyboardEventInit = {}) { await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, ...opts }))); }
async function mount(level: Difficulty = 4, seed = 42) {
  vi.mocked(Math.random).mockReturnValue(seed / 2 ** 32); state.data.kid1.puzzles!.levels.pattern!.level = level;
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(BrainPuzzles, { profileId: 'kid1', go: vi.fn() }))));
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('.puzzle-choice')].find(b => b.textContent?.includes('도형 규칙'))!.click());
  return generatePuzzle('pattern', level, seed) as Puzzle<PatternView, number>;
}
const unrelated = (value: AppState) => { const copy = structuredClone(value); for (const data of Object.values(copy.data)) delete data.puzzles; return copy; };
function noDescriptions(view: PatternView) {
  const element = host.querySelector('.pattern-puzzle')!;
  expect(element.querySelector('.pattern-explanation')).toBeNull();
  expect(element.querySelector('.pattern-label')).toBeNull();
  for (const tile of [...view.cells, ...view.options]) if (tile) {
    expect(element.textContent).not.toContain(describePatternTile(tile));
    expect([...element.querySelectorAll('[role=img]')].some(n => n.getAttribute('aria-label') === describePatternTile(tile))).toBe(true);
  }
}
it.each([1, 2, 3, 4, 5] as Difficulty[])('★%s: 라벨은 aria에만 있고 정답 뒤에만 설명하며 기록·레벨·보상 분리를 유지한다', async level => {
  const puzzle = await mount(level), before = saved(); noDescriptions(puzzle.view);
  expect(host.querySelectorAll('.pattern-sequence li')).toHaveLength(puzzle.view.cells.length);
  expect(host.querySelectorAll('.pattern-options button')).toHaveLength(4);
  expect(host.querySelector('.number-answer')).toBeNull();
  if (level >= 4) expect(host.querySelector('.pattern-grid')).not.toBeNull();
  await key(String(puzzle.answer)); await key('Enter');
  expect(host.querySelector('.pattern-explanation')!.textContent).toBe(explainRules(puzzle.view));
  const after = saved(); expect(unrelated(after)).toEqual(unrelated(before));
  expect(after.data.kid1.puzzles!.recent.at(-1)).toMatchObject({ type: 'pattern', difficulty: level, correct: true, hinted: false });
  expect(after.data.kid1.puzzles!.levels.pattern!.solved).toBe(before.data.kid1.puzzles!.levels.pattern!.solved + 1);
  for (const [type, value] of Object.entries(before.data.kid1.puzzles!.levels)) if (type !== 'pattern') expect(after.data.kid1.puzzles!.levels[type as 'sudoku']).toEqual(value);
  await act(async () => vi.advanceTimersByTime(2000)); expect(host.querySelector('.pattern-explanation')!.textContent).toBe(explainRules(puzzle.view));
  await key('Enter'); expect(host.querySelector('.pattern-explanation')).toBeNull(); expect(host.querySelector('.pattern-confirm')).not.toBeNull();
});
it('활동 2분 뒤 힌트는 종류만 알려 주고 3번 오답 뒤 정답 보기에서만 설명한다', async () => {
  const puzzle = await mount(5), before = saved(); expect(button('💡 힌트')).toBeUndefined();
  for (let elapsed = 0; elapsed < 120; elapsed += 10) await act(async () => {
    vi.advanceTimersByTime(10000); host.querySelector('.brain-puzzles')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  });
  await click('💡 힌트'); expect(host.querySelector('.puzzle-hint')!.textContent).toBe(`💡 ${puzzle.hint}`);
  expect(puzzle.hint).not.toMatch(/[0-9]|동그라미|세모|네모|파랑|주황|보라|초록|시계 방향/); noDescriptions(puzzle.view);
  await key(String(puzzle.answer % 4 + 1));
  for (let wrong = 1; wrong <= 3; wrong++) { await key('Enter'); expect(host.querySelector('.pattern-explanation')).toBeNull(); expect(!!button('정답 보기')).toBe(wrong === 3); }
  await click('정답 보기'); expect(host.querySelector('.pattern-explanation')!.textContent).toBe(explainRules(puzzle.view));
  const after = saved(); expect(unrelated(after)).toEqual(unrelated(before));
  expect(after.data.kid1.puzzles!.recent.at(-1)).toMatchObject({ type: 'pattern', correct: false, hinted: true });
  await click('다음 퍼즐'); noDescriptions(puzzle.view);
});
it('네모든 화살표든 SVG로 그리고 6개도 세 칸씩 두 줄로 배치한다', async () => {
  let arrowSeed = 0;
  while (generatePuzzle('pattern', 3, arrowSeed).view && (generatePuzzle('pattern', 3, arrowSeed).view as PatternView).cells[0]?.shape !== 'arrow') arrowSeed++;
  const puzzle = await mount(3, arrowSeed);
  const arrows = [...host.querySelectorAll('.pattern-sequence .pattern-tile')];
  puzzle.view.cells.filter(Boolean).forEach((tile, i) => expect(arrows[i].querySelector('g')!.getAttribute('transform')).toBe(`rotate(${tile!.dir} 20 20)`));
  await act(async () => root.render(null)); await mount(3, 42);
  for (const shapes of host.querySelectorAll<HTMLElement>('.pattern-shapes')) {
    expect(shapes.children.length).toBeLessThanOrEqual(6); expect(shapes.style.gridTemplateColumns).toBe(`repeat(${Math.min(3, shapes.children.length)}, 24px)`);
  }
});
it('Tab으로 보기 포커스 후 Enter 제출, PIN·입력 칸 예외와 리스너 하나·정리를 유지한다', async () => {
  const handlers = new Set<EventListenerOrEventListenerObject>();
  const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, opts) => { if (type === 'keydown') handlers.add(handler); add(type, handler, opts); });
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, handler, opts) => { if (type === 'keydown') handlers.delete(handler); remove(type, handler, opts); });
  const puzzle = await mount(), before = saved(); expect(handlers.size).toBe(1);
  const modal = document.createElement('div'); modal.className = 'modal-backdrop'; document.body.append(modal);
  await key(String(puzzle.answer)); await key('Enter'); expect(saved()).toEqual(before); modal.remove();
  const input = document.createElement('input'); document.body.append(input); input.focus();
  await key(String(puzzle.answer)); await key('Enter'); expect(host.querySelector('.pattern-explanation')).toBeNull(); input.remove();
  await key('5'); expect(host.querySelector('.pattern-option.selected')).toBeNull(); await key(String(puzzle.answer), { repeat: true }); expect(host.querySelector('.pattern-option.selected')).toBeNull();
  (host.querySelector(`[data-pattern-choice="${puzzle.answer}"]`) as HTMLElement).focus(); await key('Enter'); expect(host.querySelector('.pattern-explanation')).not.toBeNull();
  expect(handlers.size).toBe(1); await click('다른 퍼즐'); expect(handlers.size).toBe(0);
  const after = saved(); await key('1'); await key('Enter'); expect(saved()).toEqual(after);
});
it('이전 sequence·period 판을 만나면 새 판으로 바꾸되 레벨·기록·백업은 그대로다', async () => {
  const old = { type: 'pattern', difficulty: 2, seed: 42, view: { sequence: [{ shape: 'circle', color: 'blue', count: 1 }], period: 2, options: [] }, answer: 1, hint: '옛 안내' };
  const generator = GENERATORS.pattern!;
  vi.spyOn(generator, 'generate').mockReturnValueOnce(old as never);
  state.data.kid1.puzzles!.levels.pattern = { level: 2, streak: 2, fails: 1, solved: 8, hinted: 3 };
  state.data.kid1.puzzles!.recent = [{ date: '2026-10-09', type: 'pattern', difficulty: 2, correct: true, hinted: false, activeSec: 12 }];
  await mount(2); expect(host.querySelectorAll('.pattern-sequence li')).toHaveLength(9);
  expect(host.textContent).not.toContain('새로운 도형 규칙을 준비'); expect(saved()).toEqual(state);
  expect(importState(exportState(state))).toEqual(state); expect(state.version).toBe(2);
  expect(patternGenerator.generate).toHaveBeenCalledTimes(3);
});
