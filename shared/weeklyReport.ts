export interface WeekRange { start: string; end: string }
export interface WeeklyStats {
  profileId: 'kid1' | 'kid2';
  range: WeekRange;
  attendance: { completedDays: number; streak: number; stars: number | null; coupons: number };
  math: {
    solved: number; accuracy: number | null; currentLevel: number;
    levelStart: number | null; levelEnd: number | null;
    weakSkills: { skill: string; label: string; accuracy: number }[];
    guesses: number; storyAccuracy: number | null;
  };
  science: { solved: number; accuracy: number | null; newCards: number; newBadges: string[] };
  talk: { minutes: number; sessions: number; highlights: string[] };
  play: {
    bingoGames: number; bingoBest?: number; puzzlesSolved: number; puzzleLevelUps: number | null;
    fishing: number; duels: number; crowns: number; storyEpisodes: number | null;
  };
}
export interface WeeklyAiText { goodKo: string; watchKo: string; nextKo: string }
export interface WeeklyAi extends WeeklyAiText { createdAt: string }
