import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { HoleEntry } from '@/components/HoleEntry';
import { RoundSummary } from '@/components/RoundSummary';
import { HandicapEngine } from '@/utils/handicap';
import { useRound } from '@/hooks/useRound';
import { scoreColors } from '@/constants/golf';
import { colors, radius, space, typography } from '@/theme/tokens';
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
  const insets = useSafeAreaInsets();
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
    if (!holeStripRef.current || maxGlobal <= 0) return;
    const unit = 48;
    const x = Math.max(0, (holeNumberGlobal - 1) * unit - unit * 2);
    holeStripRef.current.scrollTo({ x, y: 0, animated: true });
  }, [holeNumberGlobal, maxGlobal]);

  // Map global hole → {strokes, par} for colour-coding the strip
  const scoreByGlobal = useMemo(() => {
    const m = new Map<number, { strokes: number; par: number }>();
    for (const rn of roundNines) {
      const offset = (rn.nineOrder - 1) * 9;
      for (const ch of rn.courseHoles) {
        const scored = rn.holes.find((h) => h.holeNumber === ch.holeNumber);
        if (scored) m.set(offset + ch.holeNumber, { strokes: scored.strokes, par: ch.par });
      }
    }
    return m;
  }, [roundNines]);

  const resolved = useMemo(() => {
    if (!round || roundNines.length === 0) return null;
    if (!Number.isFinite(holeNumberGlobal) || holeNumberGlobal < 1 || holeNumberGlobal > maxGlobal) return null;
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
    const totalPenalties = roundNines.flatMap((rn) => rn.holes.map((h) => h.penalties ?? 0)).reduce((s, p) => s + p, 0);
    return { rows, totalPar, avgPutts, girPct, fairwayPct, totalPenalties };
  }, [round, roundNines]);

  useEffect(() => {
    if (!roundId || !round || !round.isComplete || round.handicapDifferential != null) return;
    HandicapEngine.saveDifferential(roundId).then(refresh).catch(() => {});
  }, [roundId, round, refresh]);

  const onSave = async (data: HoleScoreInput) => {
    if (!resolved) return;
    await saveHole(resolved.rn.id, resolved.courseHole.id, resolved.holeNumberWithinNine, data);
    if (holeNumberGlobal < maxGlobal) setHoleNumberGlobal((h) => h + 1);
    else setMode('summary');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !round) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={[styles.center, { padding: space[4], gap: space[3] }]}>
          <Text style={styles.errorText}>Error: {error ?? 'Round not found'}</Text>
          <Pressable onPress={() => router.replace('/rounds')} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>Back to rounds</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isAbandoned = round.abandonedAt != null;
  const holesPlayed = computedSummary?.rows.filter((r) => r.strokes != null).length ?? 0;
  const canComplete = holesPlayed === maxGlobal && maxGlobal > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ── Fixed top area ── */}
      <View style={styles.topArea}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace('/rounds')} style={styles.topBtn} hitSlop={10}>
            <Text style={styles.topBtnText}>← Rounds</Text>
          </Pressable>

          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {mode === 'score' ? `Hole ${holeNumberGlobal} of ${maxGlobal}` : 'Summary'}
            </Text>
            {round.tee ? (
              <Text style={styles.topBarSub}>{round.tee.name} tees</Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => setMode((m) => (m === 'score' ? 'summary' : 'score'))}
            style={[styles.topBtn, mode === 'summary' && styles.topBtnActive]}
            hitSlop={10}
          >
            <Text style={[styles.topBtnText, mode === 'summary' && styles.topBtnTextActive]}>
              {mode === 'score' ? 'Summary' : 'Score'}
            </Text>
          </Pressable>
        </View>

        {/* Hole strip (score mode only) */}
        {mode === 'score' ? (
          <ScrollView
            ref={(r) => { holeStripRef.current = r; }}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.holeStrip}
          >
            {Array.from({ length: maxGlobal }, (_, i) => i + 1).map((h) => {
              const sc = scoreByGlobal.get(h);
              const col = sc ? scoreColors(sc.strokes, sc.par) : null;
              const isActive = h === holeNumberGlobal;
              return (
                <Pressable
                  key={h}
                  onPress={() => setHoleNumberGlobal(h)}
                  hitSlop={6}
                  style={[
                    styles.holeChip,
                    col ? { backgroundColor: col.bg, borderColor: col.border ?? col.bg } : null,
                    isActive && styles.holeChipActive,
                  ]}
                >
                  <Text style={[
                    styles.holeChipText,
                    col ? { color: col.text } : null,
                    isActive && styles.holeChipTextActive,
                  ]}>
                    {h}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* ── Scrollable content ── */}
      {mode === 'score' ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
          keyboardShouldPersistTaps="handled"
        >
          {resolved ? (
            <>
              {/* Hole meta card */}
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Par</Text>
                    <Text style={styles.metaValue}>{resolved.courseHole.par}</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Yards</Text>
                    <Text style={styles.metaValue}>
                      {yardageByCourseHoleId.get(resolved.courseHole.id) ?? resolved.courseHole.yards ?? '—'}
                    </Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>HCP</Text>
                    <Text style={styles.metaValue}>{resolved.courseHole.handicap ?? '—'}</Text>
                  </View>
                </View>
                {resolved.courseHole.notes ? (
                  <View style={styles.notesRow}>
                    <Text style={styles.notesLabel}>Note</Text>
                    <Text style={styles.notesText}>{resolved.courseHole.notes}</Text>
                  </View>
                ) : null}
              </View>

              <HoleEntry
                par={resolved.courseHole.par}
                initial={resolved.existing ? {
                  strokes: resolved.existing.strokes,
                  putts: resolved.existing.putts,
                  fairwayHit: resolved.existing.fairwayHit,
                  gir: resolved.existing.gir,
                  penalties: resolved.existing.penalties,
                } : undefined}
                onSave={onSave}
              />
            </>
          ) : (
            <Text style={styles.errorText}>Unable to resolve hole.</Text>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space[8] }]}
        >
          {isAbandoned ? (
            <View style={styles.abandonedBanner}>
              <Text style={styles.abandonedText}>This round was abandoned</Text>
            </View>
          ) : null}

          {!round.isComplete && !isAbandoned ? (
            <Pressable
              onPress={() => completeRound()}
              disabled={!canComplete}
              style={[styles.primaryBtn, !canComplete && styles.primaryBtnDisabled]}
            >
              <Text style={styles.primaryBtnText}>
                {canComplete ? 'Mark round complete' : `Score all ${maxGlobal} holes to finish`}
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
              onEditHole={(h) => { setHoleNumberGlobal(h); setMode('score'); }}
            />
          ) : (
            <Text style={styles.errorText}>Unable to compute summary.</Text>
          )}

          {!round.isComplete && !isAbandoned ? (
            <Pressable
              onPress={() => {
                Alert.alert('Abandon round?', 'Keeps the round for reference but removes it from Resume.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Abandon', style: 'destructive', onPress: () => abandonRound() },
                ]);
              }}
              style={styles.abandonBtn}
            >
              <Text style={styles.abandonBtnText}>Abandon round</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      {/* ── Fixed bottom nav (score mode) ── */}
      {mode === 'score' ? (
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, space[3]) }]}>
          <Pressable
            onPress={() => setHoleNumberGlobal((h) => Math.max(1, h - 1))}
            disabled={holeNumberGlobal <= 1}
            style={[styles.navBtn, holeNumberGlobal <= 1 && styles.navBtnDisabled]}
          >
            <Text style={styles.navBtnText}>← Prev</Text>
          </Pressable>
          <Text style={styles.navCenter}>{holeNumberGlobal} / {maxGlobal}</Text>
          <Pressable
            onPress={() => {
              if (holeNumberGlobal < maxGlobal) setHoleNumberGlobal((h) => h + 1);
              else setMode('summary');
            }}
            style={styles.navBtn}
          >
            <Text style={styles.navBtnText}>
              {holeNumberGlobal < maxGlobal ? 'Next →' : 'Summary →'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  center: { padding: space[4], gap: space[3], justifyContent: 'center' },

  // ── Fixed top area ──
  topArea: {
    backgroundColor: colors.surfaceBright,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    paddingTop: space[3],
    paddingBottom: space[2],
    gap: space[2],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    gap: space[2],
  },
  topBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    minWidth: 80,
    alignItems: 'center',
  },
  topBtnActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  topBtnText: { ...typography.labelM, color: colors.text },
  topBtnTextActive: { color: colors.onPrimaryContainer, fontWeight: '700' },
  topBarCenter: { flex: 1, alignItems: 'center', gap: 2 },
  topBarTitle: { ...typography.headingM, color: colors.text },
  topBarSub: { ...typography.labelS, color: colors.textMuted },

  // ── Hole strip ──
  holeStrip: {
    flexDirection: 'row',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[1],
  },
  holeChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeChipActive: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  holeChipText: { ...typography.labelM, color: colors.text, fontVariant: ['tabular-nums'] },
  holeChipTextActive: { fontWeight: '700' },

  // ── Scrollable content ──
  scroll: { padding: space[4], gap: space[4], paddingBottom: 40 },

  metaCard: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[4],
    gap: space[3],
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaItem: { flex: 1, alignItems: 'center', gap: space[1] },
  metaDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: colors.outlineVariant },
  metaLabel: { ...typography.labelS, color: colors.textMuted },
  metaValue: { fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  notesRow: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    paddingTop: space[3],
  },
  notesLabel: { ...typography.labelS, color: colors.textMuted, paddingTop: 2 },
  notesText: { ...typography.bodyS, color: colors.text, flex: 1 },

  // ── Summary mode ──
  abandonedBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: space[3],
    alignItems: 'center',
  },
  abandonedText: { ...typography.labelM, color: colors.error, fontWeight: '600' },

  primaryBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { ...typography.labelM, color: colors.onPrimary, fontWeight: '700', fontSize: 16 },

  abandonBtn: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abandonBtnText: { ...typography.labelM, color: colors.error },

  // ── Bottom nav ──
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBright,
    gap: space[3],
  },
  navBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceBright,
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { ...typography.labelM, color: colors.text },
  navCenter: { ...typography.labelS, color: colors.textMuted, minWidth: 48, textAlign: 'center' },

  // ── Misc ──
  muted: { ...typography.bodyS, color: colors.textMuted },
  errorText: { ...typography.bodyS, color: colors.error },
  outlineBtn: {
    height: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: { ...typography.labelM, color: colors.text },
});
