import { detectRecast } from '../lib/recast';
export function RecastText({ text, user }: { text: string; user?: string }) {
  const change = user ? detectRecast(user, text) : null;
  return change ? <>{text.slice(0, change.start)}<u className="t22b-recast">{text.slice(change.start, change.end)}</u>{text.slice(change.end)} <small className="t22b-recast-label" lang="ko">✏️ 이렇게도 말해요</small></> : <>{text}</>;
}
