import { requestStorageProtection } from './lib/deviceStorage';
import { BrainPuzzles } from './pages/BrainPuzzles';
import { RewardGames } from './pages/RewardGames';
import { MathBingo } from './pages/MathBingo';
import { useEffect, useState } from 'react';
import type { Route } from './route';
import { ProfileSelect } from './pages/ProfileSelect';
import { Home } from './pages/Home';
import { MathSession } from './pages/MathSession';
import { VocabSession } from './pages/VocabSession';
import { SpeakingSession } from './pages/SpeakingSession';
import { Reading } from './pages/Reading';
import { StoryReading } from './pages/StoryReading';
import { Rewards } from './pages/Rewards';
import { Parent } from './pages/Parent';
import { PinGate } from './components/PinGate';
import { ScienceSession } from './pages/ScienceSession';
import { ScienceCollection } from './pages/ScienceCollection';
import { TalkSession } from './pages/TalkSession';

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'profiles' });
  const [parentUnlocked, setParentUnlocked] = useState(false);

  useEffect(() => { void requestStorageProtection(); }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (route.name !== 'parent') setParentUnlocked(false);
  }, [route]);

  switch (route.name) {
    case 'profiles':
      return <ProfileSelect go={setRoute} />;
    case 'home':
      return <Home profileId={route.profileId} go={setRoute} />;
    case 'games':
      return <RewardGames key={`${route.profileId}-${route.game ?? 'all'}`} profileId={route.profileId} initial={route.game} go={setRoute} />;
    case 'puzzles':
      return <BrainPuzzles key={route.profileId} profileId={route.profileId} go={setRoute} />;
    case 'bingo':
      return <MathBingo key={route.profileId} profileId={route.profileId} go={setRoute} />;
    case 'math':
      return <MathSession profileId={route.profileId} go={setRoute} />;
    case 'vocab':
      return <VocabSession profileId={route.profileId} go={setRoute} />;
    case 'speaking':
      return <SpeakingSession profileId={route.profileId} go={setRoute} />;
    case 'reading':
      return <Reading profileId={route.profileId} go={setRoute} />;
    case 'stories':
      return <StoryReading key={route.profileId} profileId={route.profileId} go={setRoute} />;
    case 'science':
      return <ScienceSession key={route.profileId} profileId={route.profileId} go={setRoute} />;
    case 'science-collection':
      return <ScienceCollection profileId={route.profileId} go={setRoute} />;
    case 'talk':
      return <TalkSession profileId={route.profileId} go={setRoute} />;
    case 'rewards':
      return <Rewards profileId={route.profileId} go={setRoute} />;
    case 'parent':
      return parentUnlocked ? (
        <Parent go={setRoute} initialTab={route.tab} />
      ) : (
        <PinGate onPass={() => setParentUnlocked(true)} onCancel={() => setRoute({ name: 'profiles' })} />
      );
  }
}
