// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MathBingo } from './MathBingo';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { findLines, type BingoBoard, type BingoMode } from '../content/math/bingo';
import { seededRng } from '../lib/random';
import type { ProfileId } from '../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement, monotonic: number;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 11, 12));
  monotonic = 0; vi.spyOn(performance, 'now').mockImplementation(() => monotonic);
  vi.spyOn(Math, 'random').mockImplementation(seededRng(1));
  localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); });
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(el => el.textContent?.trim() === text)!;
const click = async (el: HTMLElement) => { await act(async () => el.click()); };
async function advance(ms: number) { monotonic += ms; await act(async () => vi.advanceTimersByTime(ms)); }
async function mount(profileId: ProfileId, mode: BingoMode) {
  const state = defaultState();
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(MathBingo, {profileId, go: vi.fn()}))));
  if (mode === 'practice') await click(button('🐢 연습'));
  await click(button('시작하기'));
  return state.settings[profileId].bingo!.limitSec;
}
async function solveCurrent() {
  const values = [...host.querySelectorAll('.bingo-cell')].map(el => Number(el.textContent));
  const board: BingoBoard = {size: 5, grid: Array.from({length: 5}, (_, r) => values.slice(r * 5, r * 5 + 5)), goals: []};
  const target = Number(host.querySelector('.bingo-goal h2 strong')!.textContent);
  const op = host.querySelector('.bingo-goal h2')!.textContent!.startsWith('곱') ? 'product' : 'sum';
  for (const {r, c} of findLines(board, {op, target})[0]) await click(host.querySelector(`[data-r="${r}"][data-c="${c}"]`)!);
}

for (const profileId of ['kid1', 'kid2'] as const) for (const mode of ['time', 'practice'] as const) for (const action of ['한 판 더', '모드 고르기']) {
  it(`${profileId} ${mode}: 결과의 ${action}은 종료 500ms 뒤부터 동작하고 새 판에서도 다시 보호한다`, async () => {
    const limit = await mount(profileId, mode);
    const finish = async () => {
      if (mode === 'time') await advance((limit + 3) * 1000);
      else for (let i = 0; i < 5; i++) await solveCurrent();
      expect(host.querySelector('.bingo-results')).not.toBeNull();
    };
    await finish();
    const result = host.querySelector('.bingo-results');
    await advance(100);
    for (const name of ['한 판 더', '모드 고르기']) await click(button(name));
    expect(host.querySelector('.bingo-results')).toBe(result);
    // 종료 뒤 추가 입력이 들어와도 보호 시작 시각을 다시 밀지 않는다.
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    hidden.mockRestore();
    await advance(399); await click(button(action));
    expect(host.querySelector('.bingo-results')).toBe(result);
    await advance(1); await click(button(action));
    if (action === '모드 고르기') {
      expect(host.querySelector('.bingo-intro')).not.toBeNull();
      await click(button('시작하기'));
    }
    expect(host.querySelector('.bingo-board')).not.toBeNull();
    await finish();
    await advance(100); await click(button(action));
    expect(host.querySelector('.bingo-results')).not.toBeNull();
  });
}

it('둘째의 숫자 키 최고를 시작 화면에서 이어 보이고 낮은 새 기록을 축하하지 않는다', async () => {
  const state = defaultState();
  const rec = {date: '2026-10-10', level: 'g3' as const, limitSec: 180, found: 99, bingos: 19, hints: 0};
  state.data.kid2.bingo = {recent: [rec], best: {'180': rec}};
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  await act(async () => root.render(createElement(StoreProvider, null, createElement(MathBingo, {profileId: 'kid2', go: vi.fn()}))));
  expect(host.textContent).toContain('180초 최고 기록: 99개 · 힌트 0번');
  await click(button('시작하기')); await advance(3000); await solveCurrent(); await advance(200000);
  expect(host.querySelector('.bingo-results')).not.toBeNull();
  expect(host.querySelector('.bingo-new')).toBeNull();
  expect(host.querySelector('.bingo-results')!.textContent).toContain('99개');
  expect(JSON.parse(localStorage.getItem('study-kt:v1')!).data.kid2.bingo.best).toEqual({'5x5-180': rec});
});
