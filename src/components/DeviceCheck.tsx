import { useEffect, useRef, useState } from 'react';
import { canRecognize, canSpeak, speak } from '../lib/speech';
import { checkDevice, type DeviceEnv } from '../lib/deviceCheck';
import { toDateKey } from '../lib/date';
import { useStore } from '../store/StoreContext';
import { startMicrophoneTest } from '../lib/microphoneTest';

/** 브라우저 API의 관측값만 모으고 판정은 순수 함수에 맡긴다. 권한 요청은 시험 버튼에서만 한다. */
export function browserDeviceEnv(): DeviceEnv {
  if (typeof window === 'undefined') return { width: 0, height: 0, dpr: 1, userAgent: '', displayStandalone: false, recognition: false, englishVoices: 0, persistSupported: false, today: toDateKey() };
  return { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio,
    userAgent: navigator.userAgent, platform: navigator.platform, touchPoints: navigator.maxTouchPoints,
    displayStandalone: matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    recognition: canRecognize(), englishVoices: canSpeak() ? window.speechSynthesis.getVoices().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang)).length : 0,
    persistSupported: typeof navigator.storage?.persist === 'function', today: toDateKey() };
}
export function DeviceCheck() {
  const { state } = useStore();
  const [env, setEnv] = useState(browserDeviceEnv), [testing, setTesting] = useState(false), [level, setLevel] = useState(0), [soundPlaying, setSoundPlaying] = useState(false), [message, setMessage] = useState('');
  const alive = useRef(true), microphone = useRef<ReturnType<typeof startMicrophoneTest> | undefined>(undefined), busy = useRef(false), playing = useRef(false);
  useEffect(() => {
    alive.current = true;
    const refresh = () => setEnv(previous => ({ ...previous, ...browserDeviceEnv() }));
    window.addEventListener('resize', refresh); const synthesis = canSpeak() ? window.speechSynthesis : undefined;
    synthesis?.addEventListener('voiceschanged', refresh);
    let permission: PermissionStatus | undefined;
    const permissionChange = () => { if (alive.current && permission) setEnv(previous => ({ ...previous, microphone: permission!.state })); };
    // 각 API가 없거나 거절되어도 다른 점검 항목은 보인다.
    void (async () => {
      const [persisted, estimate, mic] = await Promise.allSettled([
        Promise.resolve().then(() => navigator.storage?.persisted?.()), Promise.resolve().then(() => navigator.storage?.estimate?.()), Promise.resolve().then(() => navigator.permissions?.query({ name: 'microphone' as PermissionName })),
      ]);
      if (!alive.current) return;
      if (mic.status === 'fulfilled' && mic.value) { permission = mic.value; permission.addEventListener('change', permissionChange); }
      setEnv(previous => ({ ...previous,
        persisted: persisted.status === 'fulfilled' ? persisted.value : undefined,
        usage: estimate.status === 'fulfilled' ? estimate.value?.usage : undefined,
        quota: estimate.status === 'fulfilled' ? estimate.value?.quota : undefined,
        microphone: permission?.state,
      }));
    })();
    const visibility = () => { if (document.hidden && microphone.current) { microphone.current.stop(); } };
    document.addEventListener('visibilitychange', visibility);
    return () => { alive.current = false; microphone.current?.stop(); if (playing.current) synthesis?.cancel(); window.removeEventListener('resize', refresh); synthesis?.removeEventListener('voiceschanged', refresh); permission?.removeEventListener('change', permissionChange); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const report = checkDevice({ ...env, lastBackupAt: state.settings.parent.lastBackupAt });
  const testMicrophone = async () => {
    if (busy.current) return;
    busy.current = true; setTesting(true); setMessage(''); setLevel(0);
    try {
      const test = startMicrophoneTest(volume => { if (alive.current) setLevel(volume); }); microphone.current = test;
      await test.done;
      if (alive.current) setMessage('마이크 시험을 끝냈어요. 음량 막대가 움직였는지 확인해 주세요.');
    } catch { if (alive.current) setMessage('마이크를 쓰지 못했어요. 브라우저 설정의 마이크 권한과 연결을 확인해 주세요.'); }
    finally { busy.current = false; microphone.current = undefined; if (alive.current) setTesting(false); }
  };
  return <section className="panel form device-check" aria-label="이 기기 점검">
    <h2>이 기기 점검</h2><dl>{report.items.map(item => <div key={item.label}><dt><strong>{item.label}</strong></dt><dd>{item.value}<p className={`small ${item.ok ? 'good-text' : 'muted'}`}>{item.ok ? '괜찮아요' : `확인 필요 · ${item.advice}`}</p></dd></div>)}</dl>
    <div className="row-center"><button className="btn btn-soft" disabled={!canSpeak() || soundPlaying} onClick={() => { if (playing.current) return; playing.current = true; setSoundPlaying(true); void speak('Hello! Let’s check the sound.', { lang: 'en-US' }).finally(() => { playing.current = false; if (alive.current) setSoundPlaying(false); }); }}>🔊 소리 시험</button><button className="btn btn-soft" disabled={testing || !navigator.mediaDevices?.getUserMedia} onClick={() => { void testMicrophone(); }}>{testing ? '마이크 시험 중…' : '🎤 마이크 시험'}</button></div>
    <p className="small muted">3초 동안 음량만 확인해요. 녹음은 저장하지 않아요.</p><meter min={0} max={1} value={level} aria-label="마이크 음량" />
    {message && <p role="status">{message}</p>}
  </section>;
}
export function StorageNotices() {
  const { state, update } = useStore();
  const report = checkDevice({ ...browserDeviceEnv(), lastBackupAt: state.settings.parent.lastBackupAt });
  return <>
    {report.iosTab && !state.settings.parent.iosTabNoticeDismissed && <aside className="panel form" aria-label="홈 화면 추가 안내"><p>홈 화면에 추가하면 기록이 더 안전해요. Safari 탭과 홈 화면 앱은 기록이 따로예요. 옮기려면 백업 파일을 쓰세요</p><p className="small muted">Safari의 공유 버튼에서 ‘홈 화면에 추가’를 골라 주세요.</p><button className="btn btn-soft" onClick={() => update(draft => { draft.settings.parent.iosTabNoticeDismissed = true; })}>안내 닫기</button></aside>}
    {report.backupDays === undefined ? <p role="status">아직 백업 기록이 없어요. 백업·보안에서 백업 파일을 받아 주세요.</p> : report.backupDays >= 14 && <p role="status">백업한 지 {report.backupDays}일 지났어요. 백업·보안에서 백업 파일을 받아 주세요.</p>}
  </>;
}
