import { db } from './client';
import { eq } from 'drizzle-orm';
import {
  courseCombos,
  courseHoles,
  courseNines,
  courses,
  holeScores,
  roundNines,
  rounds,
} from './schema';

function isoDate(): string {
  return new Date().toISOString().split('T')[0]!;
}

export async function seed(): Promise<void> {
  const [course] = await db
    .insert(courses)
    .values({ name: 'Westmount Golf & CC' })
    .returning();

  const [front9] = await db
    .insert(courseNines)
    .values({ courseId: course.id, name: 'Front 9' })
    .returning();

  const [back9] = await db
    .insert(courseNines)
    .values({ courseId: course.id, name: 'Back 9' })
    .returning();

  const frontPars = [4, 3, 5, 4, 3, 4, 5, 4, 3] as const;
  const backPars = [4, 5, 3, 4, 4, 5, 3, 4, 4] as const;

  const frontHoles = frontPars.map((par, i) => ({
    nineId: front9.id,
    holeNumber: i + 1,
    par,
    handicap: null,
    yards: null,
  }));
  const backHoles = backPars.map((par, i) => ({
    nineId: back9.id,
    holeNumber: i + 1,
    par,
    handicap: null,
    yards: null,
  }));

  const insertedFrontHoles = await db.insert(courseHoles).values(frontHoles).returning();
  const insertedBackHoles = await db.insert(courseHoles).values(backHoles).returning();

  const [combo] = await db
    .insert(courseCombos)
    .values({
      courseId: course.id,
      name: '18 Holes',
      frontNineId: front9.id,
      backNineId: back9.id,
      rating: 72.1,
      slope: 128,
    })
    .returning();

  // One complete 18-hole round
  const [round18] = await db
    .insert(rounds)
    .values({ courseId: course.id, comboId: combo.id, date: isoDate(), totalScore: 0 })
    .returning();

  const insertedRoundNines = await db
    .insert(roundNines)
    .values([
      { roundId: round18.id, nineId: front9.id, nineOrder: 1 },
      { roundId: round18.id, nineId: back9.id, nineOrder: 2 },
    ])
    .returning();

  const roundFront = insertedRoundNines.find((n) => n.nineOrder === 1)!;
  const roundBack = insertedRoundNines.find((n) => n.nineOrder === 2)!;

  // Simple deterministic scores: par on every hole, 2 putts, gir true on par-3+? keep simple
  const frontScores = insertedFrontHoles.map((h) => ({
    roundNineId: roundFront.id,
    courseHoleId: h.id,
    holeNumber: h.holeNumber,
    strokes: frontPars[h.holeNumber - 1],
    putts: 2,
    fairwayHit: h.par !== 3,
    gir: true,
  }));
  const backScores = insertedBackHoles.map((h) => ({
    roundNineId: roundBack.id,
    courseHoleId: h.id,
    holeNumber: h.holeNumber,
    strokes: backPars[h.holeNumber - 1],
    putts: 2,
    fairwayHit: h.par !== 3,
    gir: true,
  }));

  await db.insert(holeScores).values([...frontScores, ...backScores]);

  // Update total score for the 18-hole round (sum pars)
  const total18 = [...frontPars, ...backPars].reduce((s, p) => s + p, 0);
  await db.update(rounds).set({ totalScore: total18, isComplete: true }).where(eq(rounds.id, round18.id));

  // One 9-hole round (front nine only)
  const [round9] = await db
    .insert(rounds)
    .values({ courseId: course.id, comboId: null, date: isoDate(), totalScore: 0, isComplete: true })
    .returning();

  await db.insert(roundNines).values([{ roundId: round9.id, nineId: front9.id, nineOrder: 1 }]);
}
