import { useEffect, useState } from 'react';

import { db } from '@/db/client';
import { courseCombos, courseHoles, courseNines, courses } from '@/db/schema';
import { asc, eq, isNull } from 'drizzle-orm';

type Loadable<T> = {
  loading: boolean;
  error: string | null;
  data: T;
};

export function useCourses(): { courses: typeof courses.$inferSelect[]; loading: boolean; error: string | null } {
  const [state, setState] = useState<Loadable<typeof courses.$inferSelect[]>>({
    loading: true,
    error: null,
    data: [],
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    db.select()
      .from(courses)
      .where(isNull(courses.deletedAt))
      .orderBy(asc(courses.name))
      .then((rows) => {
        if (cancelled) return;
        setState({ data: rows, loading: false, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ data: [], loading: false, error: e instanceof Error ? e.message : String(e) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { courses: state.data, loading: state.loading, error: state.error };
}

export type CourseDetail = {
  course: typeof courses.$inferSelect;
  nines: Array<typeof courseNines.$inferSelect & { holes: typeof courseHoles.$inferSelect[] }>;
  combos: typeof courseCombos.$inferSelect[];
};

export function useCourseDetail(courseId: string | null | undefined): Loadable<CourseDetail | null> {
  const [state, setState] = useState<Loadable<CourseDetail | null>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!courseId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    Promise.all([
      db.query.courses.findFirst({
        where: eq(courses.id, courseId),
      }),
      db
        .select()
        .from(courseNines)
        .where(isNull(courseNines.deletedAt))
        .orderBy(asc(courseNines.name)),
      db
        .select()
        .from(courseHoles)
        .where(isNull(courseHoles.deletedAt)),
      db
        .select()
        .from(courseCombos)
        .where(isNull(courseCombos.deletedAt))
        .orderBy(asc(courseCombos.name)),
    ])
      .then(([course, allNines, allHoles, allCombos]) => {
        if (cancelled) return;
        if (!course || course.deletedAt) {
          setState({ data: null, loading: false, error: 'Course not found' });
          return;
        }

        const nines = allNines
          .filter((n) => n.courseId === courseId && !n.deletedAt)
          .map((n) => ({
            ...n,
            holes: allHoles
              .filter((h) => h.nineId === n.id && !h.deletedAt)
              .sort((a, b) => a.holeNumber - b.holeNumber),
          }));

        const combos = allCombos.filter((c) => c.courseId === courseId && !c.deletedAt);

        setState({ data: { course, nines, combos }, loading: false, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: e instanceof Error ? e.message : String(e) });
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return state;
}

