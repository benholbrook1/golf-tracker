import { createId } from '@paralleldrive/cuid2';

import { db } from '@/db/client';
import { courseCombos, courseHoleTeeYardages, courseHoles, courseNines, courseTees, courses } from '@/db/schema';
import type { ScorecardParseResult } from '@/utils/validators';
import { ScorecardParseSchema } from '@/utils/validators';
import { withTimestamp } from '@/utils/timestamps';
import { eq } from 'drizzle-orm';

export type ConfirmCourseImportResult = {
  courseId: string;
};

export type ConfirmScorecardParseOptions = {
  /** Which parsed tee column is the default and backs `course_holes.yards` (0-based index). */
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

  const [course] = await db.insert(courses).values({ name, imageKey: 'stock-golf-1' }).returning();

  const teeRows = await db
    .insert(courseTees)
    .values(
      parsed.tees.map((label, i) => ({
        id: createId(),
        courseId: course.id,
        name: label.trim() || `Tee ${i + 1}`,
        sortOrder: i,
        isDefault: i === selectedTeeIndex,
      }))
    )
    .returning();

  const defaultTee = teeRows[selectedTeeIndex];
  if (!defaultTee) {
    throw new Error('Tee data mismatch');
  }

  const nineRows = await db
    .insert(courseNines)
    .values(
      parsed.nines.map((n) => ({
        id: createId(),
        courseId: course.id,
        name: n.name,
      }))
    )
    .returning();

  const nineIdByIndex = nineRows.map((n) => n.id);

  const holeValues = parsed.nines.flatMap((n, nineIdx) =>
    n.holes.map((h) => ({
      id: createId(),
      nineId: nineIdByIndex[nineIdx]!,
      holeNumber: h.holeNumber,
      par: h.par,
      handicap: h.handicap,
      yards: h.yardages[selectedTeeIndex] ?? null,
    }))
  );

  const holeRows = await db.insert(courseHoles).values(holeValues).returning();

  // Map back to parsed shape for per-tee yardages: same order as flat hole list
  let rowIdx = 0;
  for (let ni = 0; ni < parsed.nines.length; ni++) {
    for (const h of parsed.nines[ni]!.holes) {
      const holeRow = holeRows[rowIdx++]!;
      for (let ti = 0; ti < parsed.tees.length; ti++) {
        const tr = teeRows[ti]!;
        await db.insert(courseHoleTeeYardages).values({
          id: createId(),
          courseHoleId: holeRow.id,
          courseTeeId: tr.id,
          yards: h.yardages[ti] ?? null,
        });
      }
    }
  }

  await db
    .update(courses)
    .set(withTimestamp({ defaultTeeId: defaultTee.id }))
    .where(eq(courses.id, course.id));

  const defaultRating = 72.0;
  const defaultSlope = 113;

  if (nineRows.length === 2) {
    await db.insert(courseCombos).values({
      id: createId(),
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
      {
        id: createId(),
        courseId: course.id,
        name: `${a.name}/${b.name}`,
        frontNineId: a.id,
        backNineId: b.id,
        rating: defaultRating,
        slope: defaultSlope,
      },
      {
        id: createId(),
        courseId: course.id,
        name: `${b.name}/${c.name}`,
        frontNineId: b.id,
        backNineId: c.id,
        rating: defaultRating,
        slope: defaultSlope,
      },
      {
        id: createId(),
        courseId: course.id,
        name: `${a.name}/${c.name}`,
        frontNineId: a.id,
        backNineId: c.id,
        rating: defaultRating,
        slope: defaultSlope,
      },
    ]);
  }

  return { courseId: course.id };
}
