import { emptyPuzzleData } from '../content/puzzles/state';
import { normalizeObby } from '../content/games/obby';
import { MY_PHRASES } from '../lib/business';
import { normalizeCoachSettings } from '../lib/coach';
import type { AppState, Level, ProfileData, ProfileId, ProfileSettings } from '../types';
import { skillsForLevel } from '../content/math/skills';
import { defaultMathState } from '../content/math/levels';
import { VOCAB_DECKS } from '../content/english/vocab';
import { SENTENCE_DECKS } from '../content/english/sentences';
import { defaultBingoSettings } from '../content/math/bingo';
import { defaultTalkSettings } from '../lib/talk';

export function emptyProfileData(level: Level = 'g3'): ProfileData {
  return { ...(level === 'adult' ? { retrieval: [] } : {}), weeklyAi: {}, stories: {}, puzzles: emptyPuzzleData(level), games: [], obby: normalizeObby(undefined), customCards: [], bizSituations: [], bingo: { recent: [], best: {} }, science: { collected: {}, experiments: {}, badges: [], recentWrong: [] }, math: defaultMathState(level), stars: 0, streak: 0, days: {}, wrongNotes: [], srs: {}, coupons: [], notes: [], talks: [], friendMemory: '' };
}

/** 학년별 기본 미션. 10월 기준 2학기 단원과 1학기 복습 단원을 모두 켠다. */
export function defaultSettings(level: Level, id?: ProfileId): ProfileSettings {
  const vocabDecks = VOCAB_DECKS.filter((d) => d.level === level).map((d) => d.id).concat(level === 'adult' ? [MY_PHRASES] : []);
  const speakingDecks = SENTENCE_DECKS.filter((d) => d.level === level).map((d) => d.id).concat(level === 'adult' ? [MY_PHRASES] : []);
  const mathSkills = skillsForLevel(level).map((s) => s.id);
  switch (level) {
    case 'g3':
      return {
        readingQuiz: { enabled: true },
        stories: { enabled: true },
        wordProblemRatio: 20,
        puzzles: { enabled: true },
        gamesPerDay: 3,
        scienceV2: true,
        bingo: defaultBingoSettings(level),
        talk: defaultTalkSettings(level, id),
        missions: [
          { type: 'science', enabled: true, target: 5 },
          { type: 'math', enabled: true, target: 20 },
          { type: 'vocab', enabled: false, target: 8 },
          { type: 'speaking', enabled: false, target: 3 },
          { type: 'talk', enabled: true, target: 15 },
          { type: 'reading', enabled: false, target: 1 },
        ],
        mathSkills,
        vocabDecks,
        speakingDecks,
        rewardLabel: '유튜브 30분 이용권 📺',
      };
    case 'g5':
      return {
        readingQuiz: { enabled: true },
        stories: { enabled: true },
        wordProblemRatio: 20,
        puzzles: { enabled: true },
        gamesPerDay: 3,
        scienceV2: true,
        bingo: defaultBingoSettings(level),
        talk: defaultTalkSettings(level, id),
        missions: [
          { type: 'science', enabled: true, target: 5 },
          { type: 'math', enabled: true, target: 20 },
          { type: 'vocab', enabled: false, target: 10 },
          { type: 'speaking', enabled: false, target: 5 },
          { type: 'talk', enabled: true, target: 20 },
          { type: 'reading', enabled: false, target: 1 },
        ],
        mathSkills,
        vocabDecks,
        speakingDecks,
        rewardLabel: '유튜브 30분 이용권 📺',
      };
    case 'adult':
      return {
        readingQuiz: { enabled: true },
        stories: { enabled: false },
        wordProblemRatio: 20,
        coach: normalizeCoachSettings(undefined),
        bizTalkEnabledOnce: true,
        puzzles: { enabled: true },
        gamesPerDay: 3,
        scienceV2: true,
        bingo: defaultBingoSettings(level),
        talk: defaultTalkSettings(level, id),
        missions: [
          { type: 'science', enabled: false, target: 5 },
          { type: 'math', enabled: false, target: 10 },
          { type: 'talk', enabled: true, target: 15 },
          { type: 'vocab', enabled: true, target: 10 },
          { type: 'speaking', enabled: true, target: 10 },
          { type: 'reading', enabled: true, target: 1 },
        ],
        mathSkills: [],
        vocabDecks,
        speakingDecks,
        rewardLabel: '오늘도 해냈다! 좋아하는 커피 한 잔 ☕',
      };
  }
}

export function defaultState(): AppState {
  const profiles = [
    { id: 'kid1' as const, name: '첫째', avatar: '🦁', level: 'g5' as const },
    { id: 'kid2' as const, name: '둘째', avatar: '🐰', level: 'g3' as const },
    { id: 'parent' as const, name: '나', avatar: '🦉', level: 'adult' as const },
  ];
  const settings = Object.fromEntries(profiles.map((p) => [p.id, defaultSettings(p.level, p.id)])) as Record<ProfileId, ProfileSettings>;
  const data = Object.fromEntries(profiles.map((p) => [p.id, emptyProfileData(p.level)])) as Record<ProfileId, ProfileData>;
  return { version: 2, ai: {}, profiles, settings, data };
}
