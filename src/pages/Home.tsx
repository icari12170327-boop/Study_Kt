import { WeeklyReportNotice } from './WeeklyReport';
import { normalizePuzzleSettings } from '../content/puzzles/state';
import { RewardGameCard } from '../components/RewardGameCard';
import { StoryHomeCard } from '../components/stories/StoryHomeCard';
import { normalizeBingoSettings } from '../content/math/bingo';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import { MISSION_META, type Go } from '../route';
import { formatKoreanDate, lastNDays, parseDateKey, toDateKey } from '../lib/date';
import { currentStreak, enabledMissions, isDayComplete } from '../lib/progress';
import { ProgressBar, TopBar } from '../components/common';
import { outfitFor } from '../lib/outfit';
import { aiReady } from '../lib/talk';

export function Home({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state } = useStore();
  const today = toDateKey();
  const profile = state.profiles.find((p) => p.id === profileId)!;
  const data = state.data[profileId];
  const settings = state.settings[profileId];
  const day = data.days[today];
  // 홈에는 연결 전 안내를 위한 대화 카드도 표시한다. 시작 가능 여부는 아래에서 확인한다.
  const missions = enabledMissions(settings, { aiReady: true });
  const completeNow = isDayComplete(day, settings, { aiReady: aiReady(state.ai) });
  const unusedCoupons = data.coupons.filter((c) => !c.usedAt).length;

  return (
    <div className="page">
      <TopBar
        title={
          <>
            {profile.avatar}<span aria-label="오늘의 소품">{outfitFor(today, profileId)}</span> {profile.name}
          </>
        }
        onBack={() => go({ name: 'profiles' })}
      />

      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">🔥 {currentStreak(data, today)}</div>
          <div className="stat-label">연속 학습일</div>
        </div>
        <div className="stat">
          <div className="stat-value">⭐ {data.stars}</div>
          <div className="stat-label">모은 별</div>
        </div>
        <button className="stat stat-btn" onClick={() => go({ name: 'rewards', profileId })}>
          <div className="stat-value">🎁 {unusedCoupons}</div>
          <div className="stat-label">내 쿠폰</div>
        </button>
      </div>

      <h2 className="section-title">오늘의 미션 · {formatKoreanDate(today)}</h2>

      {day?.completed && (
        <div className="celebrate">
          <div className="celebrate-emoji">🎉</div>
          <div>
            <strong>{completeNow ? '오늘 미션을 모두 끝냈어요!' : '오늘 받은 쿠폰이 있어요. 새 목표도 도전해 볼까요?'}</strong>
            <div>쿠폰을 받았어요: {settings.rewardLabel}</div>
          </div>
        </div>
      )}

      {missions.length === 0 && <p className="muted">보호자 모드에서 미션을 켜 주세요.</p>}

      <div className="mission-list">
        {missions.map((m) => {
          const meta = profileId === 'parent' && profile.level === 'adult' && m.type === 'talk' ? { ...MISSION_META.talk, icon: '💼', title: '비즈니스 프리토킹' } : MISSION_META[m.type];
          const done = day?.progress[m.type] ?? 0;
          const finished = done >= m.target;
          return (
            <button
              key={m.type}
              className={`mission-card ${finished ? 'finished' : ''}`}
              disabled={m.type === 'talk' && !aiReady(state.ai)}
              onClick={() => go({ name: m.type, profileId })}
            >
              <div className="mission-icon" style={{ background: meta.color }}>
                {finished ? '✔' : meta.icon}
              </div>
              <div className="mission-body">
                <div className="mission-title">
                  {meta.title}
                  <span className="mission-count">
                    {Math.min(done, m.target)} / {m.target} {meta.unit}
                  </span>
                </div>
                <ProgressBar value={done} max={m.target} color={meta.color} />
              </div>
              <div className="mission-go">{finished ? '더 하기' : '시작'}</div>
            </button>
          );
        })}
      </div>
      {profileId !== 'parent' && profile.level !== 'adult' && normalizeBingoSettings(settings.bingo, profile.level).enabled && <button className="mission-card bingo-home" onClick={() => go({ name: 'bingo', profileId })}>
        <span className="mission-icon">🎯</span><span className="mission-body"><span className="mission-title">수학 빙고</span><span className="small muted">숫자 3칸을 찾는 자유 놀이</span></span><span className="mission-go">놀기</span>
      </button>}
      {profileId !== 'parent' && profile.level !== 'adult' && normalizePuzzleSettings(settings.puzzles).enabled && <button className="mission-card puzzle-home" onClick={() => go({ name: 'puzzles', profileId })}>
        <span className="mission-icon">🧩</span><span className="mission-body"><span className="mission-title">두뇌 퍼즐</span><span className="small muted">스도쿠·숫자 기차·수 피라미드 · 자유 놀이</span></span><span className="mission-go">놀기</span>
      </button>}
      <RewardGameCard profileId={profileId} today={today} go={go} />
      <StoryHomeCard profileId={profileId} go={go} />
      {missions.some((m) => m.type === 'talk') && !aiReady(state.ai) && <p className="panel">{profileId === 'parent' ? '보호자 모드에서 AI 연결을 설정해 주세요. 지금은 다른 미션만 끝내도 쿠폰을 받을 수 있어요.' : '보호자에게 AI 연결을 부탁하세요. 지금은 다른 미션만 끝내도 쿠폰을 받을 수 있어요.'}</p>}

      {missions.every((m) => m.type !== 'reading') && (
        <button className="btn btn-ghost" onClick={() => go({ name: 'reading', profileId })}>
          📚 {profile.level === 'adult' ? '독서노트' : '독서록'} 열기
        </button>
      )}

      {profile.level !== 'adult' && <button className="btn btn-soft" onClick={() => go({ name: 'science-collection', profileId })}>🔬 {profile.level === 'g5' ? '실험실 빌드' : '나의 과학 박물관'} 열기 · {Object.keys(data.science.collected).length}장 · 🏅 {data.science.badges.length}</button>}

      {profileId === 'parent' && <WeeklyReportNotice profileId={profileId} go={go} />}
      {profileId === 'parent' && <button className="btn btn-soft" onClick={() => go({ name: 'parent' })}>🔒 보호자 모드 · 대화 기록과 내 표현 관리</button>}

      <h2 className="section-title">최근 2주 도장</h2>
      <div className="stamp-grid">
        {lastNDays(14, today).map((d) => {
          const log = data.days[d];
          const date = parseDateKey(d);
          return (
            <div key={d} className={`stamp ${log?.completed ? 'on' : log ? 'partial' : ''} ${d === today ? 'today' : ''}`}>
              <div className="stamp-day">{date.getDate()}</div>
              <div className="stamp-mark">{log?.completed ? '💮' : log ? '·' : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
