import { useCallback, useEffect, useMemo, useState } from 'react';

import { db } from '@/db/client';
import {
  courseCombos,
  courseHoleTeeYardages,
  courseHoles,
  courseNines,
  courseTees,
  holeScores,
  roundNines,
  rounds,
} from '@/db/schema';
import { HoleScoreInput, HoleScoreSchema } from '@/utils/validators';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { softDelete, withTimestamp } from '@/utils/timestamps';

type RoundBundle = {
  round:
    | (typeof rounds.$inferSelect & {
        combo: typeof courseCombos.$inferSelect | null;
        tee: typeof courseTees.$inferSelect | null;
      })
    | null;
  roundNines: Array<
    typeof roundNines.$inferSelect & {
      nine: typeof courseNines.$inferSelect;
      holes: typeof holeScores.$inferSelect[];
      courseHoles: typeof courseHoles.$inferSelect[];
    }
  >;
  /** courseHoleId → yards for the round’s tee */
  yardageByCourseHoleId: Map<string, number | null>;
  totalScore: number;
};

export function useRound(roundId: string | null | undefined): {
  round: RoundBundle['round'];
  roundNines: RoundBundle['roundNines'];
  yardageByCourseHoleId: RoundBundle['yardageByCourseHoleId'];
  totalScore: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveHole: (
    roundNineId: string,
    courseHoleId: string,
    holeNumber: number,
    data: HoleScoreInput
  ) => Promise<void>;
  completeRound: () => Promise<void>;
  abandonRound: () => Promise<void>;
  deleteRound: () => Promise<void>;
} {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<RoundBundle>({
    round: null,
    roundNines: [],
    yardageByCourseHoleId: new Map(),
    totalScore: 0,
  });

  const load = useCallback(async () => {
    if (!roundId) {
      setBundle({ round: null, roundNines: [], yardageByCourseHoleId: new Map(), totalScore: 0 });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const round = await db.query.rounds.findFirst({
        where: and(eq(rounds.id, roundId), isNull(rounds.deletedAt)),
        with: { combo: true, tee: true },
      });

      if (!round) {
        setBundle({ round: null, roundNines: [], yardageByCourseHoleId: new Map(), totalScore: 0 });
        setError('Round not found');
        setLoading(false);
        return;
      }

      const rns = await db.query.roundNines.findMany({
        where: and(eq(roundNines.roundId, roundId), isNull(roundNines.deletedAt)),
        with: {
          nine: true,
          holeScores: {
            where: isNull(holeScores.deletedAt),
          },
        },
        orderBy: asc(roundNines.nineOrder),
      });

      // Pull courseHoles for those nines so hole screens can resolve par/etc without duplicating.
      const nineIds = rns.map((n) => n.nineId);
      const holesByNine = await db
        .select()
        .from(courseHoles)
        .where(and(isNull(courseHoles.deletedAt)))
        .then((rows) =>
          rows
            .filter((h) => nineIds.includes(h.nineId))
            .reduce<Record<string, typeof courseHoles.$inferSelect[]>>((acc, h) => {
              (acc[h.nineId] ??= []).push(h);
              return acc;
            }, {})
        );

      const ordered = rns.map((rn) => ({
        ...rn,
        holes: rn.holeScores.sort((a, b) => a.holeNumber - b.holeNumber),
        courseHoles: (holesByNine[rn.nineId] ?? []).sort((a, b) => a.holeNumber - b.holeNumber),
      }));

      const allCourseHoleIds = ordered.flatMap((rn) => rn.courseHoles.map((h) => h.id));
      const yardageByCourseHoleId = new Map<string, number | null>();
      if (round.teeId && allCourseHoleIds.length > 0) {
        const yardRows = await db
          .select({
            courseHoleId: courseHoleTeeYardages.courseHoleId,
            yards: courseHoleTeeYardages.yards,
          })
          .from(courseHoleTeeYardages)
          .where(
            and(
              eq(courseHoleTeeYardages.courseTeeId, round.teeId),
              inArray(courseHoleTeeYardages.courseHoleId, allCourseHoleIds),
              isNull(courseHoleTeeYardages.deletedAt)
            )
          );
        for (const y of yardRows) {
          yardageByCourseHoleId.set(y.courseHoleId, y.yards);
        }
      }

      const totalScore = await db
        .select({ strokes: holeScores.strokes })
        .from(holeScores)
        .innerJoin(roundNines, eq(holeScores.roundNineId, roundNines.id))
        .where(and(eq(roundNines.roundId, roundId), isNull(holeScores.deletedAt), isNull(roundNines.deletedAt)))
        .then((rows) => rows.reduce((sum, r) => sum + (r.strokes ?? 0), 0));

      setBundle({
        round: { ...round, combo: round.combo ?? null, tee: round.tee ?? null },
        roundNines: ordered,
        yardageByCourseHoleId,
        totalScore,
      });
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [roundId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const saveHole = useCallback(
    async (roundNineId: string, courseHoleId: string, holeNumber: number, data: HoleScoreInput) => {
      if (!roundId) return;

      // Validate at boundary.
      HoleScoreSchema.parse(data);

      const existing = await db.query.holeScores.findFirst({
        where: and(eq(holeScores.roundNineId, roundNineId), eq(holeScores.holeNumber, holeNumber), isNull(holeScores.deletedAt)),
      });

      if (existing) {
        await db
          .update(holeScores)
          .set(withTimestamp({ ...data, courseHoleId }))
          .where(eq(holeScores.id, existing.id));
      } else {
        await db.insert(holeScores).values({
          roundNineId,
          courseHoleId,
          holeNumber,
          ...data,
        });
      }

      const totalScore = await db
        .select({ strokes: holeScores.strokes })
        .from(holeScores)
        .innerJoin(roundNines, eq(holeScores.roundNineId, roundNines.id))
        .where(and(eq(roundNines.roundId, roundId), isNull(holeScores.deletedAt), isNull(roundNines.deletedAt)))
        .then((rows) => rows.reduce((sum, r) => sum + (r.strokes ?? 0), 0));

      await db.update(rounds).set(withTimestamp({ totalScore })).where(eq(rounds.id, roundId));
      await load();
    },
    [load, roundId]
  );

  const completeRound = useCallback(async () => {
    if (!roundId) return;
    await db.update(rounds).set(withTimestamp({ isComplete: true })).where(eq(rounds.id, roundId));
    await load();
  }, [load, roundId]);

  const abandonRound = useCallback(async () => {
    if (!roundId) return;
    await db
      .update(rounds)
      .set(withTimestamp({ abandonedAt: new Date().toISOString() }))
      .where(eq(rounds.id, roundId));
    await load();
  }, [load, roundId]);

  const deleteRound = useCallback(async () => {
    if (!roundId) return;

    // Soft-delete leaf → parents.
    const rns = await db
      .select({ id: roundNines.id })
      .from(roundNines)
      .where(and(eq(roundNines.roundId, roundId), isNull(roundNines.deletedAt)));

    const now = softDelete();
    for (const rn of rns) {
      await db
        .update(holeScores)
        .set(now)
        .where(and(eq(holeScores.roundNineId, rn.id), isNull(holeScores.deletedAt)));
    }

    await db.update(roundNines).set(now).where(and(eq(roundNines.roundId, roundId), isNull(roundNines.deletedAt)));
    await db.update(rounds).set(now).where(eq(rounds.id, roundId));
  }, [roundId]);

  return useMemo(
    () => ({
      round: bundle.round,
      roundNines: bundle.roundNines,
      yardageByCourseHoleId: bundle.yardageByCourseHoleId,
      totalScore: bundle.totalScore,
      loading,
      error,
      refresh,
      saveHole,
      completeRound,
      abandonRound,
      deleteRound,
    }),
    [bundle, loading, error, refresh, saveHole, completeRound, abandonRound, deleteRound]
  );
}

