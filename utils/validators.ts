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
  par: z.number().int().min(3).max(5),
  yards: z.number().int().positive().nullable(),
  handicap: z.number().int().min(1).max(9).nullable(),
});

export const ScorecardParseSchema = z.object({
  courseName: z.string().min(1).max(100),
  nines: z
    .array(
      z.object({
        name: z.string().min(1),
        holes: z.array(CourseHoleSchema).length(9),
      })
    )
    .min(1)
    .max(3),
});

export type ScorecardParseResult = z.infer<typeof ScorecardParseSchema>;
export type HoleScoreInput = z.infer<typeof HoleScoreSchema>;

