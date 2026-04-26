import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { courses, holeScores, roundNines, rounds } from '@/db/schema';
import { HandicapEngine } from '@/utils/handicap';
import { colors, radius, space, typography } from '@/theme/tokens';

type LastRound = {
  id: string;
  date: string;
  totalScore: number;
  isComplete: boolean;
  abandonedAt: string | null;
  courseName: string;
  putts: number | null;
  girPct: number | null;
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[(m ?? 1) - 1]} ${d}, ${y}`;
}

export default function HomeTab() {
  const insets = useSafeAreaInsets();
  const [handicap, setHandicap] = useState<number | null>(null);
  const [handicapLoading, setHandicapLoading] = useState(true);
  const [lastRound, setLastRound] = useState<LastRound | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
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
      setHandicapLoading(false);

      if (lr) {
        const scores = await db
          .select({ putts: holeScores.putts, gir: holeScores.gir })
          .from(holeScores)
          .innerJoin(roundNines, eq(holeScores.roundNineId, roundNines.id))
          .where(and(eq(roundNines.roundId, lr.id), isNull(holeScores.deletedAt), isNull(roundNines.deletedAt)));
        const putts = scores.length ? scores.reduce((s, r) => s + r.putts, 0) : null;
        const girs = scores.reduce((s, r) => s + (r.gir ? 1 : 0), 0);
        const girPct = scores.length ? (girs / scores.length) * 100 : null;
        setLastRound({ ...lr, putts, girPct });
      } else {
        setLastRound(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  const roundStatus = lastRound
    ? lastRound.abandonedAt
      ? 'abandoned'
      : lastRound.isComplete
        ? 'complete'
        : 'in-progress'
    : null;

  const handicapText = handicapLoading
    ? '—'
    : handicap == null
      ? 'No index yet'
      : handicap.toFixed(1);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <RNText style={styles.appName}>GolfLog</RNText>
        <View style={styles.hcpBadge}>
          <RNText style={styles.hcpLabel}>HCP</RNText>
          <RNText style={styles.hcpValue}>{handicapText}</RNText>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[8] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary CTA */}
        <Pressable style={styles.startBtn} onPress={() => router.push('/round/new')}>
          <RNText style={styles.startBtnText}>Start new round</RNText>
        </Pressable>

        {/* Last round */}
        {!loading ? (
          lastRound ? (
            <View style={styles.card}>
              {/* Status pill */}
              <View style={styles.cardHeader}>
                <RNText style={styles.cardLabel}>Last round</RNText>
                <View style={[
                  styles.statusPill,
                  roundStatus === 'in-progress' && styles.statusPillActive,
                  roundStatus === 'abandoned' && styles.statusPillAbandoned,
                ]}>
                  <RNText style={[
                    styles.statusPillText,
                    roundStatus === 'in-progress' && styles.statusPillTextActive,
                    roundStatus === 'abandoned' && styles.statusPillTextAbandoned,
                  ]}>
                    {roundStatus === 'in-progress' ? 'In progress' : roundStatus === 'abandoned' ? 'Abandoned' : 'Complete'}
                  </RNText>
                </View>
              </View>

              {/* Course + date */}
              <View style={styles.courseRow}>
                <RNText style={styles.courseName}>{lastRound.courseName}</RNText>
                <RNText style={styles.courseDate}>{formatDate(lastRound.date)}</RNText>
              </View>

              {/* Stat row */}
              <View style={styles.statRow}>
                <View style={styles.statCell}>
                  <RNText style={styles.statLabel}>Score</RNText>
                  <RNText style={styles.statValue}>{lastRound.totalScore || '—'}</RNText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <RNText style={styles.statLabel}>Putts</RNText>
                  <RNText style={styles.statValue}>{lastRound.putts ?? '—'}</RNText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <RNText style={styles.statLabel}>GIR</RNText>
                  <RNText style={styles.statValue}>
                    {lastRound.girPct == null ? '—' : `${Math.round(lastRound.girPct)}%`}
                  </RNText>
                </View>
              </View>

              {/* Action button */}
              <Pressable
                style={[styles.roundBtn, roundStatus === 'in-progress' && styles.roundBtnPrimary]}
                onPress={() => router.push(`/round/${lastRound.id}/play?tab=${roundStatus === 'in-progress' ? 'score' : 'summary'}`)}
              >
                <RNText style={[styles.roundBtnText, roundStatus === 'in-progress' && styles.roundBtnTextPrimary]}>
                  {roundStatus === 'in-progress' ? 'Resume round' : 'View round'}
                </RNText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <RNText style={styles.emptyText}>No rounds yet. Start one to begin tracking your game.</RNText>
            </View>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },

  header: {
    backgroundColor: colors.surfaceBright,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: { fontSize: 22, fontWeight: '700', lineHeight: 28, color: colors.primary, letterSpacing: 0.3 },

  hcpBadge: {
    alignItems: 'flex-end',
    gap: 1,
  },
  hcpLabel: { fontSize: 11, fontWeight: '500', lineHeight: 15, color: colors.textDisabled, textTransform: 'uppercase', letterSpacing: 0.5 },
  hcpValue: { fontSize: 20, fontWeight: '700', lineHeight: 25, color: colors.text, fontVariant: ['tabular-nums'] },

  scroll: { flex: 1 },
  content: { padding: space[4], gap: space[4] },

  startBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: { fontSize: 16, fontWeight: '600', lineHeight: 22, color: colors.onPrimary },

  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[4],
    gap: space[3],
  },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontSize: 12, fontWeight: '500', lineHeight: 16, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },

  statusPill: {
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  statusPillActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  statusPillAbandoned: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  statusPillText: { fontSize: 11, fontWeight: '600', lineHeight: 15, color: colors.textMuted },
  statusPillTextActive: { color: colors.primary },
  statusPillTextAbandoned: { color: '#92400E' },

  courseRow: { gap: 2 },
  courseName: { fontSize: 18, fontWeight: '700', lineHeight: 24, color: colors.text },
  courseDate: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: colors.textMuted },

  statRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  statCell: { flex: 1, paddingVertical: space[3], paddingHorizontal: space[2], alignItems: 'center', gap: 3, backgroundColor: colors.surface },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  statLabel: { fontSize: 11, fontWeight: '500', lineHeight: 15, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 20, fontWeight: '700', lineHeight: 25, color: colors.text, fontVariant: ['tabular-nums'] },

  roundBtn: {
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
  },
  roundBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  roundBtnText: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: colors.text },
  roundBtnTextPrimary: { color: colors.onPrimary },

  emptyCard: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[5],
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, fontWeight: '400', lineHeight: 21, color: colors.textMuted, textAlign: 'center' },
});
