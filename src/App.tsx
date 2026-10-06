import { useEffect, useState } from 'react';
import type { Route } from './route';
import { ProfileSelect } from './pages/ProfileSelect';
import { Home } from './pages/Home';
import { MathSession } from './pages/MathSession';
import { VocabSession } from './pages/VocabSession';
import { SpeakingSession } from './pages/SpeakingSession';
import { Reading } from './pages/Reading';
import { Rewards } from './pages/Rewards';
import { Parent } from './pages/Parent';
import { PinGate } from './components/PinGate';

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'profiles' });
  const [parentUnlocked, setParentUnlocked] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (route.name !== 'parent') setParentUnlocked(false);
  }, [route]);

  switch (route.name) {
    case 'profiles':
      return <ProfileSelect go={setRoute} />;
    case 'home':
      return <Home profileId={route.profileId} go={setRoute} />;
    case 'math':
      return <MathSession profileId={route.profileId} go={setRoute} />;
    case 'vocab':
      return <VocabSession profileId={route.profileId} go={setRoute} />;
    case 'speaking':
      return <SpeakingSession profileId={route.profileId} go={setRoute} />;
    case 'reading':
      return <Reading profileId={route.profileId} go={setRoute} />;
    case 'rewards':
      return <Rewards profileId={route.profileId} go={setRoute} />;
    case 'parent':
      return parentUnlocked ? (
        <Parent go={setRoute} />
      ) : (
        <PinGate onPass={() => setParentUnlocked(true)} onCancel={() => setRoute({ name: 'profiles' })} />
      );
  }
}
