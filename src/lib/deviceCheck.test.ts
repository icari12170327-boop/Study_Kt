import { describe, expect, it, vi } from 'vitest';
import { backupAge, checkDevice, normalizeDeviceSettings, type DeviceEnv } from './deviceCheck';
import { requestStorageProtection } from './deviceStorage';
import { defaultState } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
const env: DeviceEnv = { width: 390, height: 844, dpr: 3, userAgent: 'iPhone Safari', displayStandalone: false, recognition: false, englishVoices: 0, persistSupported: false, today: '2026-10-11' };
describe('기기 관측값 판정', () => {
  it('홈 화면 판정은 두 방법 중 하나만 참이어도 되고 Safari 탭 안내와 겹치지 않는다', () => {
    expect(checkDevice(env).iosTab).toBe(true);
    for (const flag of [{ displayStandalone: true }, { navigatorStandalone: true }]) expect(checkDevice({ ...env, ...flag })).toMatchObject({ standalone: true, iosTab: false });
    expect(checkDevice({ ...env, userAgent: 'iPhone CriOS Safari' }).iosTab).toBe(false);
    expect(checkDevice({ ...env, userAgent: 'Macintosh Safari', platform: 'MacIntel', touchPoints: 5 }).iosTab).toBe(true);
    expect(checkDevice({ ...env, userAgent: 'Macintosh Safari', platform: 'MacIntel', touchPoints: 0 }).iosTab).toBe(false);
  });
  it.each([[390, '폰'], [599, '폰'], [600, '태블릿'], [1199, '태블릿'], [1200, '큰 화면'], [1800, 'QHD']])('폭 %i의 단계는 %s', (width, stage) => expect(checkDevice({ ...env, width }).stage).toBe(stage));
  it('없거나 거절된 API는 확인 필요와 해결법을 제공한다', () => {
    const items = checkDevice(env).items;
    expect(items.find(item => item.label === '저장 보호')).toMatchObject({ value: '미지원', ok: false });
    expect(items.filter(item => !item.ok).every(item => item.advice.length > 0)).toBe(true);
    expect(checkDevice({ ...env, persisted: true, englishVoices: 3, microphone: 'granted', usage: 20, quota: 100 }).items.filter(item => ['영어 읽기 목소리', '마이크 권한', '저장 사용량'].includes(item.label)).every(item => item.ok)).toBe(true);
  });
  it('14일 경계·월말·연말·윤일·잘못된 날짜를 처리한다', () => {
    expect(backupAge('2026-09-28', '2026-10-11')).toBe(13); expect(backupAge('2026-09-27', '2026-10-11')).toBe(14);
    expect(backupAge('2025-12-31', '2026-01-01')).toBe(1); expect(backupAge('2024-02-28', '2024-03-01')).toBe(2);
    expect(backupAge('2026-02-30', env.today)).toBeUndefined(); expect(backupAge(undefined, env.today)).toBeUndefined(); expect(backupAge('2027-01-01', env.today)).toBe(0);
  });
  it('persist는 지원할 때만 호출하고 거절과 미지원은 무시한다', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('denied'));
    await expect(requestStorageProtection({ persist } as unknown as StorageManager)).resolves.toBeUndefined(); expect(persist).toHaveBeenCalledTimes(1);
    await expect(requestStorageProtection({} as StorageManager)).resolves.toBeUndefined();
  });
});
describe('기기별 저장 설정과 백업', () => {
  it('선택 필드의 날짜·불리언만 허용하고 아이 설정에는 넣지 않는다', () => {
    const state = defaultState(); state.settings.parent.lastBackupAt = '2026-02-30'; state.settings.parent.iosTabNoticeDismissed = 'yes' as unknown as boolean;
    expect(normalizeDeviceSettings(state.settings.parent)).toEqual({});
    state.settings.kid1.lastBackupAt = '2026-10-01'; state.settings.parent.lastBackupAt = '2026-10-01'; state.settings.parent.iosTabNoticeDismissed = false;
    const next = normalizeState(state); expect(next.version).toBe(2); expect(next.settings.kid1.lastBackupAt).toBeUndefined(); expect(next.settings.parent).toMatchObject({ lastBackupAt: '2026-10-01', iosTabNoticeDismissed: false });
  });
  it('내보내기에는 날짜가 있고 복원은 현재 기기 날짜·닫기 상태를 보존한다', () => {
    const state = normalizeState(defaultState()); state.settings.parent.lastBackupAt = '2026-09-01'; state.settings.parent.iosTabNoticeDismissed = true; state.data.kid1.stars = 44;
    const text = exportState(state); expect(text).toContain('2026-09-01');
    const restored = importState(text, {}, { lastBackupAt: '2026-10-01', iosTabNoticeDismissed: false });
    expect(restored.settings.parent).toMatchObject({ lastBackupAt: '2026-10-01', iosTabNoticeDismissed: false }); expect(restored.data).toEqual(state.data); expect(restored.version).toBe(2);
    expect(importState(text).settings.parent.lastBackupAt).toBeUndefined(); expect(importState(text).settings.parent.iosTabNoticeDismissed).toBeUndefined();
  });
});
