import { useEffect, useState } from 'react';
import { toDateKey } from '../../lib/date';

/** 자정과 앱 복귀 때 갱신한다. 백그라운드 타이머가 늦어져도 날짜는 기기 시계로 계산한다. */
export function useStoryDate(): string {
  const [today, setToday] = useState(() => toDateKey());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setToday(toDateKey(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 1);
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}
