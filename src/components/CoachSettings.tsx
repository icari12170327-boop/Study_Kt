import { parentPersona } from '../lib/voices';
import { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { normalizeCoachInterests, normalizeCoachSettings } from '../lib/coach';
import type { CoachSettings as Settings } from '../types';
export function CoachSettings() {
  const { state, update } = useStore();
  const settings = normalizeCoachSettings(state.settings.parent.coach);
  const [interests, setInterests] = useState(normalizeCoachInterests(state.settings.parent.talk?.interests).join(', '));
  const set = (patch: Partial<Settings>) => update(draft => { draft.settings.parent.coach = { ...normalizeCoachSettings(draft.settings.parent.coach), ...patch }; });
  return <section className="panel form" aria-label="코치 모드 설정">
    <h2>🌱 코치 모드 · 내 사용설명서</h2><p className="small muted">친구는 {parentPersona(state.settings.parent.talk).friendName}예요. 설정은 다음 대화부터 적용해요.</p>
    <div className="form-grid">
      <label><span id="coach-level">수준</span><select aria-labelledby="coach-level" value={settings.level} onChange={e => set({ level: e.target.value as Settings['level'] })}>
        <option value="zero">완전 처음</option><option value="words">단어 몇 개 앎</option><option value="short">짧은 대화 됨</option><option value="daily">일상 대화 됨</option>
      </select></label>
      <label><span id="coach-repeat">따라 말하기 양</span><select aria-labelledby="coach-repeat" value={settings.repeat} onChange={e => set({ repeat: e.target.value as Settings['repeat'] })}>
        <option value="low">적게</option><option value="mid">보통</option><option value="high">많이</option>
      </select></label>
      <label><span id="coach-speed">말 속도</span><select aria-labelledby="coach-speed" value={settings.speed} onChange={e => set({ speed: Number(e.target.value) as Settings['speed'] })}>
        <option value={0.85}>0.85 · 천천히</option><option value={0.9}>0.9</option><option value={1}>1.0</option>
      </select></label>
      <label><span id="coach-subtitle">자막 표시</span><select aria-labelledby="coach-subtitle" value={settings.subtitle} onChange={e => set({ subtitle: e.target.value as Settings['subtitle'] })}>
        <option value="now">즉시</option><option value="after">말 끝난 뒤</option><option value="hidden">숨김 · 눌러서 보기</option>
      </select></label>
    </div>
    <label><span id="coach-interests">좋아하는 것 (쉼표로 구분, 최대 5개)</span><textarea aria-labelledby="coach-interests" maxLength={408} rows={2} value={interests} onChange={e => setInterests(e.target.value)} onBlur={() => {
      const values = normalizeCoachInterests(interests.split(',')); setInterests(values.join(', '));
      update(draft => { if (draft.settings.parent.talk) draft.settings.parent.talk.interests = values; });
    }} /></label>
    <p className="small muted">한 가지당 80자까지 저장해요. 회사 이름, 실명, 연락처, 계좌 정보는 빼 주세요. 말 속도는 비즈니스 상황극에도 적용해요.</p>
  </section>;
}
