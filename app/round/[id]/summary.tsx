import { useEffect, useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/Themed';
import { RoundSummary } from '@/components/RoundSummary';
import { HandicapEngine } from '@/utils/handicap';
import { useRound } from '@/hooks/useRound';

export default function RoundSummaryScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const roundId = params.id ?? null;

  const { round, roundNines, totalScore, loading, error, completeRound, deleteRound, refresh } = useRound(roundId);

  const computed = useMemo(() => {
    if (!round || roundNines.length === 0) return null;

    const rows: Array<{ globalHole: number; par: number; strokes: number | null }> = [];

    for (const rn of roundNines) {
      const offset = rn.nineOrder === 2 ? 9 : 0;
      for (const ch of rn.courseHoles) {
        const existing = rn.holes.find((h) => h.holeNumber === ch.holeNumber) ?? null;
        rows.push({
          globalHole: offset + ch.holeNumber,
          par: ch.par,
          strokes: existing?.strokes ?? null,
        });
      }
    }

    rows.sort((a, b) => a.globalHole - b.globalHole);

    const totalPar = rows.reduce((s, r) => s + r.par, 0);
    const putts = roundNines.flatMap((rn) => rn.holes.map((h) => h.putts));
    const avgPutts = putts.length ? putts.reduce((s, p) => s + p, 0) / putts.length : null;

    const girs: number[] = roundNines.flatMap((rn) => rn.holes.map((h) => (h.gir ? 1 : 0)));
    const girPct = girs.length ? (girs.reduce((s, v) => s + v, 0) / girs.length) * 100 : null;

    const fairways: number[] = roundNines.flatMap((rn) => rn.holes.map((h) => (h.fairwayHit ? 1 : 0)));
    const fairwayPct = fairways.length ? (fairways.reduce((s, v) => s + v, 0) / fairways.length) * 100 : null;

    return { rows, totalPar, avgPutts, girPct, fairwayPct };
  }, [round, roundNines]);

  useEffect(() => {
    if (!roundId || !round) return;
    if (!round.isComplete) return;
    if (round.handicapDifferential != null) return;

    // Per PLAN: differential computed on first load of summary for a complete 18-hole round
    HandicapEngine.saveDifferential(roundId)
      .then(refresh)
      .catch(() => {
        // swallow; UI can still render without differential
      });
  }, [roundId, round, refresh]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (error || !round || !computed) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Error: {error ?? 'Round not found'}</Text>
      </View>
    );
  }

  const isNineHole = roundNines.length < 2;
  const maxHoles = isNineHole ? 9 : 18;
  const holesPlayed = computed.rows.filter((r) => r.strokes != null).length;
  const canComplete = holesPlayed === maxHoles;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Round Summary</Text>
      <Text style={styles.subtitle}>{round.date}</Text>

      {!round.isComplete ? (
        <Pressable
          onPress={() => completeRound()}
          disabled={!canComplete}
          style={[styles.primaryButton, !canComplete && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {canComplete ? 'Mark round complete' : `Complete all ${maxHoles} holes to finish`}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => {
          Alert.alert('Delete round?', 'This will remove the round from the app (soft delete).', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deleteRound();
                router.replace('/(tabs)/rounds');
              },
            },
          ]);
        }}
        style={styles.dangerButton}
      >
        <Text style={styles.dangerButtonText}>Delete round</Text>
      </Pressable>

      <RoundSummary
        totalScore={totalScore}
        totalPar={computed.totalPar}
        avgPutts={computed.avgPutts}
        girPct={computed.girPct}
        fairwayPct={computed.fairwayPct}
        differential={round.handicapDifferential ?? null}
        scoreRows={computed.rows}
        onEditHole={(h) => router.replace(`/round/${round.id}/hole/${h}`)}
      />
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
  subtitle: {
    opacity: 0.8,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2f80ed',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  dangerButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c62828',
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#c62828',
    fontSize: 16,
    fontWeight: '800',
  },
  error: {
    color: '#c62828',
  },
});

