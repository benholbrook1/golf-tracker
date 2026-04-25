import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { getScoreLabel, scoreColors } from '@/constants/golf';
import { colors, radius, space, typography } from '@/theme/tokens';

type Row = {
  globalHole: number;
  par: number;
  strokes: number | null;
};

export function ScoreCard({ rows }: { rows: Row[] }) {
  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.cell, styles.cellHole, styles.headerText]}>Hole</Text>
        <Text style={[styles.cell, styles.cellPar, styles.headerText]}>Par</Text>
        <Text style={[styles.cell, styles.cellScore, styles.headerText]}>Score</Text>
        <Text style={[styles.cell, styles.cellLabel, styles.headerText]}>Result</Text>
      </View>

      {rows.map((r, i) => {
        const sc = r.strokes != null ? scoreColors(r.strokes, r.par) : null;
        const even = i % 2 === 0;
        return (
          <View
            key={r.globalHole}
            style={[styles.bodyRow, even ? styles.rowEven : styles.rowOdd]}
          >
            <Text style={[styles.cell, styles.cellHole, styles.bodyText]}>{r.globalHole}</Text>
            <Text style={[styles.cell, styles.cellPar, styles.bodyText]}>{r.par}</Text>
            <View style={styles.cellScore}>
              {r.strokes != null && sc ? (
                <View style={[styles.badge, { backgroundColor: sc.bg, borderColor: sc.border ?? 'transparent' }]}>
                  <Text style={[styles.badgeText, { color: sc.text }]}>{r.strokes}</Text>
                </View>
              ) : (
                <Text style={[styles.cell, styles.bodyText, { color: colors.textDisabled }]}>—</Text>
              )}
            </View>
            <Text style={[styles.cell, styles.cellLabel, styles.bodyText, { color: sc ? undefined : colors.textDisabled }]}>
              {r.strokes == null ? '—' : getScoreLabel(r.strokes, r.par)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    gap: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    gap: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  rowEven: { backgroundColor: colors.surfaceBright },
  rowOdd: { backgroundColor: colors.surface },

  cell: { },
  cellHole: { width: 40 },
  cellPar: { width: 36 },
  cellScore: { width: 52, alignItems: 'center' },
  cellLabel: { flex: 1 },

  headerText: { ...typography.labelS, color: colors.textMuted },
  bodyText: { ...typography.labelM, color: colors.text, fontVariant: ['tabular-nums'] },

  badge: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 16,
  },
});
