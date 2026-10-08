import { describe, expect, it } from 'vitest';
import { storyKeyAction } from './keyboard';

describe('이야기 보기 입력', () => {
  it.each(['1', '2', '3', '4'])('%s번을 고르고 Enter로 확인한다', key => {
    const choice = Number(key) - 1;
    expect(storyKeyAction(key, 'question')).toEqual({ type: 'choose', choice });
    expect(storyKeyAction('Enter', 'question', choice)).toEqual({ type: 'submit' });
  });
  it('고르지 않은 Enter와 범위 밖 키는 무시한다', () => {
    for (const key of ['0', '5', 'a', 'ArrowRight', 'Enter']) expect(storyKeyAction(key, 'question')).toBeUndefined();
    expect(storyKeyAction('Enter', 'question', -1)).toBeUndefined();
    expect(storyKeyAction('Enter', 'question', 4)).toBeUndefined();
    expect(storyKeyAction('Enter', 'question', 0.5)).toBeUndefined();
  });
  it('오답 뒤에는 다시 풀고 정답 뒤에는 다음 문제로만 이동한다', () => {
    expect(storyKeyAction('Enter', 'wrong', 1)).toEqual({ type: 'retry' });
    expect(storyKeyAction('Enter', 'correct', 1)).toEqual({ type: 'next' });
    for (const phase of ['wrong', 'correct', 'done'] as const) for (const key of ['1', '2', '3', '4']) expect(storyKeyAction(key, phase, 1)).toBeUndefined();
    expect(storyKeyAction('Enter', 'done', 1)).toBeUndefined();
  });
});
