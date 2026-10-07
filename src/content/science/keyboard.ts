import type { ScienceQuestion } from './questions';
export type ScienceKeyAction = { type: 'choose'; chosen: number } | { type: 'next' };
export function scienceKeyAction(key: string, q: ScienceQuestion | undefined, answered: boolean): ScienceKeyAction | undefined {
  if (!q) return undefined;
  if (answered) return key === 'Enter' ? { type: 'next' } : undefined;
  const chosen = /^[1-4]$/.test(key) ? Number(key) - 1 : q.kind === 'ox' ? ['o', 'x'].indexOf(key.toLowerCase()) : -1;
  return chosen >= 0 && chosen < q.choices.length ? { type: 'choose', chosen } : undefined;
}
