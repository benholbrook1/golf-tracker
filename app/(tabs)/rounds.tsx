import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { getResumeTarget } from '@/utils/resumeRound';
import { db } from '@/db/client';
import { courseCombos, courseNines, courseTees, courses, roundNines, rounds } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { colors, radius, space, typography } from '@/theme/tokens';

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

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const roundDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - roundDay.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diff > 300 ? 'numeric' : undefined });
}

function roundSubtitle(r: RoundRow): string {
  const layout = r.comboName ?? (r.nineNames[0] ?? null);
  const parts: string[] = [];
  if (layout) parts.push(layout);
  if (r.teeName) parts.push(r.teeName);
  return parts.join(' · ');
}

export default function RoundsTab() {
  const insets = useSafeAreaInsets();
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
        const byRound = await db
          .select({ roundId: roundNines.roundId, nineOrder: roundNines.nineOrder, nineName: courseNines.name })
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

    return () => { cancelled = true; };
  }, []);

  useFocusEffect(load);

  const onResume = async (roundId: string) => {
    if (resuming) return;
    setResuming(roundId);
    try {
      const t = await getResumeTarget(roundId);
      if (t.type === 'hole') {
        router.push(`/round/${roundId}/play?hole=${t.globalHole}`);
      } else {
        router.push(`/round/${roundId}/play?tab=summary`);
      }
    } finally {
      setResuming(null);
    }
  };

  const inProgress = rows.filter((r) => !r.isComplete && !r.abandonedAt);
  const history = rows.filter((r) => r.isComplete || r.abandonedAt);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + space[4] }]}>
        <Text style={styles.title}>Rounds</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[8] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* New round CTA */}
        <Pressable
          style={({ pressed }) => [styles.newRoundBtn, pressed && styles.newRoundBtnPressed]}
          onPress={() => router.push('/round/new')}
        >
          <FontAwesome name="plus" size={16} color={colors.onPrimary} style={{ marginRight: space[2] }} />
          <RNText style={styles.newRoundBtnText}>Start new round</RNText>
        </Pressable>

        {loading ? <Text style={styles.muted}>Loading…</Text> : null}
        {error ? <Text style={styles.errorText}>Error: {error}</Text> : null}

        {/* In-progress rounds */}
        {inProgress.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>In progress</Text>
            <View style={styles.list}>
              {inProgress.map((r) => (
                <View key={r.id} style={[styles.card, styles.cardActive]}>
                  <View style={styles.cardMain}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.courseName} numberOfLines={1}>{r.courseName}</Text>
                      <Text style={styles.cardMeta}>{formatDate(r.date)}{roundSubtitle(r) ? ` · ${roundSubtitle(r)}` : ''}</Text>
                    </View>
                    <View style={styles.statusChip}>
                      <View style={[styles.statusDot, styles.statusDotActive]} />
                      <Text style={styles.statusTextActive}>In progress</Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable style={styles.viewBtn} onPress={() => router.push(`/round/${r.id}/summary`)}>
                      <Text style={styles.viewBtnText}>View</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onResume(r.id)}
                      disabled={resuming === r.id}
                      style={[styles.resumeBtn, resuming === r.id && styles.btnDisabled]}
                    >
                      <Text style={styles.resumeBtnText}>{resuming === r.id ? 'Loading…' : 'Resume →'}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* History */}
        {history.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>History</Text>
            <View style={styles.list}>
              {history.map((r) => {
                const abandoned = !!r.abandonedAt;
                return (
                  <Pressable key={r.id} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => router.push(`/round/${r.id}/summary`)}>
                      <View style={styles.cardMain}>
                        <View style={styles.cardLeft}>
                          <Text style={styles.courseName} numberOfLines={1}>{r.courseName}</Text>
                          <Text style={styles.cardMeta}>
                            {formatDate(r.date)}{roundSubtitle(r) ? ` · ${roundSubtitle(r)}` : ''}
                          </Text>
                        </View>
                        <View style={styles.cardRight}>
                          {!abandoned && r.totalScore > 0 ? (
                            <Text style={styles.scoreNum}>{r.totalScore}</Text>
                          ) : null}
                          <View style={[styles.statusChip, abandoned && styles.statusChipAbandoned]}>
                            <Text style={[styles.statusText, abandoned && styles.statusTextAbandoned]}>
                              {abandoned ? 'Abandoned' : 'Complete'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {!loading && rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No rounds yet</Text>
            <Text style={styles.emptyBody}>Start your first round using the button above.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },

  header: {
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    backgroundColor: colors.surface,
  },
  title: { ...typography.headingXl, color: colors.text },

  content: { padding: space[4], gap: space[5] },

  newRoundBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newRoundBtnPressed: { opacity: 0.85 },
  newRoundBtnText: { fontSize: 16, fontWeight: '700', lineHeight: 22, color: colors.onPrimary },

  section: { gap: space[3] },
  sectionLabel: { ...typography.labelM, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  list: { gap: space[3] },

  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[4],
    gap: space[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  cardPressed: { borderColor: colors.outline },

  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  cardLeft: { flex: 1, gap: 4 },
  cardRight: { alignItems: 'flex-end', gap: space[2] },

  courseName: { ...typography.headingM, color: colors.text },
  cardMeta: { ...typography.bodyS, color: colors.textMuted },

  scoreNum: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },

  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space[2],
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
  },
  statusChipAbandoned: {
    backgroundColor: colors.surfaceContainer,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  statusDotActive: { backgroundColor: colors.primary },
  statusText: { ...typography.labelS, color: colors.onPrimaryContainer },
  statusTextActive: { ...typography.labelS, color: colors.onPrimaryContainer, fontWeight: '600' },
  statusTextAbandoned: { color: colors.textMuted },

  cardActions: { flexDirection: 'row', gap: space[2] },

  viewBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: { ...typography.labelM, color: colors.text },

  resumeBtn: {
    flex: 2,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtnText: { ...typography.labelM, color: colors.onPrimary, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  emptyCard: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[6],
    alignItems: 'center',
    gap: space[2],
  },
  emptyTitle: { ...typography.headingM, color: colors.text },
  emptyBody: { ...typography.bodyS, color: colors.textMuted, textAlign: 'center' },

  muted: { ...typography.bodyS, color: colors.textMuted },
  errorText: { ...typography.bodyS, color: colors.error },
});
