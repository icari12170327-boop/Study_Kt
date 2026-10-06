import { useRef, useState } from 'react';
import type { Answer } from '../types';
import type { AnswerInput } from '../content/math/grading';
import { applyNumberKey } from '../lib/numberPad';

interface Props {
  kind: Answer['kind'];
  value: AnswerInput;
  onChange: (value: AnswerInput) => void;
  onSubmit: () => void;
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

export function NumberPad({ kind, value, onChange, onSubmit, onActivity, disabled }: Props) {
  const [active, setActive] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const fields = FIELDS[kind];
  const press = (key: string) => {
    if (disabled) return;
    onActivity();
    const field = fields[active].key;
    onChange({ ...value, [field]: applyNumberKey(value[field] ?? '', key, kind === 'decimal') });
  };
  const nextField = () => {
    const index = (active + 1) % fields.length;
    inputs.current[index]?.focus();
    onActivity();
  };

  return (
    <div
      className="number-answer"
      onKeyDown={(event) => {
        if (disabled || event.ctrlKey || event.altKey || event.metaKey) return;
        if (/^[0-9]$/.test(event.key) || ['.', 'Backspace', 'Delete'].includes(event.key)) {
          event.preventDefault();
          press(event.key);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (!event.repeat) onSubmit();
        }
      }}
    >
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
          <button className="number-key small" disabled={disabled} onClick={nextField}>
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
