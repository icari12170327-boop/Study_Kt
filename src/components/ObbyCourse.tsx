import type { ObbyColor, ObbyHat } from '../types';
import { checkpointsPassed, obstacleKind, type ObbyRun, type ObstacleKind } from '../content/games/obby';

export const OBBY_COLOR_LABELS: Record<ObbyColor, string> = { red: '빨강', blue: '파랑', green: '초록', yellow: '노랑', purple: '보라' };
export const OBBY_HAT_LABELS: Record<ObbyHat, string> = { cap: '🧢', tophat: '🎩', helmet: '🪖' };
const OBSTACLES: Record<ObstacleKind, { emoji: string; label: string }> = {
  lava: { emoji: '🔥', label: '용암' }, wall: { emoji: '🧱', label: '벽' }, spinner: { emoji: '🌀', label: '회전 막대' }, hole: { emoji: '🕳️', label: '구멍' }, ladder: { emoji: '🪜', label: '사다리' },
};
export function ObbyAvatar({ color, hat, phase = 'idle' }: { color: ObbyColor; hat?: ObbyHat; phase?: 'idle' | 'jump' | 'fall' }) {
  return <div className={`obby-character obby-${phase} obby-${color}`} aria-label={`${OBBY_COLOR_LABELS[color]} 캐릭터${hat ? ` ${OBBY_HAT_LABELS[hat]}` : ''}`}>
    {hat && <span className="obby-hat" aria-hidden="true">{OBBY_HAT_LABELS[hat]}</span>}
    <span className="obby-face" aria-hidden="true">🙂</span><span className="obby-body" /><span className="obby-legs" />
  </div>;
}
export function ObbyCourse({ run, color, hat, phase }: { run: ObbyRun; color: ObbyColor; hat?: ObbyHat; phase: 'idle' | 'jump' | 'fall' }) {
  const fish = run.queue[0], obstacle = fish && OBSTACLES[obstacleKind(fish, run.stage)];
  return <div className={`obby-course obby-zone-${checkpointsPassed(run.cleared.length) % 5}`} aria-label={`Stage ${run.stage} 장애물 코스`}>
    <div className="obby-runner" key={`runner-${run.stage}-${run.falls}`}><ObbyAvatar color={color} hat={hat} phase={phase} /></div>
    {fish && <div className="obby-bubble"><h2 className="question-text">{fish.problem.question}</h2></div>}
    {obstacle && <span className="obby-obstacle" key={`obstacle-${run.stage}-${run.falls}`} role="img" aria-label={obstacle.label}>{obstacle.emoji}</span>}
    <span className="obby-flag" aria-hidden="true">🚩</span><div className="obby-floor" aria-hidden="true" />
  </div>;
}
