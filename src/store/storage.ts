import type { AppState } from '../types';
import { defaultState } from './defaults';
import { clampMathLevel, defaultMathState } from '../content/math/levels';

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
  for (const p of profiles) {
    settings[p.id] = { ...base.settings[p.id], ...s.settings?.[p.id] };
    data[p.id] = { ...base.data[p.id], ...s.data?.[p.id] };
    const math = s.data?.[p.id]?.math;
    data[p.id].math = {
      ...defaultMathState(p.level),
      ...(typeof math?.lastEvaluated === 'string' ? { lastEvaluated: math.lastEvaluated } : {}),
      level: typeof math?.level === 'number' && Number.isFinite(math.level)
        ? clampMathLevel(math.level, p.level) : defaultMathState(p.level).level,
      history: Array.isArray(math?.history) ? math.history.filter((row) => row && typeof row.date === 'string' &&
        Number.isFinite(row.level) && Number.isFinite(row.counted) && Number.isFinite(row.correct) &&
        Number.isFinite(row.guesses) && Number.isFinite(row.medianSec)).slice(-30) : [],
    };
    data[p.id].days = Object.fromEntries(Object.entries(data[p.id].days).map(([date, day]) =>
      [date, { ...day, mathAttempts: Array.isArray(day.mathAttempts) ? day.mathAttempts : [] }]));
  }
  const ai = {
    ...(typeof s.ai?.endpoint === 'string' ? { endpoint: s.ai.endpoint } : {}),
    ...(typeof s.ai?.token === 'string' ? { token: s.ai.token } : {}),
  };
  return { version: 1, ai, parentPin: s.parentPin, profiles, settings, data };
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
  // 가족 토큰은 이 기기에만 두고 백업으로 복사하지 않는다.
  return JSON.stringify({ ...state, ai: { endpoint: state.ai.endpoint } }, null, 2);
}

export function importState(text: string): AppState {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.version !== 1) throw new Error('지원하지 않는 백업 파일입니다.');
  const restored = normalizeState(parsed);
  // 다른 백업에 토큰이 포함돼 있더라도 가져오지 않는다.
  restored.ai = { endpoint: restored.ai.endpoint };
  return restored;
}
