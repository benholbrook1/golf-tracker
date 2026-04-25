import { db } from '@/db/client';
import { courseCombos, courseHoles, courseNines, courses } from '@/db/schema';
import type { ScorecardParseResult } from '@/utils/validators';
import { ScorecardParseSchema } from '@/utils/validators';

export type ConfirmCourseImportResult = {
  courseId: string;
};

export type ConfirmScorecardParseOptions = {
  /** Which parsed tee column to store as courseHoles.yards (0-based index into `tees` and each hole’s `yardages`). */
  selectedTeeIndex: number;
};

export async function confirmScorecardParse(
  parse: ScorecardParseResult,
  options: ConfirmScorecardParseOptions
): Promise<ConfirmCourseImportResult> {
  const parsed = ScorecardParseSchema.parse(parse);
  const name = parsed.courseName.trim();
  if (name.length === 0) {
    throw new Error('Course name is required');
  }

  const { selectedTeeIndex } = options;
  if (selectedTeeIndex < 0 || selectedTeeIndex >= parsed.tees.length) {
    throw new Error('Invalid tee selection');
  }

  const [course] = await db.insert(courses).values({ name }).returning();

  const nineRows = await db
    .insert(courseNines)
    .values(
      parsed.nines.map((n) => ({
        courseId: course.id,
        name: n.name,
      }))
    )
    .returning();

  const nineIdByIndex = nineRows.map((n) => n.id);

  const holeValues = parsed.nines.flatMap((n, nineIdx) =>
    n.holes.map((h) => ({
      nineId: nineIdByIndex[nineIdx]!,
      holeNumber: h.holeNumber,
      par: h.par,
      handicap: h.handicap,
      yards: h.yardages[selectedTeeIndex] ?? null,
    }))
  );

  await db.insert(courseHoles).values(holeValues);

  // Default rating/slope for MVP course creation from scans (user can edit later).
  const defaultRating = 72.0;
  const defaultSlope = 113;

  if (nineRows.length === 2) {
    await db.insert(courseCombos).values({
      courseId: course.id,
      name: '18 Holes',
      frontNineId: nineRows[0]!.id,
      backNineId: nineRows[1]!.id,
      rating: defaultRating,
      slope: defaultSlope,
    });
  }

  if (nineRows.length === 3) {
    const [a, b, c] = nineRows;
    await db.insert(courseCombos).values([
      { courseId: course.id, name: `${a.name}/${b.name}`, frontNineId: a.id, backNineId: b.id, rating: defaultRating, slope: defaultSlope },
      { courseId: course.id, name: `${b.name}/${c.name}`, frontNineId: b.id, backNineId: c.id, rating: defaultRating, slope: defaultSlope },
      { courseId: course.id, name: `${a.name}/${c.name}`, frontNineId: a.id, backNineId: c.id, rating: defaultRating, slope: defaultSlope },
    ]);
  }

  return { courseId: course.id };
}
