import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HandicapBadge } from '@/components/HandicapBadge';
import { Text } from '@/components/Themed';
import { useStats } from '@/hooks/useStats';
import { colors, radius, space, typography } from '@/theme/tokens';

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={mStyles.card}>
      <RNText style={mStyles.label}>{label}</RNText>
      <RNText style={mStyles.value}>{value}</RNText>
      {hint ? <RNText style={mStyles.hint}>{hint}</RNText> : null}
    </View>
  );
}

const mStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[3],
    gap: space[1],
  },
  label: { fontSize: 12, fontWeight: '500', lineHeight: 16, color: colors.textMuted },
  value: { fontSize: 22, fontWeight: '700', lineHeight: 28, color: colors.text, fontVariant: ['tabular-nums'] },
  hint:  { fontSize: 11, fontWeight: '400', lineHeight: 15, color: colors.textDisabled },
});

// ── Spark bar chart ───────────────────────────────────────────────────────────
function SparkBars({
  title,
  points,
  valueLabel,
}: {
  title: string;
  points: Array<{ key: string; label: string; value: number }>;
  valueLabel: (v: number) => string;
}) {
  const max = useMemo(() => points.reduce((m, p) => Math.max(m, p.value), 0), [points]);

  if (points.length === 0) return null;

  return (
    <View style={bStyles.card}>
      <RNText style={bStyles.title}>{title}</RNText>
      <View style={bStyles.chart}>
        {points.map((p) => {
          const widthPct = max <= 0 ? 0 : Math.round((p.value / max) * 100);
          return (
            <View key={p.key} style={bStyles.barRow}>
              <RNText style={bStyles.barLabel}>{p.label}</RNText>
              <View style={bStyles.barTrack}>
                <View style={[bStyles.barFill, { width: `${widthPct}%` }]} />
              </View>
              <RNText style={bStyles.barValue}>{valueLabel(p.value)}</RNText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const bStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[4],
    gap: space[3],
  },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: colors.text },
  chart: { gap: space[2] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  barLabel: { width: 48, fontSize: 12, fontWeight: '500', lineHeight: 16, color: colors.textMuted },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  barValue: { width: 44, textAlign: 'right', fontSize: 12, fontWeight: '600', lineHeight: 16, color: colors.text, fontVariant: ['tabular-nums'] },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TabTwoScreen() {
  const insets = useSafeAreaInsets();
  const { stats, loading, error, refresh } = useStats();

  useFocusEffect(
    useCallback(() => { void refresh(); }, [refresh])
  );

  const scorePoints = useMemo(() => {
    if (!stats) return [];
    return stats.scoreTrend.map((r) => ({
      key: r.roundId,
      label: r.date.slice(5).replace('-', '/'),
      value: r.totalScore,
    }));
  }, [stats]);

  const puttPoints = useMemo(() => {
    if (!stats) return [];
    return stats.puttsTrend.map((r) => ({
      key: r.roundId,
      label: r.date.slice(5).replace('-', '/'),
      value: r.avgPutts,
    }));
  }, [stats]);

  const girPoints = useMemo(() => {
    if (!stats) return [];
    return stats.girTrend.map((r) => ({
      key: r.roundId,
      label: r.date.slice(5).replace('-', '/'),
      value: r.girPct,
    }));
  }, [stats]);

  const fairwayPoints = useMemo(() => {
    if (!stats) return [];
    return stats.fairwayTrend.map((r) => ({
      key: r.roundId,
      label: r.date.slice(5).replace('-', '/'),
      value: r.fairwayPct,
    }));
  }, [stats]);

  const noData = !loading && stats != null && stats.roundsAnalyzed === 0;

  return (
    <View style={styles.screen}>
      {/* Fixed header */}
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <RNText style={styles.headerTitle}>Stats</RNText>
        {stats && stats.roundsAnalyzed > 0 ? (
          <RNText style={styles.headerSub}>
            {stats.roundsAnalyzed} complete round{stats.roundsAnalyzed !== 1 ? 's' : ''}
          </RNText>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[8] }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text style={styles.errorText}>Error: {error}</Text>
        ) : null}

        {/* Handicap hero */}
        <HandicapBadge />

        {/* Empty state */}
        {noData ? (
          <View style={styles.emptyCard}>
            <RNText style={styles.emptyText}>
              Complete at least one 18-hole round to see trends. A handicap index requires 3+ rated rounds.
            </RNText>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/round/new')}>
              <RNText style={styles.emptyBtnText}>Start a round</RNText>
            </Pressable>
          </View>
        ) : null}

        {/* Key metrics */}
        {stats && stats.roundsAnalyzed > 0 ? (
          <View style={styles.metricsRow}>
            <MetricCard
              label="Avg putts / hole"
              value={stats.avgPuttsPerHole == null ? '—' : stats.avgPuttsPerHole.toFixed(2)}
            />
            <MetricCard
              label="GIR"
              value={stats.girPct == null ? '—' : `${Math.round(stats.girPct)}%`}
            />
            <MetricCard
              label="Fairway"
              value={stats.fairwayPct == null ? '—' : `${Math.round(stats.fairwayPct)}%`}
              hint="Par 3 excluded"
            />
          </View>
        ) : null}

        {/* Trends */}
        {scorePoints.length > 0 ? (
          <SparkBars
            title={`Score trend · last ${scorePoints.length} rounds`}
            points={scorePoints}
            valueLabel={(v) => String(Math.round(v))}
          />
        ) : null}

        {puttPoints.length > 0 ? (
          <SparkBars
            title={`Avg putts / hole · last ${puttPoints.length} rounds`}
            points={puttPoints}
            valueLabel={(v) => v.toFixed(2)}
          />
        ) : null}

        {girPoints.length > 0 ? (
          <SparkBars
            title={`GIR% · last ${girPoints.length} rounds`}
            points={girPoints}
            valueLabel={(v) => `${Math.round(v)}%`}
          />
        ) : null}

        {fairwayPoints.length > 0 ? (
          <SparkBars
            title={`Fairway% · last ${fairwayPoints.length} rounds`}
            points={fairwayPoints}
            valueLabel={(v) => `${Math.round(v)}%`}
          />
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
    gap: 2,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', lineHeight: 34, color: colors.text },
  headerSub: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: colors.textMuted },

  scroll: { flex: 1 },
  content: { padding: space[4], gap: space[4] },

  errorText: { ...typography.bodyS, color: colors.error },

  metricsRow: { flexDirection: 'row', gap: space[3] },

  emptyCard: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[4],
    gap: space[3],
  },
  emptyText: { fontSize: 14, fontWeight: '400', lineHeight: 21, color: colors.textMuted },
  emptyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: colors.onPrimary },

});
