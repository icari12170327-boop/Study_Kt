import { parseDateKey, toDateKey } from './date';
import type { ProfileSettings } from '../types';

export const validBackupDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateKey(parseDateKey(value)) === value;
export function normalizeDeviceSettings(raw: Pick<ProfileSettings, 'lastBackupAt' | 'iosTabNoticeDismissed'>): Pick<ProfileSettings, 'lastBackupAt' | 'iosTabNoticeDismissed'> {
  return { ...(validBackupDate(raw.lastBackupAt) ? { lastBackupAt: raw.lastBackupAt } : {}), ...(typeof raw.iosTabNoticeDismissed === 'boolean' ? { iosTabNoticeDismissed: raw.iosTabNoticeDismissed } : {}) };
}
export interface DeviceEnv {
  width: number; height: number; dpr: number; userAgent: string; platform?: string; touchPoints?: number;
  displayStandalone: boolean; navigatorStandalone?: boolean; recognition: boolean; englishVoices: number;
  microphone?: PermissionState; persistSupported: boolean; persisted?: boolean; usage?: number; quota?: number;
  today: string; lastBackupAt?: string;
}
export interface DeviceItem { label: string; value: string; ok: boolean; advice: string }
/** 날짜 문자열을 UTC의 날짜 번호로만 바꿔 일광 절약 시간과 시간대의 영향을 피한다. */
export function backupAge(lastBackupAt: unknown, today: string): number | undefined {
  if (!validBackupDate(lastBackupAt) || !validBackupDate(today)) return undefined;
  const ordinal = (date: string) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.max(0, Math.floor((ordinal(today) - ordinal(lastBackupAt)) / 86400000));
}
export function checkDevice(env: DeviceEnv) {
  const standalone = env.displayStandalone || env.navigatorStandalone === true;
  const ios = /iPhone|iPad|iPod/i.test(env.userAgent) || env.platform === 'MacIntel' && (env.touchPoints ?? 0) > 1;
  const safari = /Safari/i.test(env.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(env.userAgent);
  const iosTab = ios && safari && !standalone;
  const stage = env.width >= 1800 ? 'QHD' : env.width >= 1200 ? '큰 화면' : env.width >= 600 ? '태블릿' : '폰';
  const age = backupAge(env.lastBackupAt, env.today);
  const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
  const items: DeviceItem[] = [
    { label: '화면', value: `${env.width} × ${env.height} CSS px · DPR ${env.dpr} · ${stage} · ${env.width > env.height ? '가로' : '세로'}`, ok: true, advice: '' },
    { label: '홈 화면 앱', value: standalone ? '홈 화면 앱' : '브라우저 탭', ok: standalone, advice: '브라우저 메뉴에서 홈 화면에 추가해 주세요.' },
    { label: '음성 인식', value: env.recognition ? '있음' : '없음', ok: env.recognition, advice: '따라 말하기는 ⌨️ 입력으로 하거나 지원하는 브라우저에서 여세요. 실시간 대화는 그대로 쓸 수 있어요.' },
    { label: '영어 읽기 목소리', value: `${env.englishVoices}개`, ok: env.englishVoices > 0, advice: '기기 설정에서 영어 음성을 설치하고 소리 시험을 눌러 주세요.' },
    { label: '마이크 권한', value: env.microphone === 'granted' ? '허용' : env.microphone === 'denied' ? '차단' : env.microphone === 'prompt' ? '아직 선택하지 않음' : '조회 미지원', ok: env.microphone === 'granted', advice: '마이크 시험을 눌러 허용해 주세요. 차단했다면 브라우저 설정에서 바꿔 주세요.' },
    { label: '저장 보호', value: !env.persistSupported ? '미지원' : env.persisted === undefined ? '확인하지 못함' : env.persisted ? '보호됨' : '보호되지 않음', ok: env.persisted === true, advice: '백업 파일을 정기적으로 받아 두세요. 저장 보호는 브라우저가 결정해요.' },
    { label: '저장 사용량', value: env.usage === undefined || env.quota === undefined ? '조회 미지원' : `${mb(env.usage)} 사용 · ${mb(Math.max(0, env.quota - env.usage))} 여유`, ok: env.usage !== undefined && env.quota !== undefined && env.usage < env.quota * 0.9, advice: '백업을 받은 뒤 기기의 저장 공간을 확보해 주세요.' },
    { label: '마지막 백업', value: age === undefined ? '기록 없음' : `${env.lastBackupAt} · ${age}일 전`, ok: age !== undefined && age < 14, advice: '백업 파일 받기를 눌러 다른 안전한 곳에 보관해 주세요.' },
  ];
  return { standalone, iosTab, stage, backupDays: age, items };
}
