/** 화면 키패드와 물리 키보드가 같은 입력 규칙을 사용한다. */
export function applyNumberKey(value: string, key: string, decimal = false): string {
  if (key === 'Backspace') return value.slice(0, -1);
  if (key === 'Delete') return '';
  if (/^[0-9]$/.test(key)) return value + key;
  if (key === '.' && decimal && !value.includes('.')) return value + '.';
  return value;
}
