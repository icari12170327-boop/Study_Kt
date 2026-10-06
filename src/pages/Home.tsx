import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import { MISSION_META, type Go } from '../route';
import { formatKoreanDate, lastNDays, parseDateKey, toDateKey } from '../lib/date';
import { currentStreak, enabledMissions } from '../lib/progress';
import { ProgressBar, TopBar } from '../components/common';

export function Home({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state } = useStore();
  const today = toDateKey();
  const profile = state.profiles.find((p) => p.id === profileId)!;
  const data = state.data[profileId];
  const settings = state.settings[profileId];
  const day = data.days[today];
  const missions = enabledMissions(settings);
  const unusedCoupons = data.coupons.filter((c) => !c.usedAt).length;

  return (
    <div className="page">
      <TopBar
        title={
          <>
            {profile.avatar} {profile.name}
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
            <strong>오늘 미션을 모두 끝냈어요!</strong>
            <div>쿠폰을 받았어요: {settings.rewardLabel}</div>
          </div>
        </div>
      )}

      {missions.length === 0 && <p className="muted">보호자 모드에서 미션을 켜 주세요.</p>}

      <div className="mission-list">
        {missions.map((m) => {
          const meta = MISSION_META[m.type];
          const done = day?.progress[m.type] ?? 0;
          const finished = done >= m.target;
          return (
            <button
              key={m.type}
              className={`mission-card ${finished ? 'finished' : ''}`}
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

      {missions.every((m) => m.type !== 'reading') && (
        <button className="btn btn-ghost" onClick={() => go({ name: 'reading', profileId })}>
          📚 {profile.level === 'adult' ? '독서노트' : '독서록'} 열기
        </button>
      )}

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
