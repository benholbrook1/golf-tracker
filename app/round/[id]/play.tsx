import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { HoleEntry } from '@/components/HoleEntry';
import { RoundSummary } from '@/components/RoundSummary';
import { HandicapEngine } from '@/utils/handicap';
import { useRound } from '@/hooks/useRound';
import type { HoleScoreInput } from '@/utils/validators';

type Mode = 'score' | 'summary';

export default function RoundPlayScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'none' }} />
      <RoundPlayInner />
    </>
  );
}

function RoundPlayInner() {
  const params = useLocalSearchParams<{ id?: string; hole?: string; tab?: Mode }>();
  const roundId = params.id ?? null;
  const initialHole = params.hole ? Number(params.hole) : 1;
  const initialTab: Mode = params.tab === 'summary' ? 'summary' : 'score';

  const { round, roundNines, yardageByCourseHoleId, totalScore, loading, error, saveHole, completeRound, abandonRound, refresh } =
    useRound(roundId);

  const maxGlobal = roundNines.length * 9;
  const [mode, setMode] = useState<Mode>(initialTab);
  const [holeNumberGlobal, setHoleNumberGlobal] = useState<number>(
    Number.isFinite(initialHole) && initialHole >= 1 ? initialHole : 1
  );
  const holeStripRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!Number.isFinite(holeNumberGlobal) || holeNumberGlobal < 1) setHoleNumberGlobal(1);
    if (maxGlobal > 0 && holeNumberGlobal > maxGlobal) setHoleNumberGlobal(maxGlobal);
  }, [holeNumberGlobal, maxGlobal]);

  useEffect(() => {
    // Keep the active hole chip visible when using Prev/Next.
    // Based on chip width (40) + gap (8) from styles.
    if (!holeStripRef.current) return;
    if (maxGlobal <= 0) return;
    const unit = 48;
    const x = Math.max(0, (holeNumberGlobal - 1) * unit - unit * 2);
    holeStripRef.current.scrollTo({ x, y: 0, animated: true });
  }, [holeNumberGlobal, maxGlobal]);

  const resolved = useMemo(() => {
    if (!round || roundNines.length === 0) return null;
    if (!Number.isFinite(holeNumberGlobal) || holeNumberGlobal < 1) return null;
    if (holeNumberGlobal > maxGlobal) return null;

    const nineOrder = Math.ceil(holeNumberGlobal / 9);
    const holeNumberWithinNine = ((holeNumberGlobal - 1) % 9) + 1;
    const rn = roundNines.find((n) => n.nineOrder === nineOrder);
    if (!rn) return null;

    const courseHole = rn.courseHoles.find((h) => h.holeNumber === holeNumberWithinNine);
    if (!courseHole) return null;

    const existing = rn.holes.find((hs) => hs.holeNumber === holeNumberWithinNine) ?? null;

    return { rn, courseHole, existing, holeNumberWithinNine };
  }, [round, roundNines, holeNumberGlobal, maxGlobal]);

  const computedSummary = useMemo(() => {
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

    const girs = roundNines.flatMap((rn) => rn.holes.map((h) => (h.gir ? 1 : 0))) as number[];
    const girPct = girs.length ? (girs.reduce((s, v) => s + v, 0) / girs.length) * 100 : null;

    const fairways = roundNines.flatMap((rn) => rn.holes.map((h) => (h.fairwayHit ? 1 : 0))) as number[];
    const fairwayPct = fairways.length ? (fairways.reduce((s, v) => s + v, 0) / fairways.length) * 100 : null;

    const penalties = roundNines.flatMap((rn) => rn.holes.map((h) => h.penalties ?? 0));
    const totalPenalties = penalties.reduce((s, p) => s + p, 0);

    return { rows, totalPar, avgPutts, girPct, fairwayPct, totalPenalties };
  }, [round, roundNines]);

  useEffect(() => {
    if (!roundId || !round) return;
    if (!round.isComplete) return;
    if (round.handicapDifferential != null) return;
    HandicapEngine.saveDifferential(roundId)
      .then(refresh)
      .catch(() => {});
  }, [roundId, round, refresh]);

  const onSave = async (data: HoleScoreInput) => {
    if (!resolved) return;
    await saveHole(resolved.rn.id, resolved.courseHole.id, resolved.holeNumberWithinNine, data);
    if (holeNumberGlobal < maxGlobal) setHoleNumberGlobal((h) => h + 1);
    else setMode('summary');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <Text>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !round) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <Text style={styles.error}>Error: {error ?? 'Round not found'}</Text>
          <Pressable onPress={() => router.replace('/rounds')} style={styles.topBtn}>
            <Text style={styles.topBtnText}>Back to rounds</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isAbandoned = round.abandonedAt != null;
  const holesPlayed = computedSummary?.rows.filter((r) => r.strokes != null).length ?? 0;
  const maxHoles = maxGlobal;
  const canComplete = holesPlayed === maxHoles && maxHoles > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.frame}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace('/rounds')} style={styles.topBtn} hitSlop={10}>
            <Text style={styles.topBtnText}>Rounds</Text>
          </Pressable>

          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>{mode === 'score' ? `Hole ${holeNumberGlobal}` : 'Summary'}</Text>
            <Text style={styles.topBarSub}>
              {round.date}
              {round.tee ? ` · ${round.tee.name}` : ''}
            </Text>
          </View>

          <Pressable
            onPress={() => setMode((m) => (m === 'score' ? 'summary' : 'score'))}
            style={styles.topBtn}
            hitSlop={10}
          >
            <Text style={styles.topBtnText}>{mode === 'score' ? 'Summary' : 'Score'}</Text>
          </Pressable>
        </View>

        {mode === 'score' ? (
          <ScrollView contentContainerStyle={styles.scroll}>
            <ScrollView
              ref={(r) => {
                holeStripRef.current = r;
              }}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.holeStrip}
            >
              {Array.from({ length: maxGlobal }, (_, i) => i + 1).map((h) => {
                const on = h === holeNumberGlobal;
                return (
                  <Pressable
                    key={h}
                    onPress={() => setHoleNumberGlobal(h)}
                    style={[styles.holeChip, on && styles.holeChipOn]}
                    hitSlop={6}
                  >
                    <Text style={[styles.holeChipText, on && styles.holeChipTextOn]}>{h}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {resolved ? (
              <>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    Yards: {yardageByCourseHoleId.get(resolved.courseHole.id) ?? resolved.courseHole.yards ?? '—'}
                  </Text>
                  <Text style={styles.metaText}>HCP: {resolved.courseHole.handicap ?? '—'}</Text>
                </View>

                {resolved.courseHole.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Notes</Text>
                    <Text style={styles.notesText}>{resolved.courseHole.notes}</Text>
                  </View>
                ) : null}

                <HoleEntry
                  par={resolved.courseHole.par}
                  initial={
                    resolved.existing
                      ? {
                          strokes: resolved.existing.strokes,
                          putts: resolved.existing.putts,
                          fairwayHit: resolved.existing.fairwayHit,
                          gir: resolved.existing.gir,
                          penalties: resolved.existing.penalties,
                        }
                      : undefined
                  }
                  onSave={onSave}
                />

                <View style={styles.nav}>
                  <Pressable
                    onPress={() => setHoleNumberGlobal((h) => Math.max(1, h - 1))}
                    disabled={holeNumberGlobal <= 1}
                    style={[styles.navBtn, holeNumberGlobal <= 1 && styles.navBtnDisabled]}
                  >
                    <Text style={styles.navBtnText}>Prev</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (holeNumberGlobal < maxGlobal) setHoleNumberGlobal((h) => h + 1);
                      else setMode('summary');
                    }}
                    style={styles.navBtn}
                  >
                    <Text style={styles.navBtnText}>{holeNumberGlobal < maxGlobal ? 'Next' : 'Summary'}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.error}>Unable to resolve hole.</Text>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {isAbandoned ? <Text style={styles.abandoned}>Abandoned</Text> : null}

            {!round.isComplete && !isAbandoned ? (
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

            {computedSummary ? (
              <RoundSummary
                totalScore={totalScore}
                totalPar={computedSummary.totalPar}
                avgPutts={computedSummary.avgPutts}
                girPct={computedSummary.girPct}
                fairwayPct={computedSummary.fairwayPct}
                totalPenalties={computedSummary.totalPenalties}
                differential={round.handicapDifferential ?? null}
                scoreRows={computedSummary.rows}
                onEditHole={(h) => {
                  setHoleNumberGlobal(h);
                  setMode('score');
                }}
              />
            ) : (
              <Text style={styles.error}>Unable to compute summary.</Text>
            )}

            {!round.isComplete && !isAbandoned ? (
              <Pressable
                onPress={() => {
                  Alert.alert('Abandon round?', 'This keeps the round for reference, but hides Resume.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Abandon', style: 'destructive', onPress: () => abandonRound() },
                  ]);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Abandon round</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  frame: { flex: 1 },
  container: { padding: 16, gap: 12 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  topBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#999' },
  topBtnText: { fontSize: 14, fontWeight: '900' },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '900' },
  topBarSub: { opacity: 0.75, fontWeight: '600' },
  holeStrip: { gap: 8, paddingVertical: 6 },
  holeChip: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: '#999', alignItems: 'center', justifyContent: 'center' },
  holeChipOn: { backgroundColor: '#2f80ed', borderColor: '#2f80ed' },
  holeChipText: { fontSize: 15, fontWeight: '900' },
  holeChipTextOn: { color: '#fff' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaText: { fontWeight: '700', opacity: 0.8 },
  notesBox: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, gap: 6 },
  notesLabel: { fontSize: 12, fontWeight: '900', opacity: 0.7 },
  notesText: { fontSize: 14, fontWeight: '600', opacity: 0.85 },
  nav: { flexDirection: 'row', gap: 10, marginTop: 8 },
  navBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#999', alignItems: 'center' },
  navBtnDisabled: { opacity: 0.5 },
  navBtnText: { fontSize: 16, fontWeight: '700' },
  primaryButton: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#2f80ed', alignItems: 'center' },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '800' },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#2f80ed', alignItems: 'center' },
  secondaryButtonText: { color: '#2f80ed', fontSize: 16, fontWeight: '800' },
  abandoned: { fontSize: 14, fontWeight: '900', color: '#c62828' },
  error: { color: '#c62828', fontWeight: '700' },
});

