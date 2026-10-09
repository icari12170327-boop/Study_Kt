import { z } from 'zod';

const count = z.number().int().min(0).max(1000000);
const accuracy = z.number().int().min(0).max(100).nullable();
const mathLevel = z.number().int().min(1).max(9);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
});
export const weeklyStatsSchema = z.strictObject({
  profileId: z.enum(['kid1', 'kid2']),
  range: z.strictObject({ start: date, end: date }).refine(range =>
    new Date(`${range.start}T00:00:00Z`).getUTCDay() === 1 &&
    Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`) === 6 * 86400000),
  attendance: z.strictObject({ completedDays: count.max(7), streak: count, stars: count.nullable(), coupons: count }),
  math: z.strictObject({
    solved: count, accuracy, currentLevel: mathLevel, levelStart: mathLevel.nullable(), levelEnd: mathLevel.nullable(),
    weakSkills: z.array(z.strictObject({ skill: z.string().regex(/^[a-z0-9-]{1,100}$/), label: z.string().min(1).max(100), accuracy: z.number().int().min(0).max(100) })).max(3),
    guesses: count, storyAccuracy: accuracy,
  }),
  science: z.strictObject({ solved: count, accuracy, newCards: count, newBadges: z.array(z.string().regex(/^[a-z0-9-]+:(?:5|10|all)$/).max(100)).max(60) }),
  // 로컬 한 줄 요약도 전송하지 않는다. 상세 문장 필드는 빈 배열만 허용한다.
  talk: z.strictObject({ minutes: z.number().finite().min(0).max(1000000), sessions: count, highlights: z.array(z.never()).max(0) }),
  play: z.strictObject({ bingoGames: count, bingoBest: count.optional(), puzzlesSolved: count, puzzleLevelUps: count.nullable(), fishing: count, duels: count, crowns: count, storyEpisodes: count.nullable() }),
});
export const weeklyReportInputSchema = z.strictObject({ stats: weeklyStatsSchema, level: z.enum(['g3', 'g5']) });
const summary = z.string().min(1).max(300).refine(value => !!value.trim());
export const weeklyReportOutputSchema = z.strictObject({ goodKo: summary, watchKo: summary, nextKo: summary });
