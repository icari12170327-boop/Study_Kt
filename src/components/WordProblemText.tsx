import { canSpeak, speak } from '../lib/speech';
export function WordProblemText({ story }: { story: string }) {
  return <div className="word-problem">
    <p className="word-problem-text">{story}</p>
    <button className="btn btn-soft" disabled={!canSpeak()} onClick={() => { void speak(story, { lang: 'ko-KR' }); }}>🔊 읽어 주기</button>
  </div>;
}
