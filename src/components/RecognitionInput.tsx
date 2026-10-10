import { useCallback, useEffect, useRef, useState } from 'react';
import { canRecognize, listenOnce, type ListenHandle } from '../lib/speech';

/** 모든 음성 인식 화면이 지원·권한 오류·취소를 같은 경로로 처리한다. WebRTC와는 별개다. */
export function useRecognition() {
  const [available, setAvailable] = useState(canRecognize);
  const [listening, setListening] = useState(false), [error, setError] = useState('');
  const handle = useRef<ListenHandle | undefined>(undefined), epoch = useRef(0);
  const stop = useCallback(() => { epoch.current++; handle.current?.stop(); handle.current = undefined; setListening(false); }, []);
  useEffect(() => () => { epoch.current++; handle.current?.stop(); handle.current = undefined; }, []);
  const listen = async (): Promise<string[] | undefined> => {
    if (!available || handle.current) return;
    const current = ++epoch.current; setListening(true); setError('');
    try {
      const request = listenOnce('en-US'); handle.current = request;
      const values = await request.promise;
      return current === epoch.current ? values : undefined;
    } catch (e) {
      if (current !== epoch.current) return;
      const code = e instanceof Error ? e.message : '';
      if (['unsupported', 'not-allowed', 'service-not-allowed', 'audio-capture'].includes(code)) setAvailable(false);
      else setError('말을 듣지 못했어요. 입력하거나 한 번 더 말해 주세요.');
    } finally { if (current === epoch.current) { handle.current = undefined; setListening(false); } }
  };
  return { available, listening, error, listen, stop };
}
export function RecognitionInput({ recognition, onListen, onKeyboard, child = false, label = '🎤 말하기' }: {
  recognition: ReturnType<typeof useRecognition>; onListen: () => void; onKeyboard: () => void; child?: boolean; label?: string;
}) {
  return <div className="recognition-input">
    <div className="row-center"><button className="btn btn-soft" disabled={!recognition.available} onClick={() => recognition.listening ? recognition.stop() : onListen()}>{recognition.listening ? '듣기 멈춤' : label}</button><button className="btn btn-soft" onClick={() => { recognition.stop(); onKeyboard(); }}>⌨️ 입력</button></div>
    {!recognition.available && <p className="small muted" role="status">{child ? '글자로 써도 돼요' : '이 기기에서는 음성 인식이 안 돼요'}</p>}
    {recognition.error && <p className="small" role="alert">{recognition.error}</p>}
  </div>;
}
