import { useCallback, useEffect, useRef, useState } from 'react';
import type { Answer } from '../types';
import type { AnswerInput } from '../content/math/grading';
import { applyNumberKey, mapKeyToAction } from '../lib/numberPad';

interface Props {
  kind: Answer['kind'];
  value: AnswerInput;
  onChange: (value: AnswerInput) => void;
  onSubmit: () => void;
  onNext: () => void;
  onActivity: () => void;
  disabled?: boolean;
}

type Field = { key: keyof AnswerInput; label: string };
const FIELDS: Record<Answer['kind'], Field[]> = {
  int: [{ key: 'value', label: '답' }],
  decimal: [{ key: 'value', label: '답' }],
  qr: [
    { key: 'q', label: '몫' },
    { key: 'r', label: '나머지' },
  ],
  fraction: [
    { key: 'whole', label: '자연수' },
    { key: 'num', label: '분자' },
    { key: 'den', label: '분모' },
  ],
};

export function NumberPad({ kind, value, onChange, onSubmit, onNext, onActivity, disabled }: Props) {
  const [active, setActive] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const fields = FIELDS[kind];
  const press = useCallback((key: string) => {
    if (disabled) return;
    onActivity();
    const field = fields[active].key;
    onChange({ ...value, [field]: applyNumberKey(value[field] ?? '', key, kind === 'decimal') });
  }, [disabled, onActivity, fields, active, onChange, value, kind]);
  const moveField = useCallback((direction: 1 | -1) => {
    if (disabled) return;
    const index = (active + direction + fields.length) % fields.length;
    setActive(index);
    inputs.current[index]?.focus();
    onActivity();
  }, [disabled, active, fields, onActivity]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return;
      // PIN은 기존 클래스, 다른 모달은 표준 속성으로 확인한다.
      if (document.querySelector('.modal-backdrop, [aria-modal="true"], dialog[open]')) return;
      const target = event.target instanceof Element ? event.target : document.activeElement;
      for (const element of [target, document.activeElement]) {
        const editable = element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
        if (editable && !inputs.current.some((input) => input === editable)) return;
      }
      const action = mapKeyToAction(event.key, { kind, phase: disabled ? 'feedback' : 'answering', shiftKey: event.shiftKey });
      if (!action) return;
      // 포커스된 버튼의 기본 클릭도 막아 중복 제출을 방지한다.
      event.preventDefault();
      if (event.repeat && (action.type === 'submit' || action.type === 'next')) return;
      if (action.type === 'input') press(action.key);
      else if (action.type === 'move') moveField(action.direction);
      else if (action.type === 'submit') onSubmit();
      else onNext();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [kind, disabled, press, moveField, onSubmit, onNext]);

  return (
    <div className="number-answer">
      <div className={`answer-row ${kind === 'fraction' ? 'fraction-row' : ''}`}>
        {fields.map((field, index) => (
          <label key={field.key} className="pad-field">
            <span className="small muted">{field.label}</span>
            <input
              ref={(node) => {
                inputs.current[index] = node;
              }}
              aria-label={field.label}
              className={`num-input ${fields.length > 1 ? 'short' : ''} ${index === active ? 'active-field' : ''}`}
              value={value[field.key] ?? ''}
              placeholder={field.key === 'r' ? '0' : '?'}
              readOnly
              inputMode="none"
              autoFocus={index === 0}
              disabled={disabled}
              onFocus={() => setActive(index)}
            />
          </label>
        ))}
      </div>
      <div className="number-pad" role="group" aria-label="숫자 키패드">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button key={digit} className="number-key" disabled={disabled} onClick={() => press(digit)}>
            {digit}
          </button>
        ))}
        {kind === 'decimal' ? (
          <button className="number-key" disabled={disabled} onClick={() => press('.')}>
            .
          </button>
        ) : fields.length > 1 ? (
          <button className="number-key small" disabled={disabled} onClick={() => moveField(1)}>
            다음 칸
          </button>
        ) : (
          <span />
        )}
        <button className="number-key" disabled={disabled} onClick={() => press('0')}>
          0
        </button>
        <button
          className="number-key"
          aria-label="한 자리 지우기"
          disabled={disabled}
          onClick={() => press('Backspace')}
        >
          ⌫
        </button>
        <button className="number-key number-confirm" disabled={disabled} onClick={onSubmit}>
          확인
        </button>
      </div>
    </div>
  );
}
