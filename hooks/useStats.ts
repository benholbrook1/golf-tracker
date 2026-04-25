import { useCallback, useEffect, useMemo, useState } from 'react';

import { db } from '@/db/client';
import { courseHoles, holeScores, roundNines, rounds } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

type HoleRow = {
  roundId: string;
  roundDate: string;
  nineOrder: number;
  holeNumberWithinNine: number;
  strokes: number;
  putts: number;
  fairwayHit: boolean;
  gir: boolean;
  par: number;
};

export type StatsSnapshot = {
  roundsAnalyzed: number;
  holesAnalyzed: number;
  avgPuttsPerHole: number | null;
  girPct: number | null;
  fairwayPct: number | null;
  scoreTrend: Array<{ roundId: string; date: string; totalScore: number }>;
  puttsTrend: Array<{ roundId: string; date: string; avgPutts: number }>;
  avgPuttsByHole: Array<{ hole: number; avgPutts: number }>;
};

export function useStats(): {
  stats: StatsSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const compute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await db
        .select({
          roundId: rounds.id,
          roundDate: rounds.date,
          nineOrder: roundNines.nineOrder,
          holeNumberWithinNine: holeScores.holeNumber,
          strokes: holeScores.strokes,
          putts: holeScores.putts,
          fairwayHit: holeScores.fairwayHit,
          gir: holeScores.gir,
          par: courseHoles.par,
        })
        .from(holeScores)
        .innerJoin(roundNines, eq(holeScores.roundNineId, roundNines.id))
        .innerJoin(rounds, eq(roundNines.roundId, rounds.id))
        .innerJoin(courseHoles, eq(holeScores.courseHoleId, courseHoles.id))
        .where(
          and(
            isNull(holeScores.deletedAt),
            isNull(roundNines.deletedAt),
            isNull(rounds.deletedAt),
            isNull(courseHoles.deletedAt),
            eq(rounds.isComplete, true)
          )
        )
        .orderBy(desc(rounds.date));

      const holeRows: HoleRow[] = rows.map((r) => ({
        roundId: r.roundId,
        roundDate: r.roundDate,
        nineOrder: r.nineOrder,
        holeNumberWithinNine: r.holeNumberWithinNine,
        strokes: r.strokes,
        putts: r.putts,
        fairwayHit: r.fairwayHit,
        gir: r.gir,
        par: r.par,
      }));

      const roundsSeen: string[] = [];
      const seen = new Set<string>();
      for (const h of holeRows) {
        if (seen.has(h.roundId)) continue;
        seen.add(h.roundId);
        roundsSeen.push(h.roundId);
        if (roundsSeen.length >= 10) break;
      }

      const trendRoundSet = new Set(roundsSeen);
      const trendRows = holeRows.filter((h) => trendRoundSet.has(h.roundId));

      const roundsAnalyzed = seen.size;
      const holesAnalyzed = holeRows.length;

      const avgPuttsPerHole =
        holesAnalyzed > 0 ? holeRows.reduce((s, h) => s + h.putts, 0) / holesAnalyzed : null;

      const girHits = holeRows.reduce((s, h) => s + (h.gir ? 1 : 0), 0);
      const girPct = holesAnalyzed > 0 ? (girHits / holesAnalyzed) * 100 : null;

      const fairwayEligible = holeRows.filter((h) => h.par !== 3);
      const fairwayHits = fairwayEligible.reduce((s, h) => s + (h.fairwayHit ? 1 : 0), 0);
      const fairwayPct =
        fairwayEligible.length > 0 ? (fairwayHits / fairwayEligible.length) * 100 : null;

      const totalsByRound = new Map<string, { date: string; strokes: number; putts: number; holes: number }>();
      for (const h of holeRows) {
        const cur = totalsByRound.get(h.roundId) ?? { date: h.roundDate, strokes: 0, putts: 0, holes: 0 };
        cur.strokes += h.strokes;
        cur.putts += h.putts;
        cur.holes += 1;
        totalsByRound.set(h.roundId, cur);
      }

      const scoreTrend = roundsSeen
        .map((id) => {
          const t = totalsByRound.get(id);
          if (!t) return null;
          return { roundId: id, date: t.date, totalScore: t.strokes };
        })
        .filter(Boolean) as Array<{ roundId: string; date: string; totalScore: number }>;

      // chronological left→right for simple charts
      scoreTrend.sort((a, b) => a.date.localeCompare(b.date));

      const puttsTrend = roundsSeen
        .map((id) => {
          const t = totalsByRound.get(id);
          if (!t || t.holes === 0) return null;
          return { roundId: id, date: t.date, avgPutts: t.putts / t.holes };
        })
        .filter(Boolean) as Array<{ roundId: string; date: string; avgPutts: number }>;

      puttsTrend.sort((a, b) => a.date.localeCompare(b.date));

      const byGlobalHole = new Map<number, { sum: number; n: number }>();
      for (const h of trendRows) {
        const globalHole = (h.nineOrder - 1) * 9 + h.holeNumberWithinNine;
        const cur = byGlobalHole.get(globalHole) ?? { sum: 0, n: 0 };
        cur.sum += h.putts;
        cur.n += 1;
        byGlobalHole.set(globalHole, cur);
      }

      const avgPuttsByHole = Array.from(byGlobalHole.entries())
        .map(([hole, v]) => ({ hole, avgPutts: v.sum / v.n }))
        .sort((a, b) => a.hole - b.hole);

      setStats({
        roundsAnalyzed,
        holesAnalyzed,
        avgPuttsPerHole,
        girPct,
        fairwayPct,
        scoreTrend,
        puttsTrend,
        avgPuttsByHole,
      });
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStats(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void compute();
  }, [compute]);

  const refresh = useCallback(async () => {
    await compute();
  }, [compute]);

  return useMemo(() => ({ stats, loading, error, refresh }), [stats, loading, error, refresh]);
}
