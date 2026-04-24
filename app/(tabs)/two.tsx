import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { HandicapBadge } from '@/components/HandicapBadge';
import { Text } from '@/components/Themed';
import { useStats } from '@/hooks/useStats';

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
  return (
    <View style={cardStyles.card}>
      <Text style={cardStyles.cardTitle}>{title}</Text>
      {points.length === 0 ? <Text style={cardStyles.muted}>Not enough completed rounds yet.</Text> : null}
      <View style={cardStyles.chart}>
        {points.map((p) => {
          const widthPct = max <= 0 ? 0 : Math.round((p.value / max) * 100);
          return (
            <View key={p.key} style={cardStyles.barRow}>
              <Text style={cardStyles.barLabel}>{p.label}</Text>
              <View style={cardStyles.barTrack}>
                <View style={[cardStyles.barFill, { width: `${widthPct}%` }]} />
              </View>
              <Text style={cardStyles.barValue}>{valueLabel(p.value)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function TabTwoScreen() {
  const { stats, loading, error, refresh } = useStats();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const scorePoints = useMemo(() => {
    if (!stats) return [];
    return stats.scoreTrend.map((r) => ({
      key: r.roundId,
      label: r.date.slice(5), // MM-DD (compact)
      value: r.totalScore,
    }));
  }, [stats]);

  const puttRoundPoints = useMemo(() => {
    if (!stats) return [];
    return stats.puttsTrend.map((r) => ({
      key: r.roundId,
      label: r.date.slice(5),
      value: r.avgPutts,
    }));
  }, [stats]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Stats</Text>
        <Pressable onPress={refresh} style={styles.refresh} disabled={loading}>
          <Text style={styles.refreshText}>{loading ? '…' : '↻'}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>Error: {error}</Text> : null}

      <HandicapBadge />

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Avg putts / hole</Text>
          <Text style={styles.metricValue}>
            {stats?.avgPuttsPerHole == null ? '—' : stats.avgPuttsPerHole.toFixed(2)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>GIR%</Text>
          <Text style={styles.metricValue}>{stats?.girPct == null ? '—' : `${Math.round(stats.girPct)}%`}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>FW%</Text>
          <Text style={styles.metricValue}>
            {stats?.fairwayPct == null ? '—' : `${Math.round(stats.fairwayPct)}%`}
          </Text>
          <Text style={styles.metricHint}>Par 3 excluded</Text>
        </View>
      </View>

      <Text style={styles.sectionHint}>
        Trends use your most recent {stats?.scoreTrend.length ?? 0} completed rounds (max 10).
      </Text>

      <SparkBars title="Score trend" points={scorePoints} valueLabel={(v) => `${Math.round(v)}`} />
      <SparkBars title="Avg putts / round" points={puttRoundPoints} valueLabel={(v) => v.toFixed(2)} />

      <View style={cardStyles.card}>
        <Text style={cardStyles.cardTitle}>Avg putts by hole (trend rounds)</Text>
        {stats && stats.avgPuttsByHole.length === 0 ? (
          <Text style={cardStyles.muted}>Not enough data.</Text>
        ) : null}
        <View style={styles.holeGrid}>
          {(stats?.avgPuttsByHole ?? []).map((h) => (
            <View key={h.hole} style={styles.holeCell}>
              <Text style={styles.holeCellTop}>#{h.hole}</Text>
              <Text style={styles.holeCellBottom}>{h.avgPutts.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  refresh: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
  },
  refreshText: {
    fontSize: 16,
    fontWeight: '900',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#999',
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.75,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  metricHint: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.65,
  },
  sectionHint: {
    opacity: 0.75,
    fontWeight: '600',
  },
  holeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  holeCell: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
    gap: 2,
  },
  holeCellTop: {
    fontSize: 12,
    fontWeight: '900',
    opacity: 0.75,
  },
  holeCellBottom: {
    fontSize: 14,
    fontWeight: '900',
  },
  error: {
    color: '#c62828',
    fontWeight: '700',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#999',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  muted: {
    opacity: 0.75,
    fontWeight: '600',
  },
  chart: {
    gap: 10,
    marginTop: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    width: 54,
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.8,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2f80ed',
  },
  barValue: {
    width: 52,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '900',
  },
});
