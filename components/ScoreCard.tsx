import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { getScoreLabel } from '@/constants/golf';

type Row = {
  globalHole: number;
  par: number;
  strokes: number | null;
};

export function ScoreCard({ rows }: { rows: Row[] }) {
  return (
    <View style={styles.container}>
      <View style={[styles.row, styles.header]}>
        <Text style={[styles.cell, styles.hole]}>Hole</Text>
        <Text style={[styles.cell, styles.par]}>Par</Text>
        <Text style={[styles.cell, styles.score]}>Score</Text>
        <Text style={[styles.cell, styles.label]}>Result</Text>
      </View>

      {rows.map((r) => {
        const diff = r.strokes == null ? null : r.strokes - r.par;
        const tint =
          diff == null ? undefined : diff <= -1 ? styles.good : diff === 0 ? styles.ok : styles.bad;

        return (
          <View key={r.globalHole} style={[styles.row, tint]}>
            <Text style={[styles.cell, styles.hole]}>{r.globalHole}</Text>
            <Text style={[styles.cell, styles.par]}>{r.par}</Text>
            <Text style={[styles.cell, styles.score]}>{r.strokes ?? '—'}</Text>
            <Text style={[styles.cell, styles.label]}>
              {r.strokes == null ? '—' : getScoreLabel(r.strokes, r.par)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
  },
  cell: {
    fontSize: 14,
    fontWeight: '600',
  },
  hole: {
    width: 44,
  },
  par: {
    width: 40,
  },
  score: {
    width: 56,
  },
  label: {
    flex: 1,
  },
  good: {
    backgroundColor: 'rgba(46, 204, 113, 0.10)',
  },
  ok: {
    backgroundColor: 'rgba(52, 152, 219, 0.06)',
  },
  bad: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
  },
});

