// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BrainPuzzles } from './BrainPuzzles';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { generatePuzzle } from '../content/puzzles/registry';
import type { BlocksView } from '../content/puzzles/blocks';
import { PUZZLE_HINT_MS } from '../content/puzzles/activity';
import type { AppState } from '../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const puzzle = generatePuzzle('blocks', 2, 42);
const readState = (): AppState => JSON.parse(localStorage.getItem('study-kt:v1')!);
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-09T03:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(42 / 2 ** 32);
  localStorage.clear(); const state = defaultState(); state.data.kid1.puzzles!.levels.blocks!.level = 2;
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers();
});
const button = (text: string) => [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === text);
async function click(text: string) { await act(async () => button(text)!.click()); }
async function mount() {
  await act(async () => root.render(createElement(StoreProvider, null, createElement(BrainPuzzles, { profileId: 'kid1', go: vi.fn() }))));
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button.puzzle-choice')].find(b => b.textContent?.includes('블록 세기'))!.click());
}
function noHeightText(element: Element) {
  expect(element.textContent).not.toMatch(/[0-9①-⑨]/);
  for (const node of [element, ...element.querySelectorAll('*')]) {
    expect(node.getAttribute('aria-label') ?? '').not.toMatch(/[0-9①-⑨]|층 수|\d층/);
    expect(node.getAttribute('title') ?? '').not.toMatch(/[0-9①-⑨]|층 수|\d층/);
  }
  expect(element.querySelector('svg text, svg circle')).toBeNull();
}
async function activeSeconds(seconds: number) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 10) {
    await act(async () => {
      vi.advanceTimersByTime(10000);
      host.querySelector('.brain-puzzles')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
  }
}
function unrelatedState(state: AppState) {
  const copy = structuredClone(state);
  for (const data of Object.values(copy.data)) delete data.puzzles;
  return copy;
}
it('풀 때는 그림과 안내만 있고 정답 숫자는 텍스트·aria-label·title에 새지 않는다', async () => {
  await mount();
  expect(host.querySelector('.puzzle-instruction')!.textContent).toBe('빈 곳 없이 바닥부터 쌓았고, 숨어 있는 기둥은 없어요. 블록은 모두 몇 개일까요?');
  noHeightText(host.querySelector('.blocks-puzzle')!);
  expect(host.querySelector('.blocks-map')).toBeNull(); expect(button('정답 보기')).toBeUndefined();
});
it('활동 2분 뒤 힌트는 숫자 없는 모양만 보여 주며 기존 힌트 기록과 보상 분리를 유지한다', async () => {
  await mount(); const before = readState();
  await activeSeconds(110); expect(button('💡 힌트')).toBeUndefined();
  await activeSeconds(PUZZLE_HINT_MS / 1000 - 110); await click('💡 힌트');
  const map = host.querySelector('.blocks-map')!; noHeightText(map);
  expect(map.textContent).toContain('위에서 본 모양'); expect(map.textContent).not.toContain('층 수');
  expect(map.querySelectorAll('.occupied').length).toBe((puzzle.view as BlocksView).heights.flat().filter(Boolean).length);
  expect(readState()).toEqual(before);
  for (const digit of String(puzzle.answer)) await click(digit);
  await click('확인');
  const after = readState(); expect(after.data.kid1.puzzles!.recent.at(-1)).toMatchObject({ type: 'blocks', correct: true, hinted: true });
  expect(unrelatedState(after)).toEqual(unrelatedState(before));
  expect(host.querySelector('.blocks-map')!.textContent).not.toContain('층 수');
});
it('3번 틀린 뒤 정답 보기를 눌렀을 때만 층 수와 합계 풀이를 보여 준다', async () => {
  await mount(); const before = readState(); await click('0');
  for (let wrong = 1; wrong <= 3; wrong++) {
    await click('확인'); expect(host.querySelector('.blocks-map')).toBeNull();
    expect(!!button('정답 보기')).toBe(wrong === 3);
  }
  await click('정답 보기');
  const map = host.querySelector('.blocks-map')!;
  expect(map.textContent).toContain('위에서 본 층 수'); expect(map.textContent).toContain(`각 자리의 층 수를 더하면 ${puzzle.answer}개`);
  expect([...map.querySelectorAll('.blocks-heights span')].map(n => n.textContent)).toEqual((puzzle.view as BlocksView).heights.flat().map(n => String(n || '없음')));
  const after = readState(); expect(after.data.kid1.puzzles!.recent.at(-1)).toMatchObject({ type: 'blocks', correct: false });
  expect(unrelatedState(after)).toEqual(unrelatedState(before));
  await click('다음 퍼즐'); expect(host.querySelector('.blocks-map')).toBeNull();
  expect(button('정답 보기')).toBeUndefined(); noHeightText(host.querySelector('.blocks-puzzle')!);
});
it('입력 없이 2분 지나도 힌트는 열리지 않는다', async () => {
  await mount(); await act(async () => vi.advanceTimersByTime(PUZZLE_HINT_MS));
  expect(button('💡 힌트')).toBeUndefined(); expect(host.querySelector('.blocks-map')).toBeNull();
});
