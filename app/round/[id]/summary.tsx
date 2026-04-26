import { useEffect, useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text } from '@/components/Themed';
import { RoundSummary } from '@/components/RoundSummary';
import { HandicapEngine } from '@/utils/handicap';
import { useRound } from '@/hooks/useRound';
import { colors, radius, space, typography } from '@/theme/tokens';

function formatDate(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RoundSummaryScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <RoundSummaryInner />
    </>
  );
}

function RoundSummaryInner() {
  const params = useLocalSearchParams<{ id?: string }>();
  const roundId = params.id ?? null;

  const { round, roundNines, totalScore, loading, error, completeRound, abandonRound, deleteRound, refresh } =
    useRound(roundId);

  const computed = useMemo(() => {
    if (!round || roundNines.length === 0) return null;

    const rows: Array<{ globalHole: number; par: number; strokes: number | null }> = [];
    for (const rn of roundNines) {
      const offset = (rn.nineOrder - 1) * 9;
      for (const ch of rn.courseHoles) {
        const existing = rn.holes.find((h) => h.holeNumber === ch.holeNumber) ?? null;
        rows.push({ globalHole: offset + ch.holeNumber, par: ch.par, strokes: existing?.strokes ?? null });
      }
    }
    rows.sort((a, b) => a.globalHole - b.globalHole);

    const totalPar = rows.reduce((s, r) => s + r.par, 0);
    const putts = roundNines.flatMap((rn) => rn.holes.map((h) => h.putts));
    const avgPutts = putts.length ? putts.reduce((s, p) => s + p, 0) / putts.length : null;
    const girs = roundNines.flatMap((rn) => rn.holes.map((h) => (h.gir ? 1 : 0)));
    const girPct = girs.length ? (girs.reduce((s, v) => s + v, 0) / girs.length) * 100 : null;
    const fairways = roundNines.flatMap((rn) => rn.holes.map((h) => (h.fairwayHit ? 1 : 0)));
    const fairwayPct = fairways.length ? (fairways.reduce((s, v) => s + v, 0) / fairways.length) * 100 : null;
    const penalties = roundNines.flatMap((rn) => rn.holes.map((h) => h.penalties ?? 0));
    const totalPenalties = penalties.reduce((s, p) => s + p, 0);

    return { rows, totalPar, avgPutts, girPct, fairwayPct, totalPenalties };
  }, [round, roundNines]);

  useEffect(() => {
    if (!roundId || !round) return;
    if (!round.isComplete) return;
    if (round.handicapDifferential != null) return;
    HandicapEngine.saveDifferential(roundId).then(refresh).catch(() => {});
  }, [roundId, round, refresh]);

  const isAbandoned = round?.abandonedAt != null;
  const isNineHole = roundNines.length < 2;
  const maxHoles = isNineHole ? 9 : 18;
  const holesPlayed = computed?.rows.filter((r) => r.strokes != null).length ?? 0;
  const canComplete = holesPlayed === maxHoles;

  const statusLabel = isAbandoned ? 'Abandoned' : round?.isComplete ? 'Complete' : 'In progress';
  const statusColor = isAbandoned ? colors.error : round?.isComplete ? colors.success : colors.warning;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Fixed header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <FontAwesome name="chevron-left" size={16} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <RNText style={styles.headerTitle}>Round Summary</RNText>
          {round ? (
            <RNText style={styles.headerSub}>
              {formatDate(round.date)}
              <RNText style={[styles.headerSub, { color: statusColor }]}> · {statusLabel}</RNText>
            </RNText>
          ) : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
      ) : error || !round || !computed ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Error: {error ?? 'Round not found'}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Complete CTA */}
          {!round.isComplete && !isAbandoned ? (
            <Pressable
              onPress={() => completeRound()}
              disabled={!canComplete}
              style={[styles.primaryBtn, !canComplete && styles.primaryBtnDisabled]}
            >
              <RNText style={styles.primaryBtnText}>
                {canComplete ? 'Mark round complete' : `Score all ${maxHoles} holes first`}
              </RNText>
            </Pressable>
          ) : null}

          {/* Summary stats + scorecard + edit grid */}
          <RoundSummary
            totalScore={totalScore}
            totalPar={computed.totalPar}
            avgPutts={computed.avgPutts}
            girPct={computed.girPct}
            fairwayPct={computed.fairwayPct}
            totalPenalties={computed.totalPenalties}
            differential={round.handicapDifferential ?? null}
            scoreRows={computed.rows}
            onEditHole={(h) => router.replace(`/round/${round.id}/play?hole=${h}`)}
          />

          {/* Action buttons */}
          <View style={styles.actions}>

            {!round.isComplete && !isAbandoned ? (
              <Pressable
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.btnPressed]}
                onPress={() => {
                  Alert.alert(
                    'Abandon round?',
                    'This keeps the round for reference, but removes it from Resume.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Abandon', style: 'destructive', onPress: () => abandonRound() },
                    ],
                  );
                }}
              >
                <RNText style={styles.ghostBtnText}>Abandon round</RNText>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.dangerBtn, pressed && styles.btnPressed]}
              onPress={() => {
                Alert.alert('Delete round?', 'This permanently removes the round from your history.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteRound();
                      router.replace('/rounds');
                    },
                  },
                ]);
              }}
            >
              <RNText style={styles.dangerBtnText}>Delete round</RNText>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: colors.surfaceBright,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    gap: space[3],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text, lineHeight: 22 },
  headerSub: { fontSize: 13, fontWeight: '400', color: colors.textMuted, lineHeight: 18 },
  headerSpacer: { width: 36 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] },
  mutedText: { ...typography.bodyM, color: colors.textMuted },
  errorText: { ...typography.bodyM, color: colors.error },

  scroll: { flex: 1 },
  content: { padding: space[4], gap: space[5], paddingBottom: space[12] },

  primaryBtn: {
    paddingVertical: 15,
    paddingHorizontal: space[4],
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', lineHeight: 24, color: colors.onPrimary },

  actions: { gap: space[3] },

  ghostBtn: {
    paddingVertical: 13,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { fontSize: 15, fontWeight: '500', lineHeight: 22, color: colors.textMuted },

  dangerBtn: {
    paddingVertical: 13,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { fontSize: 15, fontWeight: '600', lineHeight: 22, color: colors.error },

  btnPressed: { opacity: 0.7 },
});
