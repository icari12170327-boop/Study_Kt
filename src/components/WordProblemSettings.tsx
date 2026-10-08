import { useState } from 'react';
import { normalizeWordInterests, normalizeWordProblemRatio } from '../content/math/wordProblem';
import { normalizeTalkSettings } from '../lib/talk';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';

export function WordProblemSettings({ profileId }: { profileId: ProfileId }) {
  const { state, update } = useStore();
  const profile = state.profiles.find(row => row.id === profileId)!;
  const settings = state.settings[profileId];
  const [interests, setInterests] = useState(normalizeWordInterests(settings.talk?.interests).join(', '));
  return <div className="panel">
    <h3>📖 수학 문장제</h3>
    <label>관심사 (쉼표로 구분, 최대 5개·각 20자)
      <textarea rows={2} maxLength={108} value={interests} onChange={event => setInterests(event.target.value)} onBlur={() => {
        const values = normalizeWordInterests(interests.split(',')); setInterests(values.join(', '));
        update(draft => { draft.settings[profileId].talk = { ...normalizeTalkSettings(draft.settings[profileId].talk, profile.level, profileId), interests: values }; });
      }} />
    </label>
    <p className="small muted">AI 친구와 같은 관심사를 사용해요. 입력 후 다른 곳을 누르면 저장돼요. 실명·학교·주소는 적지 마세요.</p>
    <label>문장제 비율
      <select value={normalizeWordProblemRatio(settings.wordProblemRatio)} onChange={event => update(draft => { draft.settings[profileId].wordProblemRatio = Number(event.target.value); })}>
        <option value={0}>0% · 연산만</option><option value={20}>20% · 기본</option><option value={40}>40%</option>
      </select>
    </label>
    <p className="small muted">다음 수학 도전부터 적용해요. AI 연결이 없거나 이야기가 늦으면 연산 문제로 풀어요.</p>
  </div>;
}
