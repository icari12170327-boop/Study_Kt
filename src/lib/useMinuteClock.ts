import { useEffect, useState } from 'react';
/** 분 경계와 화면 복귀 때 실제 시계로 갱신한다. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { setNow(new Date()); clearTimeout(timer); timer = setTimeout(tick, 60000 - Date.now() % 60000); };
    tick(); document.addEventListener('visibilitychange', tick);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}
