import { useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { ProfileId } from '../types';
import type { Go } from '../route';
import { formatKoreanDate, toDateKey } from '../lib/date';
import { TopBar } from '../components/common';
import { PinGate } from '../components/PinGate';

export function Rewards({ profileId, go }: { profileId: ProfileId; go: Go }) {
  const { state, update } = useStore();
  const data = state.data[profileId];
  const [using, setUsing] = useState<string | null>(null);
  const unused = data.coupons.filter((c) => !c.usedAt);
  const used = data.coupons.filter((c) => c.usedAt).slice(-10).reverse();

  const markUsed = (id: string) => {
    update((draft) => {
      const c = draft.data[profileId].coupons.find((x) => x.id === id);
      if (c) c.usedAt = toDateKey();
    });
    setUsing(null);
  };

  return (
    <div className="page">
      <TopBar title="🎁 내 쿠폰" onBack={() => go({ name: 'home', profileId })} />
      {unused.length === 0 && <p className="muted center">오늘의 미션을 모두 끝내면 쿠폰을 받아요!</p>}
      <div className="coupon-list">
        {unused.map((c) => (
          <div key={c.id} className="coupon">
            <div className="coupon-label">{c.label}</div>
            <div className="small muted">{formatKoreanDate(c.earnedAt)} 획득</div>
            <button className="btn btn-primary" onClick={() => setUsing(c.id)}>
              사용하기 (보호자 확인)
            </button>
          </div>
        ))}
      </div>
      {used.length > 0 && (
        <>
          <h2 className="section-title">사용한 쿠폰</h2>
          <div className="coupon-list">
            {used.map((c) => (
              <div key={c.id} className="coupon used">
                <div className="coupon-label">{c.label}</div>
                <div className="small muted">{formatKoreanDate(c.usedAt!)} 사용</div>
              </div>
            ))}
          </div>
        </>
      )}
      {using && <PinGate onPass={() => markUsed(using)} onCancel={() => setUsing(null)} />}
    </div>
  );
}
