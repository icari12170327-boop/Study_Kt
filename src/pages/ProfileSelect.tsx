import { useStore } from '../store/StoreContext';
import type { Go } from '../route';
import { toDateKey, formatKoreanDate } from '../lib/date';
import { currentStreak, dayRatio } from '../lib/progress';
import { ProgressBar } from '../components/common';

export function ProfileSelect({ go }: { go: Go }) {
  const { state } = useStore();
  const today = toDateKey();

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-date">{formatKoreanDate(today)}</div>
        <h1 className="hero-title">누가 공부할 차례인가요?</h1>
      </div>
      <div className="profile-grid">
        {state.profiles.map((p) => {
          const data = state.data[p.id];
          const settings = state.settings[p.id];
          const ratio = dayRatio(data.days[today], settings);
          const done = data.days[today]?.completed;
          return (
            <button key={p.id} className="profile-card" onClick={() => go({ name: 'home', profileId: p.id })}>
              <div className="profile-avatar">{p.avatar}</div>
              <div className="profile-name">{p.name}</div>
              <div className="profile-meta">
                🔥 {currentStreak(data, today)}일 · ⭐ {data.stars}
              </div>
              <ProgressBar value={ratio * 100} max={100} />
              <div className="profile-status">{done ? '🎉 오늘 미션 완료!' : `오늘 ${Math.round(ratio * 100)}%`}</div>
            </button>
          );
        })}
      </div>
      <button className="btn btn-ghost parent-entry" onClick={() => go({ name: 'parent' })}>
        🔒 보호자 모드
      </button>
    </div>
  );
}
