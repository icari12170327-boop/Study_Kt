import { useCallback, useEffect, useRef, useState } from 'react';
import { canRecognize, listenOnce, type ListenHandle } from '../lib/speech';

/** 모든 음성 인식 화면이 지원·권한 오류·취소를 같은 경로로 처리한다. WebRTC와는 별개다. */
export function useRecognition() {
  const [available, setAvailable] = useState(canRecognize);
  const [listening, setListening] = useState(false), [error, setError] = useState('');
  const handle = useRef<ListenHandle | undefined>(undefined), epoch = useRef(0);
  // 사용자 종료는 마지막 인식 결과를 받고, 취소·화면 이탈은 늦은 결과를 버린다.
  const finish = useCallback(() => { handle.current?.stop(); }, []);
  const stop = useCallback(() => { epoch.current++; handle.current?.stop(); handle.current = undefined; setListening(false); }, []);
  const retry = useCallback(() => { stop(); setAvailable(canRecognize()); setError(''); }, [stop]);
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
  return { available, listening, error, listen, finish, stop, retry };
}
export function RecognitionInput({ recognition, onListen, onKeyboard, child = false, keepResultOnStop = false, label = '🎤 말하기' }: {
  recognition: ReturnType<typeof useRecognition>; onListen: () => void; onKeyboard: () => void; child?: boolean; keepResultOnStop?: boolean; label?: string;
}) {
  return <div className="recognition-input">
    <div className="row-center"><button className={child ? `btn btn-mic${recognition.listening ? ' on' : ''}` : 'btn btn-soft'} aria-pressed={recognition.listening} disabled={!recognition.available} onClick={() => recognition.listening ? (keepResultOnStop ? recognition.finish() : recognition.stop()) : onListen()}>{recognition.listening ? '듣기 멈춤' : label}</button><button className="btn btn-soft" onClick={() => { recognition.stop(); onKeyboard(); }}>⌨️ 입력</button></div>
    {!recognition.available && <p className="small muted" role="status">{child ? '글자로 써도 돼요' : '이 기기에서는 음성 인식이 안 돼요'}</p>}
    {!recognition.available && canRecognize() && <><p className="small muted">브라우저에서 마이크 권한을 허용한 뒤 다시 확인해 주세요.</p><button className="btn btn-soft" onClick={recognition.retry}>마이크 다시 확인</button></>}
    {recognition.error && <p className="small" role="alert">{recognition.error}</p>}
  </div>;
}
