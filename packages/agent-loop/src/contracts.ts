import { z } from 'zod';

export const TIERS = ['MUST_FIX', 'SHOULD', 'NIT'] as const;
export type Tier = (typeof TIERS)[number];

/** The only tier that keeps the loop running. */
export const BLOCKING_TIER: Tier = 'MUST_FIX';

export const CoderResultSchema = z.object({
  blocked: z
    .boolean()
    .describe('True when a finding needs the maintainer, or answering it would change an acceptance criterion'),
  summary: z.string().describe('One paragraph: what you did this round, or why you are blocked'),
  outcomes: z.array(
    z.object({
      id: z.string().describe('The id of a finding you were briefed with'),
      outcome: z.enum(['fixed', 'rejected']),
      reason: z.string().describe('What you changed, or why the finding is wrong or out of scope'),
    })
  ),
});
export type CoderResult = z.infer<typeof CoderResultSchema>;

export const ReviewSchema = z.object({
  findings: z.array(
    z.object({
      path: z.string().describe('File the finding is about'),
      line: z.number().int().nullable().describe('Line in that file, or null'),
      tier: z.enum(TIERS),
      finding: z.string().describe('What is wrong and why'),
    })
  ),
});
export type Review = z.infer<typeof ReviewSchema>;
