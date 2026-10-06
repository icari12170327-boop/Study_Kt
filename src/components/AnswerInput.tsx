import { useEffect, useRef } from 'react';
import type { Answer } from '../types';
import type { AnswerInput as Input } from '../content/math/grading';

interface Props {
  kind: Answer['kind'];
  value: Input;
  onChange: (v: Input) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

/** 답 형식(정수, 소수, 분수, 몫과 나머지)에 맞는 입력 칸 */
export function AnswerInput({ kind, value, onChange, onSubmit, disabled }: Props) {
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!disabled) first.current?.focus();
  }, [kind, disabled]);

  const field = (key: keyof Input, opts: { placeholder?: string; decimal?: boolean; className?: string; autoRef?: boolean } = {}) => (
    <input
      ref={opts.autoRef ? first : undefined}
      className={`num-input ${opts.className ?? ''}`}
      inputMode={opts.decimal ? 'decimal' : 'numeric'}
      placeholder={opts.placeholder}
      value={value[key] ?? ''}
      disabled={disabled}
      onChange={(e) => onChange({ ...value, [key]: e.target.value.replace(opts.decimal ? /[^0-9.]/g : /[^0-9]/g, '') })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit();
      }}
    />
  );

  switch (kind) {
    case 'int':
      return <div className="answer-row">{field('value', { autoRef: true, placeholder: '?' })}</div>;
    case 'decimal':
      return <div className="answer-row">{field('value', { autoRef: true, decimal: true, placeholder: '?' })}</div>;
    case 'qr':
      return (
        <div className="answer-row">
          <label className="answer-label">몫</label>
          {field('q', { autoRef: true, className: 'short' })}
          <label className="answer-label">나머지</label>
          {field('r', { className: 'short', placeholder: '0' })}
        </div>
      );
    case 'fraction':
      return (
        <div className="answer-row fraction-row">
          {field('whole', { autoRef: true, className: 'short', placeholder: '자연수' })}
          <div className="fraction-stack">
            {field('num', { className: 'short', placeholder: '분자' })}
            <div className="fraction-line" />
            {field('den', { className: 'short', placeholder: '분모' })}
          </div>
        </div>
      );
  }
}
