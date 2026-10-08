export type StoryKeyAction = { type: 'choose'; choice: number } | { type: 'submit' | 'retry' | 'next' };
export function storyKeyAction(key: string, phase: 'question' | 'wrong' | 'correct' | 'done', selected?: number): StoryKeyAction | undefined {
  if (phase === 'done') return undefined;
  if (key === 'Enter') {
    if (phase === 'wrong') return { type: 'retry' };
    if (phase === 'correct') return { type: 'next' };
    return selected !== undefined && Number.isInteger(selected) && selected >= 0 && selected < 4 ? { type: 'submit' } : undefined;
  }
  return phase === 'question' && /^[1-4]$/.test(key) ? { type: 'choose', choice: Number(key) - 1 } : undefined;
}
