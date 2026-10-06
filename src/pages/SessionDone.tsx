import type { ReactNode } from 'react';

/** 세션 종료 화면 */
export function SessionDone({
  correct,
  total,
  completedToday,
  rewardLabel,
  children,
}: {
  correct: number;
  total: number;
  completedToday: boolean;
  rewardLabel: string;
  children: ReactNode;
}) {
  const ratio = total ? correct / total : 0;
  const emoji = ratio >= 0.9 ? '🏆' : ratio >= 0.7 ? '😄' : ratio >= 0.5 ? '🙂' : '💪';
  return (
    <div className="done">
      <div className="done-emoji">{emoji}</div>
      <h2>
        {total}개 중 {correct}개 맞았어요!
      </h2>
      <p className="muted">별 {correct}개를 받았어요 ⭐</p>
      {completedToday && (
        <div className="celebrate big">
          <div className="celebrate-emoji">🎁</div>
          <div>
            <strong>오늘의 미션 완료!</strong>
            <div>{rewardLabel} 쿠폰을 받았어요.</div>
          </div>
        </div>
      )}
      <div className="done-actions">{children}</div>
    </div>
  );
}
