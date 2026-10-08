import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { patternGenerator } from '../../content/puzzles/pattern';
import { seededRng } from '../../lib/random';
import { PatternPuzzle } from './PatternPuzzle';

// DOM 의존성 없이 실제 컴포넌트가 등록한 window 리스너를 실행한다.
// React 상태 반영과 실제 Tab 탐색은 별도 Chromium 통합 검증으로 확인한다.
class FocusTarget {
  dataset: { patternChoice?: string };
  constructor(readonly kind: 'option' | 'confirm' | 'outside' | 'input', choice?: number) {
    this.dataset = choice === undefined ? {} : { patternChoice: String(choice) };
  }
  closest(selector: string) {
    if (selector === '[data-pattern-choice]') return this.kind === 'option' ? this : null;
    if (selector.startsWith('input')) return this.kind === 'input' ? this : null;
    return this.kind === 'input' ? null : this;
  }
}
let effect: () => void | (() => void);
const root = { contains: (element: FocusTarget) => element.kind === 'option' || element.kind === 'confirm' };
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(),
  useRef: () => ({ current: root }), useEffect: (callback: typeof effect) => { effect = callback; },
}));
let listener: (event: KeyboardEvent) => void;
let activeElement: FocusTarget | null, modal: boolean;
const remove = vi.fn();
beforeEach(() => {
  activeElement = null; modal = false; remove.mockClear();
  vi.stubGlobal('Element', FocusTarget);
  vi.stubGlobal('window', { addEventListener: (_name: string, callback: typeof listener) => { listener = callback; }, removeEventListener: remove });
  vi.stubGlobal('document', { get activeElement() { return activeElement; }, querySelector: () => modal ? {} : null });
});
afterEach(() => vi.unstubAllGlobals());
function mount(disabled = false) {
  const change = vi.fn(), submit = vi.fn(), next = vi.fn();
  renderToStaticMarkup(createElement(PatternPuzzle, { puzzle: patternGenerator.generate(1, seededRng(19)), input: 1,
    selected: { r: 0, c: 0 }, select: () => {}, change, disabled, onSubmit: submit, onNext: next }));
  const cleanup = effect();
  return { change, submit, next, cleanup };
}
function press(key: string, repeat = false) {
  const preventDefault = vi.fn();
  listener({ key, repeat, target: activeElement, preventDefault } as unknown as KeyboardEvent);
  return preventDefault;
}
describe('도형 보기 키보드 회귀', () => {
  it('다른 답이 선택돼 있어도 포커스된 보기로 Enter 선택·확인을 한 번씩 한다', () => {
    const { change, submit } = mount();
    activeElement = new FocusTarget('option', 3);
    expect(press('Enter')).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledExactlyOnceWith(3); expect(submit).toHaveBeenCalledExactlyOnceWith(3);
  });
  it('1~4는 선택만 하고 보기 밖 Enter는 현재 답을 확인한다', () => {
    const { change, submit } = mount();
    for (const key of ['1', '2', '3', '4']) press(key);
    expect(change.mock.calls.map(call => call[0])).toEqual([1, 2, 3, 4]); expect(submit).not.toHaveBeenCalled();
    expect(press('5')).not.toHaveBeenCalled();
    activeElement = new FocusTarget('confirm'); press('Enter');
    expect(submit).toHaveBeenCalledExactlyOnceWith(undefined);
  });
  it('다른 버튼 Enter·입력 칸·모달·키 반복을 가로채지 않거나 제출하지 않는다', () => {
    const { change, submit } = mount();
    activeElement = new FocusTarget('outside'); expect(press('Enter')).not.toHaveBeenCalled();
    activeElement = new FocusTarget('input'); expect(press('3')).not.toHaveBeenCalled();
    activeElement = new FocusTarget('option', 3); modal = true; expect(press('Enter')).not.toHaveBeenCalled();
    modal = false; press('Enter', true);
    expect(change).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled();
  });
  it('풀이 종료 뒤 Enter는 다음 판으로만 가고 언마운트 시 리스너를 제거한다', () => {
    const { change, submit, next, cleanup } = mount(true);
    activeElement = new FocusTarget('option', 3); press('Enter'); press('3');
    expect(change).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledOnce();
    expect(cleanup).toBeTypeOf('function'); if (cleanup) cleanup();
    expect(remove).toHaveBeenCalledExactlyOnceWith('keydown', listener);
  });
});
