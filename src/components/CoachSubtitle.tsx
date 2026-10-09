import { parentPersona } from '../lib/voices';
import { CoachMeaning } from './CoachMeaning';
import { subtitleVisible } from '../lib/coach';
import type { CoachSettings } from '../types';
import type { AiConfig } from '../lib/ai';
export function CoachSubtitle({ line, mode, cfg, onReveal, friendName = parentPersona().friendName }: { line: { text: string; done: boolean; audioDone?: boolean; peeked?: boolean }; mode: CoachSettings['subtitle']; cfg: AiConfig; onReveal: () => void; friendName?: string }) {
  const visible = subtitleVisible(mode, { audioDone: line.audioDone === true, peeked: line.peeked });
  return <article className="coach-line">
    {visible ? <p lang="en"><span>{friendName}:</span> {line.text}</p> : mode === 'hidden' ? <button className="btn btn-soft" onClick={onReveal}>자막 보기</button> : <p className="muted">{friendName}의 말을 먼저 들어 보세요…</p>}
    {visible && line.done && <CoachMeaning key={line.text} text={line.text} cfg={cfg} />}
  </article>;
}
