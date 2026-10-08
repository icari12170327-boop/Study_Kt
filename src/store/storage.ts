import { normalizeGameAttempts, normalizeGames, normalizeGamesPerDay, validGameDate } from '../content/games/limits';
import { toDateKey } from '../lib/date';
import { enableBusinessTalkOnce, normalizeBizSituations, normalizeCustomCards } from '../lib/business';
import { normalizeCoachSettings } from '../lib/coach';
import { normalizeBingoData, normalizeBingoSettings } from '../content/math/bingo';
import { normalizeScience, normalizeScienceDay } from '../content/science/session';
import type { AppState } from '../types';
import type { AiConfig } from '../../shared/ai';
import { defaultSettings, defaultState } from './defaults';
import { clampMathLevel, defaultMathState } from '../content/math/levels';
import { migrateV1toV2, normalizeTalkLogs, normalizeTalkSettings } from '../lib/talk';

const KEY = 'study-kt:v1';

/** 저장된 값이 일부 빠져 있어도(이전 버전 등) 기본값으로 채운다. */
export function normalizeState(raw: unknown, today = toDateKey()): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<Omit<AppState, 'version'>> & { version?: number };
  if (s.version !== 1 && s.version !== 2) return base;
  const profiles = base.profiles.map((p) => ({ ...p, ...s.profiles?.find((x) => x.id === p.id) }));
  const settings = { ...base.settings };
  const data = { ...base.data };
  for (const p of profiles) {
    settings[p.id] = { ...defaultSettings(p.level, p.id), ...s.settings?.[p.id] };
    settings[p.id].gamesPerDay = normalizeGamesPerDay(s.settings?.[p.id]?.gamesPerDay);
    settings[p.id].missions = settings[p.id].missions.map((m) => ({ ...m }));
    if (!settings[p.id].missions.some(m => m.type === 'science')) settings[p.id].missions.push({ type: 'science', enabled: p.level !== 'adult', target: 5 });
    if (s.settings?.[p.id]?.scienceV2 !== true) {
      const science = settings[p.id].missions.find(m => m.type === 'science')!;
      if (science.target === 1) science.target = 5;
    }
    settings[p.id].scienceV2 = true;
    settings[p.id].bingo = normalizeBingoSettings(s.settings?.[p.id]?.bingo, p.level);
    const talk = normalizeTalkSettings(settings[p.id].talk, p.level, p.id);
    settings[p.id].talk = talk;
    if (p.id === 'parent' && p.level === 'adult') {
      settings[p.id].coach = normalizeCoachSettings(s.settings?.[p.id]?.coach);
    } else delete settings[p.id].coach;
    const mission = settings[p.id].missions.find((m) => m.type === 'talk');
    if (mission) {
      mission.target = Math.max(1, Math.min(100, Math.round(mission.target) || talk.dailyMinutes));
      talk.dailyMinutes = mission.target;
    } else settings[p.id].missions = [...settings[p.id].missions, { type: 'talk', enabled: p.level !== 'adult', target: talk.dailyMinutes }];
    data[p.id] = { ...base.data[p.id], ...s.data?.[p.id] };
    data[p.id].games = normalizeGames(s.data?.[p.id]?.games);
    if (validGameDate(s.data?.[p.id]?.crownUntil)) data[p.id].crownUntil = s.data![p.id].crownUntil;
    else delete data[p.id].crownUntil;
    data[p.id].customCards = normalizeCustomCards(s.data?.[p.id]?.customCards);
    data[p.id].bizSituations = normalizeBizSituations(s.data?.[p.id]?.bizSituations);
    data[p.id].bingo = normalizeBingoData(s.data?.[p.id]?.bingo);
    data[p.id].science = normalizeScience(s.data?.[p.id]?.science);
    data[p.id].talks = normalizeTalkLogs(s.data?.[p.id]?.talks);
    data[p.id].friendMemory = typeof s.data?.[p.id]?.friendMemory === 'string' ? s.data[p.id].friendMemory.slice(0, 1500) : '';
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
      [date, { ...day, ...(day.science !== undefined ? { science: normalizeScienceDay(day.science) } : {}), talkSeconds: typeof day.talkSeconds === 'number' && Number.isFinite(day.talkSeconds) && day.talkSeconds >= 0 ? Math.floor(day.talkSeconds) : (day.progress.talk ?? 0) * 60, mathAttempts: normalizeGameAttempts(day.mathAttempts, date, today) }]));
  }
  const ai = {
    ...(typeof s.ai?.endpoint === 'string' ? { endpoint: s.ai.endpoint } : {}),
    ...(typeof s.ai?.token === 'string' ? { token: s.ai.token } : {}),
  };
  const state = { ai, parentPin: s.parentPin, profiles, settings, data };
  const normalized: AppState = s.version === 1 ? migrateV1toV2({ ...state, version: 1 }) : { ...state, version: 2 };
  enableBusinessTalkOnce(normalized.settings.parent, s.settings?.parent?.bizTalkEnabledOnce === true);
  return normalized;
}

export function loadState(): AppState {
  try {
    const text = localStorage.getItem(KEY);
    return normalizeState(text ? JSON.parse(text) : null);
  } catch {
    return defaultState();
  }
}

/** 날짜가 바뀐 채 앱을 계속 열어도 저장·백업에는 지난 문제 본문을 남기지 않는다. */
function pruneProblems(today = toDateKey()) {
  return function (this: Record<string, unknown>, key: string, value: unknown): unknown {
    return key === 'mathAttempts' ? normalizeGameAttempts(value, String(this.date), today) : value;
  };
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state, pruneProblems()));
  } catch {
    // 저장 공간 부족 등: 다음 변경 때 다시 시도한다.
  }
}

export function exportState(state: AppState): string {
  // 가족 토큰은 이 기기에만 두고 백업으로 복사하지 않는다.
  return JSON.stringify({ ...state, ai: { endpoint: state.ai.endpoint } }, pruneProblems(), 2);
}

export function importState(text: string, localAi: AiConfig = {}): AppState {
  const parsed = JSON.parse(text);
  if (!parsed || ![1, 2].includes(parsed.version)) throw new Error('지원하지 않는 백업 파일입니다.');
  const restored = normalizeState(parsed);
  // 다른 백업에 토큰이 포함돼 있더라도 가져오지 않는다.
  restored.ai = { endpoint: restored.ai.endpoint };
  // 기존 토큰을 백업의 다른 주소로 보내지 않도록 현재 기기의 주소도 함께 유지한다.
  if (localAi.token) restored.ai = { ...localAi };
  return restored;
}
