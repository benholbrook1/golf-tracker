import { z } from 'zod';

export const HoleScoreSchema = z.object({
  strokes: z.number().int().min(1).max(20),
  putts: z.number().int().min(0).max(10),
  fairwayHit: z.boolean(),
  gir: z.boolean(),
}).refine((v) => v.putts <= v.strokes, {
  message: 'Putts cannot exceed strokes',
  path: ['putts'],
});

export const CourseHoleSchema = z.object({
  holeNumber: z.number().int().min(1).max(9),
  // Par 6 is rare but appears on some cards; LLMs sometimes return it.
  par: z.number().int().min(3).max(6),
  // One value per entry in the root-level `tees` array. Max per hole (real holes are rarely >800; models sometimes err high).
  yardages: z
    .array(z.number().int().min(0).max(2000).nullable())
    .min(1)
    .max(16),
  // Scorecards often print stroke index 1–18 for a full 18; each nine may list 1–9 or 10–18.
  handicap: z.number().int().min(1).max(18).nullable(),
});

export const ScorecardParseSchema = z
  .object({
    courseName: z.string().min(1).max(300),
    // Labels for each column of yardages (e.g. "Blue", "White", "Gold") — same order for every hole.
    tees: z.array(z.string().min(1).max(64)).min(1).max(16),
    nines: z
      .array(
        z.object({
          name: z.string().min(1).max(200),
          holes: z.array(CourseHoleSchema).length(9),
        })
      )
      .min(1)
      .max(3),
  })
  .refine(
    (val) => {
      const L = val.tees.length;
      return val.nines.every((nine) => nine.holes.every((h) => h.yardages.length === L));
    },
    { message: 'Each hole must have yardages[] length equal to tees[]' }
  );

export type ScorecardParseResult = z.infer<typeof ScorecardParseSchema>;
export type HoleScoreInput = z.infer<typeof HoleScoreSchema>;

