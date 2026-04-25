import { db } from '@/db/client';
import { courseHoles, holeScores, roundNines, rounds } from '@/db/schema';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

/**
 * First global hole (1–9 or 1–18) with no score yet, or 'summary' if every hole is scored
 * (round may still be incomplete until user marks complete).
 */
export async function getResumeTarget(
  roundId: string
): Promise<{ type: 'hole'; globalHole: number } | { type: 'summary' }> {
  const round = await db.query.rounds.findFirst({
    where: and(eq(rounds.id, roundId), isNull(rounds.deletedAt)),
  });
  if (!round) return { type: 'summary' };

  const rns = await db.query.roundNines.findMany({
    where: and(eq(roundNines.roundId, roundId), isNull(roundNines.deletedAt)),
    orderBy: asc(roundNines.nineOrder),
  });
  if (rns.length === 0) return { type: 'summary' };

  const roundNineIds = rns.map((r) => r.id);
  const allScores = await db
    .select({
      roundNineId: holeScores.roundNineId,
      holeNumber: holeScores.holeNumber,
    })
    .from(holeScores)
    .where(and(inArray(holeScores.roundNineId, roundNineIds), isNull(holeScores.deletedAt)));
  const scored = new Set(allScores.map((r) => `${r.roundNineId}\0${r.holeNumber}`));

  for (const rn of rns) {
    const rows = await db
      .select()
      .from(courseHoles)
      .where(and(eq(courseHoles.nineId, rn.nineId), isNull(courseHoles.deletedAt)))
      .orderBy(asc(courseHoles.holeNumber));

    const offset = (rn.nineOrder - 1) * 9;
    for (const ch of rows) {
      const key = `${rn.id}\0${ch.holeNumber}`;
      if (!scored.has(key)) {
        return { type: 'hole', globalHole: offset + ch.holeNumber };
      }
    }
  }

  return { type: 'summary' };
}
