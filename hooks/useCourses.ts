import { useCallback, useEffect, useState } from 'react';

import { db } from '@/db/client';
import {
  courseCombos,
  courseHoleTeeYardages,
  courseHoles,
  courseNines,
  courseTees,
  courses,
  rounds,
} from '@/db/schema';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';

type Loadable<T> = {
  loading: boolean;
  error: string | null;
  data: T;
};

export type CourseListRow = typeof courses.$inferSelect & { roundCount: number };

export function useCourses(): {
  courses: CourseListRow[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [state, setState] = useState<Loadable<CourseListRow[]>>({
    loading: true,
    error: null,
    data: [],
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    Promise.all([
      db.select().from(courses).where(isNull(courses.deletedAt)),
      db
        .select({ courseId: rounds.courseId, n: count() })
        .from(rounds)
        .where(isNull(rounds.deletedAt))
        .groupBy(rounds.courseId),
    ])
      .then(([courseRows, countRows]) => {
        if (cancelled) return;
        const cnt = new Map<string, number>();
        for (const r of countRows) {
          cnt.set(r.courseId, r.n);
        }
        const withCounts = courseRows.map((c) => ({
          ...c,
          roundCount: Number(cnt.get(c.id) ?? 0),
        }));
        const sorted = [...withCounts].sort((a, b) => {
          if (b.roundCount !== a.roundCount) return b.roundCount - a.roundCount;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        setState({ data: sorted, loading: false, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ data: [], loading: false, error: e instanceof Error ? e.message : String(e) });
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { courses: state.data, loading: state.loading, error: state.error, refresh };
}

export type CourseDetail = {
  course: typeof courses.$inferSelect;
  tees: typeof courseTees.$inferSelect[];
  /** courseHoleId → courseTeeId → yards */
  yardageByHoleTee: Map<string, Map<string, number | null>>;
  nines: Array<typeof courseNines.$inferSelect & { holes: typeof courseHoles.$inferSelect[] }>;
  combos: typeof courseCombos.$inferSelect[];
};

export function useCourseDetail(
  courseId: string | null | undefined
): Loadable<CourseDetail | null> & { refresh: () => void } {
  const [state, setState] = useState<Loadable<CourseDetail | null>>({
    data: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!courseId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const course = await db.query.courses.findFirst({
          where: and(eq(courses.id, courseId), isNull(courses.deletedAt)),
        });
        if (cancelled) return;
        if (!course) {
          setState({ data: null, loading: false, error: 'Course not found' });
          return;
        }

        const ninesList = await db
          .select()
          .from(courseNines)
          .where(and(isNull(courseNines.deletedAt), eq(courseNines.courseId, courseId)))
          .orderBy(asc(courseNines.name));
        if (cancelled) return;

        const nineIds = ninesList.map((n) => n.id);
        const allHoles =
          nineIds.length > 0
            ? await db
                .select()
                .from(courseHoles)
                .where(and(isNull(courseHoles.deletedAt), inArray(courseHoles.nineId, nineIds)))
            : [];
        if (cancelled) return;

        const [combos, teeRows] = await Promise.all([
          db
            .select()
            .from(courseCombos)
            .where(and(isNull(courseCombos.deletedAt), eq(courseCombos.courseId, courseId)))
            .orderBy(asc(courseCombos.name)),
          db
            .select()
            .from(courseTees)
            .where(and(isNull(courseTees.deletedAt), eq(courseTees.courseId, courseId)))
            .orderBy(asc(courseTees.sortOrder), asc(courseTees.name)),
        ]);
        if (cancelled) return;

        const holeIds = allHoles.map((h) => h.id);
        const allYardages =
          holeIds.length > 0
            ? await db
                .select()
                .from(courseHoleTeeYardages)
                .where(
                  and(
                    isNull(courseHoleTeeYardages.deletedAt),
                    inArray(courseHoleTeeYardages.courseHoleId, holeIds)
                  )
                )
            : [];
        if (cancelled) return;

        const holesByNine = new Map<string, typeof allHoles>();
        for (const h of allHoles) {
          if (!holesByNine.has(h.nineId)) holesByNine.set(h.nineId, []);
          holesByNine.get(h.nineId)!.push(h);
        }
        const nines = ninesList.map((n) => ({
          ...n,
          holes: (holesByNine.get(n.id) ?? []).sort((a, b) => a.holeNumber - b.holeNumber),
        }));
        const tees = [...teeRows].sort((a, b) => a.sortOrder - b.sortOrder);

        const yardageByHoleTee = new Map<string, Map<string, number | null>>();
        for (const y of allYardages) {
          if (!yardageByHoleTee.has(y.courseHoleId)) {
            yardageByHoleTee.set(y.courseHoleId, new Map());
          }
          yardageByHoleTee.get(y.courseHoleId)!.set(y.courseTeeId, y.yards);
        }

        setState({
          data: { course, nines, combos, tees, yardageByHoleTee },
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({ data: null, loading: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, tick]);

  return { ...state, refresh };
}

