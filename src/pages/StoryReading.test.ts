import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../store/defaults';
import { Home } from './Home';
import { StoryReading, EpisodeReader } from './StoryReading';
import { StoryOverview } from '../components/stories/StoryOverview';
import { StorySettings } from '../components/stories/StorySettings';
import { SMALL_ISLAND as story } from '../content/stories/smallIsland';
import { initialStoryProgress, recordAnswer } from '../content/stories/progress';
import { MISSION_META } from '../route';
import { toDateKey } from '../lib/date';

let state = defaultState();
vi.mock('../store/StoreContext', () => ({ useStore: () => ({ state, update: vi.fn() }) }));
beforeEach(() => { state = defaultState(); });
const home = (profileId: 'kid1' | 'kid2' | 'parent') => renderToStaticMarkup(createElement(Home, { profileId, go: () => {} }));

describe('이야기 자유 놀이 화면', () => {
  it('두 아이 홈에 자유 놀이로 표시하고 미션 목록·보호자 홈에는 넣지 않는다', () => {
    for (const id of ['kid1', 'kid2'] as const) {
      const html = home(id);
      expect(html).toContain('story-home'); expect(html).toContain('새 화 열림!');
      const missionList = html.split('<div class="mission-list">')[1].split('</div></button></div>')[0];
      expect(missionList).not.toContain('story-home');
      expect(state.settings[id].missions.some(row => String(row.type) === 'stories')).toBe(false);
    }
    expect(home('parent')).not.toContain('story-home');
    expect(MISSION_META).not.toHaveProperty('stories');
  });
  it('설정을 끄면 홈에서 사라지고 직접 진입도 막는다', () => {
    state.settings.kid2.stories = { enabled: false };
    expect(home('kid2')).not.toContain('story-home');
    expect(renderToStaticMarkup(createElement(StoryReading, { profileId: 'kid2', go: () => {} }))).toContain('지금은 이야기가 꺼져 있어요.');
    expect(renderToStaticMarkup(createElement(StoryReading, { profileId: 'parent', go: () => {} }))).not.toContain('story-book');
    expect(renderToStaticMarkup(createElement(StorySettings, { profileId: 'kid2' }))).not.toContain('checked=');
  });
  it('이야기 목록과 완독 목록을 따로 표시하고 완독해도 다시 읽는다', () => {
    const list = renderToStaticMarkup(createElement(StoryReading, { profileId: 'kid2', go: () => {} }));
    expect(list).toContain(story.title); expect(list).toContain('이야기 목록'); expect(list).toContain('다 읽은 이야기');
    state.data.kid2.stories = { [story.id]: { unlocked: 10, finished: 10, lastUnlockDate: toDateKey(), answers: {} } };
    expect(renderToStaticMarkup(createElement(StoryReading, { profileId: 'kid2', go: () => {} }))).toContain('이야기 끝! 🎉 · 다시 읽기');
    expect(home('kid2')).toContain('다 읽은 이야기 다시 보기');
  });
  it('본문의 모든 문단과 문단별 듣기·보기 네 개를 표시하며 그림은 없다', () => {
    const episode = story.episodes[0];
    const html = renderToStaticMarkup(createElement(EpisodeReader, { story, episode, progress: initialStoryProgress(), onAnswer: () => {}, onBack: () => {} }));
    const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    for (const paragraph of episode.paragraphs) expect(html).toContain(escape(paragraph));
    expect(html.match(/class="story-paragraph /g)).toHaveLength(6);
    expect(html.match(/문단 읽어 주기"/g)).toHaveLength(6);
    expect(html.match(/data-story-choice=/g)).toHaveLength(4);
    expect(html).toContain('1~4로 고르고 Enter로 확인해요.'); expect(html).not.toContain('<img');
  });
  it('중간에 나갔다 돌아오면 아직 못 맞힌 문제부터 재개한다', () => {
    const progress = recordAnswer(initialStoryProgress(), story, 1, 0, true, toDateKey());
    const html = renderToStaticMarkup(createElement(EpisodeReader, { story, episode: story.episodes[0], progress, onAnswer: () => {}, onBack: () => {} }));
    expect(html).toContain('문제 2 / 3');
  });
  it('보호자에게 진도·문제별 재도전 정답률·미리 열기를 표시한다', () => {
    state.data.kid2.stories = { [story.id]: { unlocked: 2, finished: 1, answers: { '1:0': [false, true] } } };
    const html = renderToStaticMarkup(createElement(StoryOverview, { profileId: 'kid2' }));
    expect(html).toContain('읽기 완료 1 / 10화'); expect(html).toContain('열린 화 2화');
    expect(html).toContain('1 / 2'); expect(html).toContain('50%'); expect(html).toContain('다음 화 미리 열기');
    state.data.kid2.stories[story.id].unlocked = 10;
    expect(renderToStaticMarkup(createElement(StoryOverview, { profileId: 'kid2' }))).toContain('disabled=""');
  });
});
