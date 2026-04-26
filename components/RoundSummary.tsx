import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { ScoreCard } from '@/components/ScoreCard';
import { colors, radius, space, typography } from '@/theme/tokens';

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

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[sStyles.card, highlight && sStyles.cardHighlight]}>
      <Text style={[sStyles.label, highlight && sStyles.labelHighlight]}>{label}</Text>
      <Text style={[sStyles.value, highlight && sStyles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const sStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[1],
    alignItems: 'center',
  },
  cardHighlight: { backgroundColor: colors.primaryContainer },
  label: { ...typography.labelS, color: colors.textMuted, textAlign: 'center' },
  labelHighlight: { color: colors.onPrimaryContainer },
  value: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  valueHighlight: { color: colors.primary, fontSize: 26 },
});

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
  // Only count holes that have been scored for the diff calculation
  const scoredRows = scoreRows.filter((r) => r.strokes != null);
  const holesPlayed = scoredRows.length;
  const totalHoles = scoreRows.length;
  const isComplete = holesPlayed === totalHoles && totalHoles > 0;

  const scoredPar = scoredRows.reduce((s, r) => s + r.par, 0);
  const diff = totalScore - scoredPar;
  const diffLabel = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;

  const heroSub = isComplete
    ? `vs par ${diffLabel}`
    : holesPlayed === 0
      ? 'No holes scored yet'
      : `Through ${holesPlayed} of ${totalHoles} holes · ${diffLabel}`;

  return (
    <View style={styles.container}>
      {/* Score hero */}
      <View style={styles.hero}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroScore}>{holesPlayed === 0 ? '—' : totalScore}</Text>
          <Text style={styles.heroSub}>{heroSub}</Text>
        </View>
        {differential != null ? (
          <View style={styles.heroDiff}>
            <Text style={styles.heroDiffLabel}>Differential</Text>
            <Text style={styles.heroDiffValue}>{differential.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Avg putts" value={avgPutts == null ? '—' : avgPutts.toFixed(1)} highlight />
        <StatCard label="GIR" value={girPct == null ? '—' : `${Math.round(girPct)}%`} />
        <StatCard label="Fairway" value={fairwayPct == null ? '—' : `${Math.round(fairwayPct)}%`} />
        <StatCard label="Penalties" value={String(totalPenalties)} />
      </View>

      {/* Scorecard — tap a score to edit that hole */}
      <Text style={styles.sectionTitle}>Scorecard</Text>
      <ScoreCard rows={scoreRows} onHolePress={onEditHole} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space[5] },

  hero: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[5],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  heroLeft: { gap: space[1] },
  heroScore: {
    fontSize: 52,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 56,
    fontVariant: ['tabular-nums'],
  },
  heroSub: { ...typography.bodyM, color: colors.textMuted },
  heroDiff: { alignItems: 'flex-end', gap: space[1] },
  heroDiffLabel: { ...typography.labelS, color: colors.textMuted },
  heroDiffValue: { fontSize: 28, fontWeight: '700', color: colors.primary, fontVariant: ['tabular-nums'] },

  statsRow: { flexDirection: 'row', gap: space[2] },

  sectionTitle: { ...typography.labelM, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
});
