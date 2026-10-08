import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../store/defaults';
import { Home } from './Home';
import { BrainPuzzles } from './BrainPuzzles';
import { PuzzleOverview } from '../components/PuzzleOverview';
import { PUZZLE_RENDERERS } from '../components/puzzles/renderers';
import { GENERATORS, generatePuzzle, registeredPuzzleTypes } from '../content/puzzles/registry';
import { toDateKey } from '../lib/date';

let state = defaultState();
vi.mock('../store/StoreContext', () => ({ useStore: () => ({ state, update: vi.fn() }) }));
beforeEach(() => { state = defaultState(); });
const home = (profileId: 'kid1' | 'kid2' | 'parent') => renderToStaticMarkup(createElement(Home, { profileId, go: () => {} }));

describe('두뇌 퍼즐 입구와 공통 틀', () => {
  it('아이 홈에만 있고 꺼 두면 사라진다', () => {
    expect(home('kid1')).toContain('두뇌 퍼즐'); expect(home('kid2')).toContain('두뇌 퍼즐');
    expect(home('parent')).not.toContain('두뇌 퍼즐');
    state.settings.kid1.puzzles = { enabled: false };
    expect(home('kid1')).not.toContain('두뇌 퍼즐');
    expect(home('kid1')).toContain('수학 도전');
  });
  it('등록된 세 종류와 아무거나만 표시하고 직접 진입도 설정으로 막는다', () => {
    const html = renderToStaticMarkup(createElement(BrainPuzzles, { profileId: 'kid2', go: () => {} }));
    for (const name of ['스도쿠', '숫자 기차', '수 피라미드', '아무거나', '난이도 1']) expect(html).toContain(name);
    for (const name of ['저울', '도형 규칙', '블록 세기']) expect(html).not.toContain(name);
    state.settings.kid2.puzzles = { enabled: false };
    expect(renderToStaticMarkup(createElement(BrainPuzzles, { profileId: 'kid2', go: () => {} }))).not.toContain('아무거나');
    expect(renderToStaticMarkup(createElement(BrainPuzzles, { profileId: 'parent', go: () => {} }))).not.toContain('아무거나');
  });
  it('후속 종류는 생성기와 렌더러 등록만으로 고르기 화면에 붙는다', () => {
    try {
      GENERATORS.balance = { type: 'balance', generate: () => ({ type: 'balance', difficulty: 1, seed: 1, view: {}, answer: 1, hint: '시험용' }), check: (_puzzle, input) => input === 1 };
      PUZZLE_RENDERERS.balance = { ...PUZZLE_RENDERERS.train!, icon: '⚖️', example: '시험용' };
      const html = renderToStaticMarkup(createElement(BrainPuzzles, { profileId: 'kid2', go: () => {} }));
      expect(html).toContain('저울');
    } finally { delete GENERATORS.balance; delete PUZZLE_RENDERERS.balance; }
  });
  it('보호자 현황은 종류별 기본 난이도와 최근 기록을 표시한다', () => {
    state.data.kid1.puzzles!.recent = [{ date: toDateKey(), type: 'sudoku', difficulty: 2, correct: true, hinted: true, activeSec: 12 }];
    delete state.data.kid1.puzzles!.daily;
    const html = renderToStaticMarkup(createElement(PuzzleOverview, { data: state.data.kid1, grade: 'g5' }));
    expect(html).toContain('스도쿠 ★2'); expect(html).toContain('최근 7일 1개'); expect(html).toContain('정답률 100%'); expect(html).toContain('힌트 1회');
  });
  for (const type of registeredPuzzleTypes()) it(`${type} 그리기 어댑터가 빈 답과 정답을 처리한다`, () => {
    const puzzle = generatePuzzle(type, 4, 3), renderer = PUZZLE_RENDERERS[type]!;
    const input = renderer.initialInput(puzzle), selected = renderer.firstCell?.(puzzle) ?? { r: 0, c: 0 };
    expect(renderer.complete(input)).toBe(false);
    const answerInput = renderer.answerInput(puzzle);
    expect(renderer.complete(answerInput)).toBe(true); expect(renderer.toAnswer(answerInput)).toEqual(puzzle.answer);
    const edited = renderer.setPad!(input, selected, '12'); expect(renderer.padValue!(edited, selected)).toBe('12');
    expect(renderer.padValue!(input, selected)).toBe('');
    const html = renderToStaticMarkup(createElement(renderer.Component, { puzzle, input: answerInput, selected,
      select: () => {}, change: () => {}, disabled: true }));
    expect(html).toContain(type === 'train' ? '숫자 기차' : type === 'sudoku' ? '6 곱하기 6 스도쿠' : '수 피라미드');
  });
});
