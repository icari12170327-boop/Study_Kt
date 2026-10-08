import { useRef, useState } from 'react';
import type { GameId, ProfileId } from '../types';
import type { Go } from '../route';
import { useStore } from '../store/StoreContext';
import { toDateKey } from '../lib/date';
import { seededRng } from '../lib/random';
import { buildLevelQueue } from '../content/math/session';
import { buildFishPool } from '../content/games/fishing';
import { duelQueue } from '../content/games/duel';
import { canPlay, gamesPlayedToday, normalizeGamesPerDay, reserveDuel, reserveGame } from '../content/games/limits';
import { TopBar } from '../components/common';
import { FishingGame, type FishingPlan } from './FishingGame';
import { DuelGame, type DuelPlan } from './DuelGame';

export const REWARD_GAMES: { id: GameId; title: string }[] = [{ id: 'fishing', title: '🎣 낚시' }, { id: 'duel', title: '⚔️ 형제 대결' }];
export function RewardGames({ profileId, go, initial }: { profileId: ProfileId; go: Go; initial?: GameId }) {
  const { state, update } = useStore();
  const [fishing, setFishing] = useState<FishingPlan>(), [duel, setDuel] = useState<DuelPlan>();
  const starting = useRef(false), today = toDateKey();
  const profile = state.profiles.find(p => p.id === profileId)!, settings = state.settings[profileId], data = state.data[profileId];
  const allowed = profileId !== 'parent' && profile.level !== 'adult';
  const gate = canPlay(settings, data, today);
  const both = (['kid1', 'kid2'] as const).every(id => state.profiles.find(p => p.id === id)!.level !== 'adult' && canPlay(state.settings[id], state.data[id], today).ok);
  const dataLevel = (id: ProfileId) => state.data[id].math.level;
  const start = (game: GameId) => {
    if (starting.current || !allowed || !gate.ok || (game === 'duel' && !both)) return;
    const seed = Math.floor(Math.random() * 0x100000000), snapshot = structuredClone(state);
    if (game === 'fishing') {
      const index = reserveGame(settings, snapshot.data[profileId], today, game);
      if (index === null) return;
      const filler = buildLevelQueue(profile.level, data.math.level, [], 64, seededRng(seed)).map(row => row.problem);
      const pool = buildFishPool(data.days[today]?.mathAttempts ?? [], filler, 8);
      starting.current = true;
      update(draft => { reserveGame(draft.settings[profileId], draft.data[profileId], today, game); });
      setFishing({ date: today, index, pool, seed });
    } else {
      const slots = reserveDuel(snapshot, today); if (!slots) return;
      const queues = { kid1: duelQueue(state.profiles.find(p => p.id === 'kid1')!.level, dataLevel('kid1'), seed), kid2: duelQueue(state.profiles.find(p => p.id === 'kid2')!.level, dataLevel('kid2'), seed) };
      starting.current = true; update(draft => { reserveDuel(draft, today); });
      setDuel({ date: today, seed, slots, queues, levels: { kid1: dataLevel('kid1'), kid2: dataLevel('kid2') } });
    }
  };
  if (fishing) return <FishingGame profileId={profileId} go={go} plan={fishing} />;
  if (duel) return <DuelGame profileId={profileId} go={go} plan={duel} />;
  const message = !allowed || (!gate.ok && gate.reason === 'math-not-done') ? '🔒 수학 미션을 끝내면 열려요'
    : !gate.ok ? '오늘 판 수를 모두 썼어요. 내일 또 만나요!'
    : `오늘 ${Math.max(0, normalizeGamesPerDay(settings.gamesPerDay) - gamesPlayedToday(data.games ?? [], today))}판 남았어요`;
  return <div className="page"><TopBar title="🎮 오늘의 게임" onBack={() => go({ name: 'home', profileId })} /><section className="panel form">
    <h2>오늘의 수학으로 놀아요!</h2><p>{message}</p>
    {REWARD_GAMES.filter(game => !initial || game.id === initial).map(game => <button key={game.id} className="btn btn-primary" disabled={!allowed || !gate.ok || game.id === 'duel' && !both} onClick={() => start(game.id)}>{game.title} 시작</button>)}
    <p className="small muted">형제 대결은 두 아이 모두 수학을 끝내고 한 판 이상 남아 있어야 해요.</p><p className="small muted">낚시 90초 · 대결은 각자 90초. 시작하면 오늘 판 수에 포함돼요. 게임 점수는 별과 쿠폰에 더하지 않아요.</p>
  </section></div>;
}
