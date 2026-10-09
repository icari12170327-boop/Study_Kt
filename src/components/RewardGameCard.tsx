import type { ProfileId } from '../types';
import type { Go } from '../route';
import { useStore } from '../store/StoreContext';
import { canPlay, crownVisible, gamesPlayedToday, normalizeGamesPerDay } from '../content/games/limits';

export function RewardGameCard({ profileId, today, go }: { profileId: ProfileId; today: string; go: Go }) {
  const { state } = useStore();
  const profile = state.profiles.find(p => p.id === profileId)!;
  if (profileId === 'parent' || profile.level === 'adult') return null;
  const data = state.data[profileId], settings = state.settings[profileId], gate = canPlay(settings, data, today);
  const both = (['kid1', 'kid2'] as const).every(id => state.profiles.find(p => p.id === id)!.level !== 'adult' && canPlay(state.settings[id], state.data[id], today).ok);
  return <section className="panel form reward-games-home" aria-label="오늘의 게임">
    <h2>🎮 오늘의 게임</h2>
    {crownVisible(data.crownUntil, today) && <p className="game-crown">👑 다음 게임 선택권</p>}
    {!gate.ok && <p>{gate.reason === 'math-not-done' ? '🔒 수학 미션을 끝내면 열려요' : '오늘 판 수를 모두 썼어요. 내일 또 만나요!'}</p>}
    <p className="small muted">오늘 {Math.max(0, normalizeGamesPerDay(settings.gamesPerDay) - gamesPlayedToday(data.games ?? [], today))}판 남았어요</p>
    <div className="game-buttons"><button className="btn btn-primary" disabled={!gate.ok} onClick={() => go({ name: 'games', profileId, game: 'fishing' })}>🎣 낚시</button>
      <button className="btn btn-soft" disabled={!gate.ok} onClick={() => go({ name: 'games', profileId, game: 'obby' })}>🏃 오비 달리기</button>
      <button className="btn btn-soft" disabled={!gate.ok || !both} onClick={() => go({ name: 'games', profileId, game: 'duel' })}>⚔️ 형제 대결</button></div>
    {!both && <p className="small muted">형제 대결은 둘 다 수학을 끝내고 남은 판이 있어야 해요.</p>}
  </section>;
}
