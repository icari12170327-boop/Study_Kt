import { STORIES } from '../../content/stories';
import { normalizeStorySettings, storyCardState } from '../../content/stories/progress';
import { useStore } from '../../store/StoreContext';
import type { Go } from '../../route';
import type { ProfileId } from '../../types';
import { useStoryDate } from './useStoryDate';

export function StoryHomeCard({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state } = useStore();
  const today = useStoryDate();
  if (profileId === 'parent' || state.profiles.find(p => p.id === profileId)?.level === 'adult' || !normalizeStorySettings(state.settings[profileId].stories).enabled) return null;
  const statuses = STORIES.map(story => storyCardState(state.data[profileId].stories?.[story.id], today, story.episodes.length));
  const label = statuses.includes('new') ? '새 화 열림!' : statuses.includes('reading') ? '이어서 읽기' : statuses.includes('locked-until-tomorrow') ? '다음 화는 내일 · 다시 읽기' : '다 읽은 이야기 다시 보기';
  return <button className="mission-card story-home" onClick={() => go({ name: 'stories', profileId })}>
    <span className="mission-icon">📖</span><span className="mission-body"><span className="mission-title">이야기</span><span className="small muted">하루 한 화 · 자유 놀이</span></span><span className="mission-go">{label}</span>
  </button>;
}
