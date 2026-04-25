import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { Button, Card } from '@/components/ui';
import { colors, space, typography } from '@/theme/tokens';
import { HandicapEngine } from '@/utils/handicap';
import { db } from '@/db/client';
import { courses, holeScores, roundNines, rounds } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

export default function HomeTab() {
  const [handicap, setHandicap] = useState<number | null>(null);
  const [handicapLoading, setHandicapLoading] = useState(true);
  const [lastRound, setLastRound] = useState<{
    id: string;
    date: string;
    totalScore: number;
    isComplete: boolean;
    abandonedAt: string | null;
    courseId: string;
    courseName: string;
  } | null>(null);
  const [lastRoundStats, setLastRoundStats] = useState<{ putts: number | null; girPct: number | null } | null>(null);

  const load = useCallback(async () => {
    setHandicapLoading(true);
    try {
      const [hcp, lr] = await Promise.all([
        HandicapEngine.getHandicapIndex(),
        db
          .select({
            id: rounds.id,
            date: rounds.date,
            totalScore: rounds.totalScore,
            isComplete: rounds.isComplete,
            abandonedAt: rounds.abandonedAt,
            courseId: rounds.courseId,
            courseName: courses.name,
          })
          .from(rounds)
          .innerJoin(courses, eq(rounds.courseId, courses.id))
          .where(and(isNull(rounds.deletedAt), isNull(courses.deletedAt)))
          .orderBy(desc(rounds.date))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);
      setHandicap(hcp);
      setLastRound(lr);

      if (lr) {
        // Compute quick last-round stats (putts and GIR%).
        const scores = await db
          .select({ putts: holeScores.putts, gir: holeScores.gir })
          .from(holeScores)
          .innerJoin(roundNines, eq(holeScores.roundNineId, roundNines.id))
          .where(and(eq(roundNines.roundId, lr.id), isNull(holeScores.deletedAt), isNull(roundNines.deletedAt)));
        const puttsTotal = scores.reduce((s, r) => s + (r.putts ?? 0), 0);
        const girs = scores.reduce((s, r) => s + (r.gir ? 1 : 0), 0);
        const girPct = scores.length ? (girs / scores.length) * 100 : null;
        setLastRoundStats({ putts: scores.length ? puttsTotal : null, girPct });
      } else {
        setLastRoundStats(null);
      }
    } finally {
      setHandicapLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handicapLabel = useMemo(() => {
    if (handicapLoading) return '—';
    if (handicap == null) return '—';
    return handicap.toFixed(1);
  }, [handicap, handicapLoading]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>ParTracker</Text>
        </View>

        <View style={styles.welcomeBlock}>
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeSub}>
            {handicapLoading
              ? 'Calculating your handicap…'
              : handicap == null
                ? 'Finish a few rated 18-hole rounds to unlock a handicap estimate.'
                : `Handicap index: ${handicapLabel}`}
          </Text>
        </View>

        <Link href="/round/new" asChild>
          <View>
            <View style={styles.primaryCta}>
              <View style={styles.primaryCtaLeft}>
                <View style={styles.primaryIcon}>
                  <FontAwesome name="play" size={14} color={colors.onPrimary} />
                </View>
                <Text style={styles.primaryCtaText}>Start new round</Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color={colors.onPrimary} />
            </View>
          </View>
        </Link>

        <Card>
          <Text style={styles.sectionLabel}>Last round summary</Text>
          {lastRound ? (
            <>
              <View style={styles.lastRoundHero}>
                <View style={styles.lastRoundHeroOverlay} />
                <View style={styles.lastRoundHeroInner}>
                  <Text style={styles.lastRoundCourse}>{lastRound.courseName}</Text>
                  <Text style={styles.lastRoundDate}>{lastRound.date}</Text>
                </View>
              </View>

              <View style={styles.lastRoundGrid}>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>Score</Text>
                  <Text style={styles.metricValue}>{lastRound.totalScore}</Text>
                </View>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>Putts</Text>
                  <Text style={styles.metricValue}>{lastRoundStats?.putts == null ? '—' : lastRoundStats.putts}</Text>
                </View>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>GIR</Text>
                  <Text style={styles.metricValue}>
                    {lastRoundStats?.girPct == null ? '—' : `${Math.round(lastRoundStats.girPct)}%`}
                  </Text>
                </View>
              </View>

              <View style={styles.row}>
                <Link href={`/round/${lastRound.id}/play?tab=summary`} asChild>
                  <Button title="View" variant="secondary" />
                </Link>
                <Link href="/round/new" asChild>
                  <Button title="Start new round" variant="primary" />
                </Link>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.cardBody}>No rounds yet. Start one to begin tracking.</Text>
              <Link href="/round/new" asChild>
                <Button title="Start new round" variant="primary" />
              </Link>
            </>
          )}
        </Card>

        <View style={styles.keyPerfRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>Key performance</Text>
          </View>
          <Link href="/two" asChild>
            <Text style={styles.sectionLink}>View all stats</Text>
          </Link>
        </View>

        <View style={styles.kpiGrid}>
          <Card style={styles.kpiCard}>
            <View style={styles.kpiIconCircle}>
              <FontAwesome name="line-chart" size={16} color={colors.primary} />
            </View>
            <Text style={styles.kpiLabel}>Handicap index</Text>
            <Text style={styles.kpiValue}>{handicapLabel}</Text>
            <Text style={styles.kpiHint}>Updates as you complete rounds</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <View style={styles.kpiIconCircleSlate}>
              <FontAwesome name="flag" size={16} color={colors.secondary} />
            </View>
            <Text style={styles.kpiLabel}>Courses</Text>
            <Text style={styles.kpiValue}>Manage</Text>
            <Link href="/courses" asChild>
              <Text style={styles.kpiHintLink}>View courses</Text>
            </Link>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: space[4], gap: space[4], paddingBottom: 40 },

  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space[1] },
  brand: { ...typography.headingM, color: colors.primary, letterSpacing: 0.4 },
  welcomeBlock: { gap: space[1] },
  welcomeTitle: { ...typography.headingXl, color: colors.text },
  welcomeSub: { ...typography.bodyS, color: colors.textMuted },

  cardTitle: { ...typography.headingM, color: colors.text },
  cardBody: { ...typography.bodyS, color: colors.textMuted },

  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },

  primaryCta: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: { ...typography.labelM, color: colors.onPrimary, fontWeight: '600' },

  sectionLabel: { ...typography.labelS, color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionLink: { ...typography.labelS, color: colors.primary, fontWeight: '600' },

  lastRoundHero: { height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.primaryContainer },
  lastRoundHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.10)' },
  lastRoundHeroInner: { flex: 1, padding: 14, justifyContent: 'flex-end' },
  lastRoundCourse: { ...typography.headingM, color: colors.onPrimaryContainer },
  lastRoundDate: { ...typography.bodyS, color: colors.onPrimaryContainer, opacity: 0.8 },
  lastRoundGrid: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  metricCell: { flex: 1, padding: 12, gap: 4, backgroundColor: colors.surfaceBright },
  metricLabel: { ...typography.labelS, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  metricValue: { fontSize: 22, fontWeight: '700', color: colors.text },

  keyPerfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  kpiCard: { flex: 1, minWidth: 160 },
  kpiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconCircleSlate: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: { ...typography.labelS, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiValue: { fontSize: 28, fontWeight: '700', color: colors.text },
  kpiHint: { ...typography.bodyS, color: colors.textMuted },
  kpiHintLink: { ...typography.bodyS, color: colors.primary, fontWeight: '600' },

});
