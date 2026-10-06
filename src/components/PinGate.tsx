import { useState } from 'react';
import { useStore } from '../store/StoreContext';

/**
 * 보호자 PIN 확인. PIN이 없으면 새로 만든다.
 * 아이들이 설정이나 쿠폰을 바꾸지 못하게 하는 간단한 잠금이다.
 */
export function PinGate({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const { state, update } = useStore();
  const creating = !state.parentPin;
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState('');

  const press = (d: string) => {
    setError('');
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length < 4) return;
    if (!creating) {
      if (next === state.parentPin) onPass();
      else {
        setError('PIN이 맞지 않아요.');
        setPin('');
      }
      return;
    }
    if (first === null) {
      setFirst(next);
      setPin('');
    } else if (first === next) {
      update((d) => {
        d.parentPin = next;
      });
      onPass();
    } else {
      setError('두 번 입력한 PIN이 달라요. 처음부터 다시 해 주세요.');
      setFirst(null);
      setPin('');
    }
  };

  const title = creating ? (first === null ? '보호자 PIN 만들기 (숫자 4자리)' : '한 번 더 입력해 주세요') : '보호자 PIN 입력';

  return (
    <div className="modal-backdrop">
      <div className="modal pin-modal">
        <h2>🔒 {title}</h2>
        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < pin.length ? 'dot filled' : 'dot'} />
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="pin-key" onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button className="pin-key muted" onClick={onCancel}>
            취소
          </button>
          <button className="pin-key" onClick={() => press('0')}>
            0
          </button>
          <button className="pin-key muted" onClick={() => setPin(pin.slice(0, -1))}>
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}
