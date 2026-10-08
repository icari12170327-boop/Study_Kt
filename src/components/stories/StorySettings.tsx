import { useStore } from '../../store/StoreContext';
import { normalizeStorySettings } from '../../content/stories/progress';
import type { ProfileId } from '../../types';

export function StorySettings({ profileId }: { profileId: ProfileId }) {
  const { state, update } = useStore();
  return <div className="panel">
    <label className="check"><input type="checkbox" checked={normalizeStorySettings(state.settings[profileId].stories).enabled} onChange={event => update(draft => {
      draft.settings[profileId].stories = { enabled: event.target.checked };
    })} />📖 이야기: 켜기/끄기</label>
    <p className="small muted">하루 한 화를 여는 자유 놀이예요. 별·쿠폰·미션·연속 학습일에는 영향을 주지 않아요.</p>
  </div>;
}
