import { z } from 'zod';
import { CORRECTION_PATTERNS } from '../../shared/corrections';
import type { GenerateKind } from '../../shared/ai';
import { weeklyReportInputSchema, weeklyReportOutputSchema } from './weeklyReport';
export const profiles = ['kid1', 'kid2', 'parent'] as const;
const profileId = z.enum(profiles);
const level = z.enum(['g3', 'g5', 'adult']);
const coachLevel = z.enum(['zero', 'words', 'short', 'daily']);
const text = (max: number, min = 1) => z.string().min(min).max(max);
export const scenarioRoles = {
  'biz-standup': 'an overseas team manager',
  'biz-negotiation': 'a supplier sales representative',
  'biz-presentation-qa': 'a demanding executive',
  'biz-ai-adoption': 'a skeptical colleague',
  'biz-smalltalk': 'a business partner before a first meeting',
  'biz-escalation': 'a customer contact receiving a problem report',
  'biz-free': 'an industry colleague discussing AI and technology',
  'biz-custom': 'the counterpart in the situation described in the situation tag',
} as const;
export const sessionSchema = z
  .strictObject({
    profileId,
    level,
    mode: z.enum(['kid-friend', 'biz-talk', 'parent-coach']),
    coachTopic: z.enum(['daily', 'work', 'money']).optional(),
    coach: z.strictObject({ level: coachLevel, repeat: z.enum(['low', 'mid', 'high']) }).optional(),
    reviewTargets: z.array(text(160)).max(2).optional(),
    speed: z.union([z.literal(0.85), z.literal(0.9), z.literal(1)]).optional(),
    offerSdp: text(64000).startsWith('v=0'),
    persona: z.strictObject({
      friendName: z.enum(['Max', 'Lily', 'Alex', 'Emma']),
      personaId: z.enum(['cheerful', 'calm', 'funny']),
      voice: z.enum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar']),
      friendHobbies: text(400, 0).optional(),
      voiceStyle: z.enum(['kid-boy', 'kid-girl', 'young-woman', 'calm-man']).optional(),
    }),
    pushToTalk: z.boolean().optional(),
    memory: text(1500, 0).optional(),
    interests: z.array(text(80)).max(8).optional(),
    topic: text(40, 0).optional(),
    situation: text(300, 1).optional(),
    scenarioId: z
      .enum(Object.keys(scenarioRoles) as [keyof typeof scenarioRoles, ...Array<keyof typeof scenarioRoles>])
      .optional(),
  })
  .refine((r) =>
    r.profileId === 'parent'
      ? r.level === 'adult' && ((r.mode === 'biz-talk' && !!r.scenarioId) || (r.mode === 'parent-coach' && r.scenarioId === undefined))
      : r.level !== 'adult' && r.mode === 'kid-friend' && !r.scenarioId && r.speed === undefined,
  )
  .refine(r => r.reviewTargets === undefined || r.profileId === 'parent')
  .refine(r => r.persona.voiceStyle === undefined || (r.profileId === 'parent' ? ['young-woman', 'calm-man'] : ['kid-boy', 'kid-girl']).includes(r.persona.voiceStyle))
  .refine(r => r.profileId === 'parent' || r.persona.friendName !== 'Emma')
  .refine((r) => r.scenarioId === 'biz-custom' ? !!r.situation?.trim() : r.situation === undefined)
  .refine((r) => r.mode === 'parent-coach' ? !!r.coachTopic && !!r.coach : r.coachTopic === undefined && r.coach === undefined);
export const endSchema = z.strictObject({
  sessionId: text(100).regex(/^[\w-]+$/),
  seconds: z.number().finite().min(0).max(86400),
});
export const endActiveSchema = z.strictObject({ profileId: z.enum([...profiles, 'all']) });
const line = z.strictObject({
  role: z.enum(['kid', 'friend', 'user', 'assistant']),
  text: text(2000),
  at: z.number().finite().min(0),
  peeked: z.boolean().optional(),
});
const lines = z.array(line).min(1).max(300);
const expression = z.strictObject({ en: text(200), ko: text(200) });
export const summarySchema = z.strictObject({
  highlightKo: text(300),
  topicsKo: z.array(text(100)).max(8),
  newExpressions: z.array(expression).max(5),
  nextTopics: z.array(text(40)).max(3),
});
export const inputSchemas = {
  'talk-corrections': z.strictObject({ mode: z.enum(['coach', 'biz']), level: z.enum(['zero', 'words', 'short', 'daily', 'biz']),
    lines: z.array(z.strictObject({ role: z.enum(['user', 'ai']), text: text(2000) })).min(1).max(300),
  }).refine(r => r.mode === 'biz' ? r.level === 'biz' : r.level !== 'biz'),
  'weekly-report': weeklyReportInputSchema,
  'coach-gloss': z.strictObject({ text: text(300) }),
  'coach-wrapup': z.strictObject({ lines }),
  'coach-check': z.strictObject({ text: text(300), level: coachLevel }),
  'talk-summary': z.strictObject({ lines }),
  'biz-feedback': z.union([z.strictObject({ lines }), z.strictObject({ mode: z.literal('short'), text: text(2000) })]),
  'memory-merge': z.strictObject({
    memory: text(1500, 0),
    summary: summarySchema.extend({ flagged: z.boolean().optional() }),
  }),
  'word-problem': z.strictObject({
    items: z
      .array(
        z.strictObject({
          id: text(100),
          skill: text(100),
          expression: text(200),
          numbers: z.array(text(30)).min(1).max(12),
          answerKind: z.enum(['int', 'decimal', 'fraction', 'qr']),
          interest: text(20),
          level,
        }),
      )
      .min(1)
      .max(8),
  }),
  'reading-quiz': z.strictObject({
    title: text(200),
    author: text(100, 0),
    summary: text(8000, 40),
    level,
    count: z.number().int().min(1).max(10).default(5),
  }),
};
export const outputSchemas = {
  'talk-corrections': z.strictObject({ items: z.array(z.strictObject({ said: text(200), better: text(160), focus: text(40), whyKo: text(120), hintKo: text(80), pattern: z.enum(CORRECTION_PATTERNS) })).max(3), praiseKo: text(120) }),
  'weekly-report': weeklyReportOutputSchema,
  'coach-gloss': z.strictObject({ ko: text(400) }),
  'coach-wrapup': z.strictObject({ sentences: z.array(z.strictObject({ en: text(120), ko: text(120) })).max(3) }),
  'coach-check': z.strictObject({ corrected: text(200), noteKo: text(200) }),
  'talk-summary': summarySchema,
  'biz-feedback': z.strictObject({
    overallKo: text(300),
    corrections: z.array(z.strictObject({ said: text(300), better: text(300), why: text(300) })).max(5),
    nextExpressions: z.array(expression).length(3),
  }),
  'memory-merge': z.strictObject({ memory: text(1500, 0) }),
  'word-problem': z.strictObject({
    items: z
      .array(z.strictObject({ id: text(100), story: text(1000), question: text(300) }))
      .min(1)
      .max(8),
  }),
  'reading-quiz': z.strictObject({
    cards: z
      .array(z.strictObject({ q: text(500), a: text(500), type: z.enum(['fact', 'why', 'apply']) }))
      .min(1)
      .max(10),
  }),
};
export const shortFeedbackSchema = z.strictObject({ alternatives: z.array(text(300)).length(2) });
export const generateSchema = z
  .strictObject({
    profileId,
    level,
    kind: z.enum(Object.keys(inputSchemas) as [GenerateKind, ...GenerateKind[]]),
    input: z.unknown(),
  })
  .refine((r) => (r.profileId === 'parent' ? r.level === 'adult' : r.level !== 'adult'))
  .refine((r) => (r.kind !== 'talk-corrections' && r.kind !== 'biz-feedback' && r.kind !== 'weekly-report' && !r.kind.startsWith('coach-')) || r.profileId === 'parent');
