import { describe, expect, it } from 'vitest';
import { applyNumberKey, mapKeyToAction } from './numberPad';

describe('DeX 키보드 동작 매핑', () => {
  it.each(['int', 'decimal', 'fraction', 'qr'] as const)('%s 문제의 숫자·삭제 키는 현재 칸 입력이고 Enter는 확인이다', (kind) => {
    for (const key of [...'0123456789', 'Backspace', 'Delete'])
      expect(mapKeyToAction(key, { kind, phase: 'answering' })).toEqual({ type: 'input', key });
    expect(mapKeyToAction('Enter', { kind, phase: 'answering' })).toEqual({ type: 'submit' });
  });
  it.each(['int', 'decimal', 'fraction', 'qr'] as const)('%s 문제의 피드백에서는 Enter만 다음 문제로 매핑한다', (kind) => {
    expect(mapKeyToAction('Enter', { kind, phase: 'feedback' })).toEqual({ type: 'next' });
    for (const key of ['1', '.', 'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'])
      expect(mapKeyToAction(key, { kind, phase: 'feedback' })).toBeNull();
  });
  it('소수점은 소수 문제에만 허용한다', () => {
    expect(mapKeyToAction('.', { kind: 'decimal', phase: 'answering' })).toEqual({ type: 'input', key: '.' });
    for (const kind of ['int', 'fraction', 'qr'] as const)
      expect(mapKeyToAction('.', { kind, phase: 'answering' })).toBeNull();
  });
  it.each(['fraction', 'qr'] as const)('%s의 Tab·Shift+Tab과 좌우 화살표는 칸 이동이다', (kind) => {
    expect(mapKeyToAction('Tab', { kind, phase: 'answering' })).toEqual({ type: 'move', direction: 1 });
    expect(mapKeyToAction('Tab', { kind, phase: 'answering', shiftKey: true })).toEqual({ type: 'move', direction: -1 });
    expect(mapKeyToAction('ArrowRight', { kind, phase: 'answering' })).toEqual({ type: 'move', direction: 1 });
    expect(mapKeyToAction('ArrowLeft', { kind, phase: 'answering' })).toEqual({ type: 'move', direction: -1 });
  });
  it.each(['int', 'decimal'] as const)('%s에서는 Tab과 화살표를 기본 포커스 동작에 맡긴다', (kind) => {
    for (const key of ['Tab', 'ArrowLeft', 'ArrowRight'])
      expect(mapKeyToAction(key, { kind, phase: 'answering' })).toBeNull();
  });
  it('키 코드가 아니라 event.key를 사용하고 관계없는 키를 무시한다', () => {
    expect(mapKeyToAction('5', { kind: 'int', phase: 'answering' })).toEqual({ type: 'input', key: '5' });
    for (const key of ['Numpad5', 'Escape', 'a', ' ', '+', '-', 'ArrowUp', 'ArrowDown'])
      expect(mapKeyToAction(key, { kind: 'decimal', phase: 'answering' })).toBeNull();
  });
});

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
