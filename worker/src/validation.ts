import { z } from 'zod';
import type { GenerateKind } from '../../shared/ai';
export const profiles = ['kid1', 'kid2', 'parent'] as const;
const profileId = z.enum(profiles);
const level = z.enum(['g3', 'g5', 'adult']);
const text = (max: number, min = 1) => z.string().min(min).max(max);
export const scenarioRoles = {
  'biz-standup': 'an overseas team manager',
  'biz-negotiation': 'a supplier sales representative',
  'biz-presentation-qa': 'a demanding executive',
  'biz-ai-adoption': 'a skeptical colleague',
  'biz-smalltalk': 'a business partner before a first meeting',
  'biz-escalation': 'a customer contact receiving a problem report',
  'biz-free': 'an industry colleague discussing AI and technology',
} as const;
export const sessionSchema = z
  .strictObject({
    profileId,
    level,
    mode: z.enum(['kid-friend', 'biz-talk']),
    offerSdp: text(64000).startsWith('v=0'),
    persona: z.strictObject({
      friendName: z.enum(['Max', 'Lily', 'Alex']),
      personaId: z.enum(['cheerful', 'calm', 'funny']),
      voice: z.enum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar']),
      friendHobbies: text(400, 0).optional(),
    }),
    pushToTalk: z.boolean().optional(),
    memory: text(1500, 0).optional(),
    interests: z.array(text(80)).max(8).optional(),
    topic: text(40, 0).optional(),
    scenarioId: z
      .enum(Object.keys(scenarioRoles) as [keyof typeof scenarioRoles, ...Array<keyof typeof scenarioRoles>])
      .optional(),
  })
  .refine((r) =>
    r.profileId === 'parent'
      ? r.level === 'adult' && r.mode === 'biz-talk' && !!r.scenarioId
      : r.level !== 'adult' && r.mode === 'kid-friend' && !r.scenarioId,
  );
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
  .refine((r) => r.kind !== 'biz-feedback' || r.profileId === 'parent');
