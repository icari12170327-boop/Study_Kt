import type { AppState } from '../types';
import { defaultState } from './defaults';

const KEY = 'study-kt:v1';

/** 저장된 값이 일부 빠져 있어도(이전 버전 등) 기본값으로 채운다. */
export function normalizeState(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<AppState>;
  if (s.version !== 1) return base;
  const profiles = base.profiles.map((p) => ({ ...p, ...s.profiles?.find((x) => x.id === p.id) }));
  const settings = { ...base.settings };
  const data = { ...base.data };
  for (const p of base.profiles) {
    settings[p.id] = { ...base.settings[p.id], ...s.settings?.[p.id] };
    data[p.id] = { ...base.data[p.id], ...s.data?.[p.id] };
  }
  return { version: 1, parentPin: s.parentPin, profiles, settings, data };
}

export function loadState(): AppState {
  try {
    const text = localStorage.getItem(KEY);
    return normalizeState(text ? JSON.parse(text) : null);
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 공간 부족 등: 다음 변경 때 다시 시도한다.
  }
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(text: string): AppState {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.version !== 1) throw new Error('지원하지 않는 백업 파일입니다.');
  return normalizeState(parsed);
}
