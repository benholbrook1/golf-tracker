import { createId } from '@paralleldrive/cuid2';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import { withTimestamp } from '@/utils/timestamps';
import * as schema from './schema';

type AppDb = ExpoSQLiteDatabase<typeof schema>;

/**
 * One-time backfill: courses without `course_tees` get a "Default" tee and per-hole yardages
 * mirroring `course_holes.yards`, then `default_tee_id` is set.
 * Accepts `db` from the caller to avoid a require cycle with `client.ts`.
 */
export async function backfillCourseTeeDataIfNeeded(d: AppDb): Promise<void> {
  const allCourses = await d.select().from(schema.courses).where(isNull(schema.courses.deletedAt));

  for (const c of allCourses) {
    const existingTees = await d
      .select()
      .from(schema.courseTees)
      .where(and(eq(schema.courseTees.courseId, c.id), isNull(schema.courseTees.deletedAt)));
    if (existingTees.length > 0) {
      if (!c.defaultTeeId) {
        const defTee = existingTees.find((t) => t.isDefault) ?? existingTees[0]!;
        await d
          .update(schema.courses)
          .set(withTimestamp({ defaultTeeId: defTee.id }))
          .where(eq(schema.courses.id, c.id));
      }
      continue;
    }

    const nines = await d
      .select({ id: schema.courseNines.id })
      .from(schema.courseNines)
      .where(and(eq(schema.courseNines.courseId, c.id), isNull(schema.courseNines.deletedAt)));
    const nineIds = nines.map((n) => n.id);
    if (nineIds.length === 0) continue;

    const [tee] = await d
      .insert(schema.courseTees)
      .values({
        id: createId(),
        courseId: c.id,
        name: 'Default',
        sortOrder: 0,
        isDefault: true,
      })
      .returning();

    if (!tee) continue;

    const holes = await d
      .select()
      .from(schema.courseHoles)
      .where(
        and(inArray(schema.courseHoles.nineId, nineIds), isNull(schema.courseHoles.deletedAt))
      );

    for (const h of holes) {
      await d.insert(schema.courseHoleTeeYardages).values({
        id: createId(),
        courseHoleId: h.id,
        courseTeeId: tee.id,
        yards: h.yards,
      });
    }

    await d
      .update(schema.courses)
      .set(withTimestamp({ defaultTeeId: tee.id }))
      .where(eq(schema.courses.id, c.id));
  }
}
