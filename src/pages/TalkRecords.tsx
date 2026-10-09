import { BusinessFeedback } from '../components/BusinessFeedback';
import { CoachWrapup } from '../components/CoachWrapup';
import { coachTitle } from '../lib/coach';
import { scenarioTitle } from '../lib/business';
import { useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId, TalkSettings } from '../types';
import { defaultTalkSettings } from '../lib/talk';
import { CHILD_VOICES, PARENT_VOICES, TALK_VOICES } from '../lib/voices';

function FriendSettings({ profileId }: { profileId: ProfileId }) {
  const { state, update } = useStore();
  const profile = state.profiles.find((p) => p.id === profileId)!;
  const settings = state.settings[profileId].talk ?? defaultTalkSettings(profile.level, profileId);
  const set = (patch: Partial<TalkSettings>) => update((draft) => {
    draft.settings[profileId].talk = { ...(draft.settings[profileId].talk ?? settings), ...patch };
    const mission = draft.settings[profileId].missions.find((m) => m.type === 'talk');
    if (mission && patch.dailyMinutes !== undefined) mission.target = patch.dailyMinutes;
  });
  return <div className="panel form">
    <h2>친구 설정</h2>
    <h3>친구 목소리</h3><div className="business-scenarios" role="group" aria-label="친구 목소리">{CHILD_VOICES.map(choice => <button key={choice.voiceStyle} className={`business-scenario ${settings.voice === choice.voice && settings.voiceStyle === choice.voiceStyle ? 'on' : ''}`} aria-pressed={settings.voice === choice.voice && settings.voiceStyle === choice.voiceStyle} onClick={() => set({ voice: choice.voice, voiceStyle: choice.voiceStyle })}>{choice.label}</button>)}</div>
    <p className="small muted">다음 대화부터 바뀌어요</p>
    <details><summary>고급 목소리 설정</summary><label><span id={`friend-voice-${profileId}`}>목소리 이름</span><select aria-labelledby={`friend-voice-${profileId}`} value={settings.voice} onChange={e => set({ voice: e.target.value, voiceStyle: settings.voiceStyle ?? (profileId === 'kid1' ? 'kid-boy' : 'kid-girl') })}>{TALK_VOICES.map(voice => <option key={voice}>{voice}</option>)}</select></label></details>
    <div className="form-grid">
      <label><span id={`friend-name-${profileId}`}>친구 이름</span><select aria-labelledby={`friend-name-${profileId}`} value={settings.friendName} onChange={(e) => set({ friendName: e.target.value })}>{['Max', 'Lily', 'Alex'].map((name) => <option key={name}>{name}</option>)}</select></label>
      <label><span id={`friend-persona-${profileId}`}>친구 성격</span><select aria-labelledby={`friend-persona-${profileId}`} value={settings.personaId} onChange={(e) => set({ personaId: e.target.value as TalkSettings['personaId'] })}><option value="cheerful">다정하고 밝은</option><option value="calm">차분하고 편안한</option><option value="funny">장난스럽고 신나는</option></select></label>

      <label>하루 대화 목표 (분)<input type="number" min={1} max={100} value={settings.dailyMinutes} onChange={(e) => set({ dailyMinutes: Math.max(1, Math.min(100, Math.round(Number(e.target.value)) || 1)) })} /></label>
      <label>자막 가림 비율 (%)<input type="number" min={0} max={100} value={settings.subtitleHidePercent} onChange={(e) => set({ subtitleHidePercent: Math.max(0, Math.min(100, Math.round(Number(e.target.value)) || 0)) })} /></label>
    </div>
    <p className="small muted">하루 목표는 미션과 별 지급 기준이에요. 실제 시간 상한은 Worker 설정이 정해요. 친구 이름은 허용된 이름 중에서 골라 주세요.</p>
    <label><span id={`friend-interests-${profileId}`}>아이 관심사 (쉼표로 구분, 최대 8개)</span><textarea aria-labelledby={`friend-interests-${profileId}`} defaultValue={settings.interests.join(', ')} maxLength={648} onBlur={(e) => set({ interests: e.target.value.split(',').map((value) => value.trim().slice(0, 80)).filter(Boolean).slice(0, 8) })} /></label>
    <label><span id={`friend-hobbies-${profileId}`}>친구 자신의 취미 (영어 한 줄)</span><textarea aria-labelledby={`friend-hobbies-${profileId}`} value={settings.friendHobbies} maxLength={400} onChange={(e) => set({ friendHobbies: e.target.value })} /></label>
    <label className="check"><input type="checkbox" checked={settings.pushToTalk} onChange={(e) => set({ pushToTalk: e.target.checked })} />누르는 동안만 말하기</label>
    <p className="small muted">관심사는 입력 후 다른 곳을 누르면 저장돼요. 설정은 다음 대화부터 반영돼요. 실명·학교·주소·연락처는 적지 마세요.</p>
  </div>;
}
export function ParentVoiceSettings() {
  const { state, update } = useStore();
  const settings = state.settings.parent.talk ?? defaultTalkSettings('adult', 'parent');
  return <div className="panel form"><h2>대화 상대 목소리</h2><div className="business-scenarios" role="group" aria-label="대화 상대 목소리">{PARENT_VOICES.map(choice => <button key={choice.voiceStyle} className={`business-scenario ${settings.voiceStyle === choice.voiceStyle ? 'on' : ''}`} aria-pressed={settings.voiceStyle === choice.voiceStyle} onClick={() => update(draft => { draft.settings.parent.talk = { ...settings, voice: choice.voice, voiceStyle: choice.voiceStyle, friendName: choice.friendName }; })}>{choice.label} · {choice.friendName}</button>)}</div><p className="small muted">비즈니스·코치 모드에 함께 적용돼요. 다음 대화부터 바뀌어요</p></div>;
}
function ProfileRecords({ profileId }: { profileId: ProfileId }) {
  const { state, update } = useStore();
  const data = state.data[profileId];
  const business = profileId === 'parent' && state.profiles.find(p => p.id === profileId)?.level === 'adult';
  const [selected, setSelected] = useState<string>();
  const [memory, setMemory] = useState(data.friendMemory);
  const [message, setMessage] = useState('');
  const log = data.talks.find((talk) => talk.id === selected);
  return <div className="form">
    {business ? <ParentVoiceSettings /> : <FriendSettings profileId={profileId} />}
    <div className="panel form">
      <h2>{business ? '대화 기억' : '친구 기억'}</h2>
      <label><span id={`friend-memory-${profileId}`}>기억 내용</span><textarea aria-labelledby={`friend-memory-${profileId}`} rows={5} maxLength={1500} value={memory} onChange={(e) => setMemory(e.target.value)} /></label>
      <p className="small muted">{memory.length} / 1500자 · 실명·학교·주소·연락처는 남기지 마세요.</p>
      <div className="row-center"><button className="btn btn-primary" onClick={() => { update((draft) => { draft.data[profileId].friendMemory = memory; }); setMessage(business ? '대화 기억을 저장했어요.' : '친구 기억을 저장했어요.'); }}>기억 저장</button><button className="btn" onClick={() => {
        if (!confirm(business ? '대화 기억을 지울까요? 대화 기록은 유지돼요.' : '친구 기억을 지울까요? 대화 기록은 유지돼요.')) return;
        update((draft) => { draft.data[profileId].friendMemory = ''; }); setMemory(''); setMessage(business ? '대화 기억을 지웠어요.' : '친구 기억을 지웠어요.');
      }}>{business ? '대화 기억 지우기' : '기억 지우기'}</button></div>
      {message && <p role="status">{message}</p>}
    </div>
    <div className="panel form">
      <h2>대화 기록</h2><p className="small muted">{business ? '상황과 길이, 피드백을 최근 60개까지 기기에 저장해요.' : '최근 60개를 기기에 저장해요. 영어 비율은 아이가 말한 라틴 단어와 한글 어절로 계산해요.'}</p>
      {data.talks.length === 0 && <p>아직 대화 기록이 없어요.</p>}
      {[...data.talks].reverse().map((talk) => <button key={talk.id} className="talk-record" aria-expanded={selected === talk.id} onClick={() => setSelected(selected === talk.id ? undefined : talk.id)}>
        <strong>{business && `${talk.mode === 'coach' ? coachTitle(talk.coachTopic) : scenarioTitle(talk.scenarioId)} · `}{talk.date} · {Math.floor(talk.seconds / 60)}분 {talk.seconds % 60}초 · 영어 {Math.round(talk.englishRatio * 100)}% {talk.flagged && <span aria-label="보호자 확인 필요">⚠️</span>}</strong>
        <span>{business ? talk.mode === 'coach' ? talk.coachWrapup?.sentences.map(row => row.en).join(' / ') || '마무리 문장을 다시 받을 수 있어요.' : talk.feedback?.overallKo ?? '피드백을 다시 받을 수 있어요.' : talk.summary?.highlightKo ?? '요약이 없는 대화예요.'}</span>
      </button>)}
    </div>
    {log && <div className="panel form">
      <h2>{business && `${log.mode === 'coach' ? coachTitle(log.coachTopic) : scenarioTitle(log.scenarioId)} · `}{log.date} 대화 상세</h2>
      {business && log.situation && <p className="pre">{log.situation}</p>}
      {log.flagged && <p className="bad-text">⚠️ 보호자 확인이 필요한 대화예요.</p>}
      <h3>전체 자막</h3>{log.lines.map((line, index) => <p className="talk-record-line" key={index}><strong>{business ? line.role === 'kid' ? '나' : '상대' : line.role === 'kid' ? '아이' : '친구'}:</strong> {line.text}{line.peeked && <span className="small muted"> (자막을 봤어요)</span>}</p>)}
      {!log.lines.length && <p>저장된 자막이 없어요.</p>}
      {business && (log.mode === 'coach' ? <CoachWrapup key={log.id} log={log} /> : <BusinessFeedback key={log.id} log={log} />)}
      {!business && log.summary && <><h3>요약</h3><p>{log.summary.highlightKo}</p><div className="chip-wrap">{log.summary.topicsKo.map((topic) => <span className="chip" key={topic}>{topic}</span>)}</div><h3>새 표현</h3>{log.summary.newExpressions.map((expression, index) => <p key={index}><span lang="en">{expression.en}</span> · {expression.ko}</p>)}<h3>다음 주제</h3><div className="chip-wrap">{log.summary.nextTopics.map((topic) => <span className="chip" key={topic}>{topic}</span>)}</div></>}
    </div>}
  </div>;
}
export function TalkRecords() {
  const { state } = useStore();
  const profiles = state.profiles;
  const [profileId, setProfileId] = useState<ProfileId>(profiles[0]?.id ?? 'kid1');
  return <div className="form"><div className="tabs">{profiles.map((profile) => <button className={`tab ${profileId === profile.id ? 'active' : ''}`} key={profile.id} onClick={() => setProfileId(profile.id)}>{profile.avatar} {profile.name}</button>)}</div>{profiles.some((p) => p.id === profileId) ? <ProfileRecords key={profileId} profileId={profileId} /> : <p>프로필을 설정해 주세요.</p>}</div>;
}
