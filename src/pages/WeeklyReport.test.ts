import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../store/defaults';
import { WeeklyReport, WeeklyReportNotice } from './WeeklyReport';
import { Parent } from './Parent';
import { Home } from './Home';

let state = defaultState();
const update = vi.fn();
vi.mock('../store/StoreContext', () => ({ useStore: () => ({ state, update }) }));
beforeEach(() => { state = defaultState(); update.mockClear(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 11, 23, 59)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const render = () => renderToStaticMarkup(createElement(WeeklyReport));
describe('보호자 주간 리포트 화면', () => {
  it('자유 놀이에 오비 판 수와 이번 주 최고 Stage를 표시한다', () => {
    state.data.kid1.obby = { best: 99, color: 'blue' };
    state.data.kid1.games = [{ date: '2026-10-04', game: 'obby', score: 100, stage: 50 }, { date: '2026-10-11', game: 'obby', score: 20, stage: 8 }];
    const html = render();
    expect(html).toMatch(/오비 달리기<\/span><strong>1판/); expect(html).toMatch(/이번 주 최고 Stage<\/span><strong>8 /);
  });
  it('AI 연결 없이 모든 숫자 항목과 아이·주 선택이 나오고 요청과 상태 변경은 없다', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); const before = structuredClone(state);
    const html = render();
    for (const text of ['아이 선택', '주 선택', '이번 주', '지난주', '그 전 주', '2026-10-05', '2026-10-11', '출석과 보상', '수학 도전', '과학 문제', '영어 대화', '자유 놀이', '기록 없음', '복사하기']) expect(html).toContain(text);
    expect(html).toContain('disabled=""'); expect(fetch).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(state).toEqual(before);
  });
  it('저장된 요약을 안전한 텍스트로 표시하고 자동 재생성하지 않는다', () => {
    state.data.kid1.weeklyAi = { '2026-10-05': { goodKo: '<script>private</script>', watchKo: '함께 보세요.', nextKo: '과학을 풀어 보세요.', createdAt: '2026-10-11T00:00:00Z' } };
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(render()).toContain('&lt;script&gt;private&lt;/script&gt;'); expect(render()).toContain('다시 만들기'); expect(fetch).not.toHaveBeenCalled();
  });
  it('0%는 기록 없음으로 바꾸지 않으며 막대는 CSS 너비를 쓴다', () => {
    state.data.kid1.days['2026-10-11'] = { date: '2026-10-11', completed: false, progress: { math: 2 }, mathAttempts: [], correct: 0, total: 2, mathBySkill: { 'g5-dec-add': { total: 2, correct: 0 } } };
    expect(render()).toContain('0%'); expect(render()).toContain('width:0%'); expect(render()).not.toContain('<canvas');
  });
  it('모두 맞힌 단원은 화면의 살펴볼 목록에서도 기록 없음으로 표시한다', () => {
    state.data.kid1.days['2026-10-11'] = { date: '2026-10-11', completed: false, progress: { math: 8 }, mathAttempts: [], correct: 8, total: 8, mathBySkill: { 'g3-add3': { total: 8, correct: 8 } } };
    const html = render(), weak = html.split('함께 살펴볼 단원</h4>')[1].split('</section>')[0];
    expect(html).toContain('100%'); expect(weak).toContain('기록 없음'); expect(weak).not.toContain('세 자리 덧셈');
  });
  it('첫 사용 주에는 개수와 레벨이 있어도 전주 대비 화살표를 표시하지 않는다', () => {
    state.data.kid1.days['2026-10-11'] = { date: '2026-10-11', completed: true, progress: { math: 2 }, mathAttempts: [], correct: 1, total: 2, mathBySkill: { 'g3-add3': { total: 2, correct: 1 } } };
    const html = render();
    expect(html).toContain('2문제'); expect(html).not.toContain('weekly-trend'); expect(html).not.toContain('▲'); expect(html).not.toContain('▼');
  });
  it('보호자 탭에만 리포트가 있고 아이 홈에는 노출하지 않는다', () => {
    expect(renderToStaticMarkup(createElement(Parent, { go: () => {} }))).toContain('📊 주간 리포트');
    const kid = renderToStaticMarkup(createElement(Home, { profileId: 'kid1', go: () => {} }));
    expect(kid).not.toContain('주간 리포트'); expect(kid).not.toContain('리포트가 준비');
    expect(renderToStaticMarkup(createElement(Parent, { go: () => {}, initialTab: 'weekly' }))).toContain('주 선택');
  });
  it.each([[11, true], [12, true], [13, false], [10, false]])('10월 %s일 보호자 안내 노출은 %s', (date, visible) => {
    vi.setSystemTime(new Date(2026, 9, date));
    const notice = (profileId: 'parent' | 'kid1') => renderToStaticMarkup(createElement(WeeklyReportNotice, { profileId, go: () => {} }));
    expect(notice('parent').includes('리포트가 준비')).toBe(visible); expect(notice('kid1')).toBe('');
  });
});
