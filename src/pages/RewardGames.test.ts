import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../store/defaults';
import { emptyDay } from '../lib/progress';
import { toDateKey } from '../lib/date';
import { RewardGameCard } from '../components/RewardGameCard';
import { FishPond } from '../components/FishPond';
import { buildFishPool } from '../content/games/fishing';
import { duelQueue } from '../content/games/duel';
import { Home } from './Home';

let state = defaultState();
vi.mock('../store/StoreContext', () => ({ useStore: () => ({ state, update: vi.fn() }) }));
beforeEach(() => { state = defaultState(); });
const today = toDateKey();
const unlock = (id: 'kid1' | 'kid2') => { const day = emptyDay(today); day.progress.math = 20; state.data[id].days[today] = day; };
const card = (profileId: 'kid1' | 'parent' = 'kid1') => renderToStaticMarkup(createElement(RewardGameCard, { profileId, today, go: () => {} }));

describe('오늘의 게임 화면과 기존 홈', () => {
  it('보호자에게 게임 카드를 표시하지 않고 아이는 수학 전 세 버튼이 잠긴다', () => {
    expect(card('parent')).toBe('');
    const html = card(); expect(html).toContain('수학 미션을 끝내면 열려요'); expect(html.match(/disabled=""/g)).toHaveLength(3);
    expect(html.indexOf('🎣 낚시')).toBeLessThan(html.indexOf('🏃 오비 달리기')); expect(html.indexOf('🏃 오비 달리기')).toBeLessThan(html.indexOf('⚔️ 형제 대결'));
  });
  it('자신의 수학만 완료하면 낚시·오비가 열리고 둘 다 완료해야 대결이 열린다', () => {
    unlock('kid1'); expect(card().match(/disabled=""/g)).toHaveLength(1);
    unlock('kid2'); expect(card()).not.toContain('disabled=""');
    state.data.kid2.games = Array.from({ length: 3 }, () => ({ date: today, game: 'fishing', score: 0 }));
    expect(card().match(/disabled=""/g)).toHaveLength(1);
  });
  it('게임 상한은 세 버튼을 잠그지만 왕관 표시와 기존 미션은 보존한다', () => {
    unlock('kid1'); unlock('kid2'); state.data.kid1.crownUntil = today;
    state.data.kid1.games = Array.from({ length: 3 }, () => ({ date: today, game: 'fishing', score: 0 }));
    const html = renderToStaticMarkup(createElement(Home, { profileId: 'kid1', go: () => {} }));
    expect(html).toContain('👑 다음 게임 선택권'); expect(html).toContain('오늘 판 수를 모두 썼어요'); expect(html).toContain('수학 도전'); expect(html).toContain('수학 빙고');
  });
  it('문제 풀이 기록이 많아도 연못의 물고기 버튼은 8개뿐이다', () => {
    const pool = buildFishPool([], duelQueue('g5', 4, 3), 10);
    const html = renderToStaticMarkup(createElement(FishPond, { fish: pool, cursor: 0, onChoose: () => {} }));
    expect(html.match(/class="fish /g)).toHaveLength(8); expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
});
