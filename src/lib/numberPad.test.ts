import { describe, expect, it } from 'vitest';
import { applyNumberKey } from './numberPad';

describe('숫자 키패드 입력', () => {
  it('앞자리 0을 포함한 숫자를 입력하고 한 자리 지우기와 전체 지우기를 처리한다', () => {
    const value = ['0', '1', '2'].reduce((value, key) => applyNumberKey(value, key), '');
    expect(value).toBe('012');
    expect(applyNumberKey(value, 'Backspace')).toBe('01');
    expect(applyNumberKey(value, 'Delete')).toBe('');
    expect(applyNumberKey('', 'Backspace')).toBe('');
  });
  it('소수에서만 소수점 하나를 허용하고 허용하지 않는 물리 키 입력을 무시한다', () => {
    expect(applyNumberKey('1', '.')).toBe('1');
    expect(applyNumberKey('1', '.', true)).toBe('1.');
    expect(applyNumberKey('1.5', '.', true)).toBe('1.5');
    expect(applyNumberKey('', '.', true)).toBe('.');
    expect(applyNumberKey('1', 'e')).toBe('1');
    expect(applyNumberKey('1', '-')).toBe('1');
  });
});
