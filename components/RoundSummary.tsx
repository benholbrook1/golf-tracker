import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { ScoreCard } from '@/components/ScoreCard';

type Props = {
  totalScore: number;
  totalPar: number;
  avgPutts: number | null;
  girPct: number | null;
  fairwayPct: number | null;
  totalPenalties: number;
  differential: number | null;
  scoreRows: Array<{ globalHole: number; par: number; strokes: number | null }>;
  onEditHole: (globalHole: number) => void;
};

export function RoundSummary({
  totalScore,
  totalPar,
  avgPutts,
  girPct,
  fairwayPct,
  totalPenalties,
  differential,
  scoreRows,
  onEditHole,
}: Props) {
  const diff = totalScore - totalPar;
  const diffLabel = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroScore}>{totalScore}</Text>
        <Text style={styles.heroSub}>vs Par {diffLabel}</Text>
        {differential != null ? <Text style={styles.heroSub}>Differential: {differential.toFixed(1)}</Text> : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Avg putts</Text>
          <Text style={styles.statValue}>{avgPutts == null ? '—' : avgPutts.toFixed(1)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>GIR%</Text>
          <Text style={styles.statValue}>{girPct == null ? '—' : `${Math.round(girPct)}%`}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>FW%</Text>
          <Text style={styles.statValue}>{fairwayPct == null ? '—' : `${Math.round(fairwayPct)}%`}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Penalties</Text>
          <Text style={styles.statValue}>{totalPenalties}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Scorecard</Text>
      <ScoreCard rows={scoreRows} />

      <Text style={styles.sectionTitle}>Edit</Text>
      <View style={styles.editGrid}>
        {scoreRows.map((r) => (
          <Pressable key={r.globalHole} style={styles.editBtn} onPress={() => onEditHole(r.globalHole)}>
            <Text style={styles.editBtnText}>{r.globalHole}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  hero: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#999',
    gap: 4,
  },
  heroScore: {
    fontSize: 40,
    fontWeight: '900',
  },
  heroSub: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.85,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#999',
    gap: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.75,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  editGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
});

