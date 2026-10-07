import type { Answer } from '../types';

export type PadAction =
  | { type: 'input'; key: string }
  | { type: 'submit' }
  | { type: 'next' }
  | { type: 'move'; direction: 1 | -1 };

/** 키 입력 의미만 판정한다. 반복·포커스·모달 확인은 이벤트를 받는 화면에서 한다. */
export function mapKeyToAction(key: string, context: { kind: Answer['kind']; phase: 'answering' | 'feedback'; shiftKey?: boolean }): PadAction | null {
  if (key === 'Enter') return { type: context.phase === 'feedback' ? 'next' : 'submit' };
  if (context.phase === 'feedback') return null;
  if (/^[0-9]$/.test(key) || key === 'Backspace' || key === 'Delete' || (key === '.' && context.kind === 'decimal'))
    return { type: 'input', key };
  if (context.kind === 'fraction' || context.kind === 'qr') {
    if (key === 'Tab') return { type: 'move', direction: context.shiftKey ? -1 : 1 };
    if (key === 'ArrowRight') return { type: 'move', direction: 1 };
    if (key === 'ArrowLeft') return { type: 'move', direction: -1 };
  }
  return null;
}

/** 화면 키패드와 물리 키보드가 같은 입력 규칙을 사용한다. */
export function applyNumberKey(value: string, key: string, decimal = false): string {
  if (key === 'Backspace') return value.slice(0, -1);
  if (key === 'Delete') return '';
  if (/^[0-9]$/.test(key)) return value + key;
  if (key === '.' && decimal && !value.includes('.')) return value + '.';
  return value;
}
