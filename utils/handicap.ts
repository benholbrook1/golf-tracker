import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { rounds } from '@/db/schema';
import { withTimestamp } from '@/utils/timestamps';

export class HandicapEngine {
  static calcDifferential(score: number, rating: number, slope: number): number {
    return parseFloat((((score - rating) * 113) / slope).toFixed(1));
  }

  static async getHandicapIndex(): Promise<number | null> {
    const recent = await db
      .select({ diff: rounds.handicapDifferential })
      .from(rounds)
      .where(and(isNotNull(rounds.handicapDifferential), isNull(rounds.deletedAt)))
      .orderBy(desc(rounds.date))
      .limit(20);

    if (recent.length < 3) return null;

    const sorted = recent
      .map((r) => r.diff!)
      .sort((a, b) => a - b);

    const best8 = sorted.slice(0, Math.min(8, sorted.length));
    const avg = best8.reduce((sum, d) => sum + d, 0) / best8.length;
    return parseFloat((avg * 0.96).toFixed(1));
  }

  static calcPlayingHandicap(index: number, slope: number, rating: number, par: number): number {
    return Math.round(index * (slope / 113) + (rating - par));
  }

  // Store differential on round completion — call from round summary screen
  static async saveDifferential(roundId: string): Promise<void> {
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.id, roundId),
      with: { combo: true },
    });

    if (!round?.comboId || !round.combo) return; // 9-hole rounds: skip

    const diff = this.calcDifferential(round.totalScore, round.combo.rating, round.combo.slope);
    await db
      .update(rounds)
      .set(withTimestamp({ handicapDifferential: diff, isComplete: true }))
      .where(eq(rounds.id, roundId));
  }
}

