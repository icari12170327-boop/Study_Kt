import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultState } from '../store/defaults';
import { TalkSession } from './TalkSession';
import { Home } from './Home';
import { BUSINESS_SCENARIOS } from '../lib/business';
let state = defaultState();
vi.mock('../store/StoreContext', () => ({ useStore: () => ({ state, update: vi.fn() }) }));
beforeEach(() => { state = defaultState(); });
describe('보호자와 아이 대화 준비 화면 회귀', () => {
  it('보호자는 고정된 8개 상황을 고르고 친구 설정·아이 관심사는 보이지 않는다', () => {
    const html = renderToStaticMarkup(createElement(TalkSession, { profileId: 'parent', go: () => {} }));
    for (const row of BUSINESS_SCENARIOS) expect(html).toContain(row.title);
    expect(html).toContain('💼 비즈니스 프리토킹'); expect(html).not.toContain('보호자 대화는 다음에');
    expect(html).toContain('🌱 코치 모드');
    expect(html).not.toContain('Roblox'); expect(html).not.toContain('Animal Crossing'); expect(html).not.toContain('친구 성격');
  });
  it.each(['kid1', 'kid2'] as const)('%s는 기존 친구·관심사·주제 선택을 유지하고 비즈니스 상황을 숨긴다', profileId => {
    const html = renderToStaticMarkup(createElement(TalkSession, { profileId, go: () => {} }));
    expect(html).toContain(profileId === 'kid1' ? 'Max' : 'Lily');
    expect(html).toContain(profileId === 'kid1' ? 'Roblox' : 'Animal Crossing'); expect(html).toContain('아무 얘기나');
    expect(html).not.toContain('비즈니스 프리토킹'); expect(html).not.toContain('내 상황 직접 입력');
    expect(html).not.toContain('코치 모드'); expect(html).not.toContain('투자 이야기');
  });
  it('보호자 홈은 15분 비즈니스 미션을, 아이 홈은 AI 친구 미션을 표시한다', () => {
    const parent = renderToStaticMarkup(createElement(Home, { profileId: 'parent', go: () => {} }));
    expect(parent).toContain('비즈니스 프리토킹'); expect(parent).not.toContain('AI 친구와 대화');
    expect(state.settings.parent.missions.find(row => row.type === 'talk')).toEqual({ type: 'talk', enabled: true, target: 15 });
    const kid = renderToStaticMarkup(createElement(Home, { profileId: 'kid1', go: () => {} }));
    expect(kid).toContain('AI 친구와 대화'); expect(kid).not.toContain('비즈니스 프리토킹');
  });
});
