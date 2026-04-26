import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { courseNines, roundNines, rounds } from '@/db/schema';
import { withTimestamp } from '@/utils/timestamps';

export class HandicapEngine {
  static calcDifferential(score: number, rating: number, slope: number): number {
    return parseFloat((((score - rating) * 113) / slope).toFixed(1));
  }

  /**
   * Handicap index from stored differentials.
   *
   * 18-hole differentials are used directly.
   * 9-hole differentials (from rated single-nine rounds) are paired chronologically:
   *   combined = nineA + nineB  →  counts as one 18-hole differential entry.
   * Requires at least 3 differential entries (18-hole or paired 9-hole) to return a value.
   */
  static async getHandicapIndex(): Promise<number | null> {
    // 18-hole differentials
    const fullRounds = await db
      .select({ diff: rounds.handicapDifferential, date: rounds.date })
      .from(rounds)
      .where(and(isNotNull(rounds.handicapDifferential), isNull(rounds.deletedAt)))
      .orderBy(desc(rounds.date))
      .limit(20);

    // 9-hole differentials — pull up to 20 to pair
    const nineRounds = await db
      .select({ diff: rounds.nineHandicapDifferential, date: rounds.date })
      .from(rounds)
      .where(and(isNotNull(rounds.nineHandicapDifferential), isNull(rounds.deletedAt)))
      .orderBy(asc(rounds.date))
      .limit(20);

    // Pair 9-hole differentials chronologically (1+2, 3+4, …)
    const pairedDiffs: Array<{ diff: number; date: string }> = [];
    for (let i = 0; i + 1 < nineRounds.length; i += 2) {
      const a = nineRounds[i]!;
      const b = nineRounds[i + 1]!;
      pairedDiffs.push({
        diff: parseFloat(((a.diff ?? 0) + (b.diff ?? 0)).toFixed(1)),
        date: b.date, // use the later date for recency sorting
      });
    }

    // Merge, sort newest-first, take up to 20
    const allDiffs = [
      ...fullRounds.map((r) => ({ diff: r.diff!, date: r.date })),
      ...pairedDiffs,
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);

    if (allDiffs.length < 3) return null;

    const sorted = allDiffs.map((r) => r.diff).sort((a, b) => a - b);
    const best8 = sorted.slice(0, Math.min(8, sorted.length));
    const avg = best8.reduce((sum, d) => sum + d, 0) / best8.length;
    return parseFloat((avg * 0.96).toFixed(1));
  }

  static calcPlayingHandicap(index: number, slope: number, rating: number, par: number): number {
    return Math.round(index * (slope / 113) + (rating - par));
  }

  /**
   * Store differential on round completion.
   * - 18-hole rounds (comboId set): compute from combo rating/slope → `handicapDifferential`
   * - 9-hole rounds (no comboId): if the played nine has rating/slope →  `nineHandicapDifferential`
   */
  static async saveDifferential(roundId: string): Promise<void> {
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.id, roundId),
      with: { combo: true },
    });

    if (!round) return;

    // ── 18-hole round ──────────────────────────────────────────────────────────
    if (round.comboId && round.combo) {
      const diff = this.calcDifferential(round.totalScore, round.combo.rating, round.combo.slope);
      await db
        .update(rounds)
        .set(withTimestamp({ handicapDifferential: diff, isComplete: true }))
        .where(eq(rounds.id, roundId));
      return;
    }

    // ── 9-hole round ───────────────────────────────────────────────────────────
    // Find the single round_nine, then check if that nine has rating/slope.
    const [rn] = await db
      .select({ nineId: roundNines.nineId })
      .from(roundNines)
      .where(and(eq(roundNines.roundId, roundId), isNull(roundNines.deletedAt)))
      .limit(1);

    if (!rn) return;

    const [nine] = await db
      .select({ rating: courseNines.rating, slope: courseNines.slope })
      .from(courseNines)
      .where(eq(courseNines.id, rn.nineId))
      .limit(1);

    if (!nine?.rating || !nine.slope) return; // no rating set — skip

    const diff = this.calcDifferential(round.totalScore, nine.rating, nine.slope);
    await db
      .update(rounds)
      .set(withTimestamp({ nineHandicapDifferential: diff, isComplete: true }))
      .where(eq(rounds.id, roundId));
  }
}
