import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { Text } from '@/components/Themed';
import { getResumeTarget } from '@/utils/resumeRound';
import { db } from '@/db/client';
import { courseCombos, courseNines, courseTees, courses, roundNines, rounds } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

type RoundRow = {
  id: string;
  date: string;
  totalScore: number;
  isComplete: boolean;
  abandonedAt: string | null;
  courseName: string;
  teeName: string | null;
  comboName: string | null;
  nineNames: string[];
};

export default function RoundsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RoundRow[]>([]);
  const [resuming, setResuming] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    db.select({
      id: rounds.id,
      date: rounds.date,
      totalScore: rounds.totalScore,
      isComplete: rounds.isComplete,
      abandonedAt: rounds.abandonedAt,
      courseName: courses.name,
      teeName: courseTees.name,
      comboName: courseCombos.name,
    })
      .from(rounds)
      .innerJoin(courses, eq(rounds.courseId, courses.id))
      .leftJoin(courseTees, eq(rounds.teeId, courseTees.id))
      .leftJoin(courseCombos, eq(rounds.comboId, courseCombos.id))
      .where(and(isNull(rounds.deletedAt), isNull(courses.deletedAt)))
      .orderBy(desc(rounds.date))
      .then(async (r) => {
        if (cancelled) return;
        // Pull round_nines + course_nines names for labeling 9-hole rounds (or to show both sides for 18s).
        const byRound = await db
          .select({
            roundId: roundNines.roundId,
            nineOrder: roundNines.nineOrder,
            nineName: courseNines.name,
          })
          .from(roundNines)
          .innerJoin(courseNines, eq(roundNines.nineId, courseNines.id))
          .where(and(isNull(roundNines.deletedAt), isNull(courseNines.deletedAt)))
          .then((rows) =>
            rows.reduce<Record<string, Array<{ nineOrder: number; nineName: string }>>>((acc, row) => {
              (acc[row.roundId] ??= []).push({ nineOrder: row.nineOrder, nineName: row.nineName });
              return acc;
            }, {})
          );

        setRows(
          r.map((row) => ({
            ...row,
            nineNames: (byRound[row.id] ?? []).sort((a, b) => a.nineOrder - b.nineOrder).map((x) => x.nineName),
          }))
        );
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Reload whenever this tab gains focus (so new rounds show up immediately).
  useFocusEffect(load);

  const onResume = async (roundId: string) => {
    if (resuming) return;
    setResuming(roundId);
    try {
      const t = await getResumeTarget(roundId);
      if (t.type === 'hole') {
        router.push(`/round/${roundId}/hole/${t.globalHole}`);
      } else {
        router.push(`/round/${roundId}/summary`);
      }
    } finally {
      setResuming(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Rounds</Text>

      <Link href="/round/new" asChild>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>New round</Text>
        </Pressable>
      </Link>

      {loading ? <Text>Loading…</Text> : null}
      {error ? <Text style={styles.error}>Error: {error}</Text> : null}

      <View style={styles.list}>
        {rows.map((r) => (
          <View key={r.id} style={styles.itemRow}>
            <Link href={`/round/${r.id}/summary`} asChild>
              <Pressable style={styles.item}>
                <Text style={styles.itemTitle}>
                  {r.courseName} · {r.date}
                </Text>
                <Text style={styles.itemSub}>
                  {(r.comboName ? `18: ${r.comboName}` : r.nineNames.length ? `9: ${r.nineNames[0]}` : 'Round')}{r.teeName ? ` · ${r.teeName}` : ''}{' '}
                  · {r.abandonedAt ? 'Abandoned' : r.isComplete ? 'Complete' : 'In progress'} · Total: {r.totalScore}
                </Text>
              </Pressable>
            </Link>
            {!r.isComplete ? (
              <Pressable
                onPress={() => onResume(r.id)}
                disabled={resuming === r.id || r.abandonedAt != null}
                style={[styles.resume, resuming === r.id && styles.resumeDisabled]}
              >
                <Text style={styles.resumeText}>{resuming === r.id ? '…' : 'Resume'}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {!loading && rows.length === 0 ? <Text style={styles.emptyLine}>No rounds yet. Start one from the Home or New round screen.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2f80ed',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  list: {
    gap: 10,
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  item: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#999',
    gap: 4,
  },
  resume: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#2f80ed',
    minWidth: 84,
  },
  resumeDisabled: { opacity: 0.6 },
  resumeText: { color: 'white', fontWeight: '900', textAlign: 'center' },
  emptyLine: { fontSize: 15, fontWeight: '600', opacity: 0.85 },
  itemTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  itemSub: {
    opacity: 0.8,
    fontWeight: '600',
  },
  error: {
    color: '#c62828',
  },
});

