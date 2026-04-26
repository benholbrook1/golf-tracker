import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { scoreColors } from '@/constants/golf';
import { colors, radius, space, typography } from '@/theme/tokens';

type Row = {
  globalHole: number;
  par: number;
  strokes: number | null;
};

// ── Cell sizing ───────────────────────────────────────────────────────────────
// Cells flex to fill the row — no fixed column width needed

function NineGrid({
  holes,
  onHolePress,
}: {
  holes: Row[];
  onHolePress?: (globalHole: number) => void;
}) {

  return (
    <View style={{ overflow: 'hidden' }}>
      <View>
        {/* ── Hole number row ── */}
        <View style={[grid.row, grid.headerRow]}>
          {holes.map((h) => (
            <View key={h.globalHole} style={grid.cell}>
              <Text style={grid.holeNum}>{h.globalHole}</Text>
            </View>
          ))}
        </View>

        {/* ── Par row ── */}
        <View style={[grid.row, grid.parRow]}>
          {holes.map((h) => (
            <View key={h.globalHole} style={grid.cell}>
              <Text style={grid.parVal}>{h.par}</Text>
            </View>
          ))}
        </View>

        {/* ── Score row ── */}
        <View style={[grid.row, grid.scoreRow]}>
          {holes.map((h) => {
            const sc = h.strokes != null ? scoreColors(h.strokes, h.par) : null;
            return (
              <Pressable
                key={h.globalHole}
                style={({ pressed }) => [grid.cell, pressed && grid.cellPressed]}
                onPress={() => onHolePress?.(h.globalHole)}
                disabled={!onHolePress}
              >
                {sc ? (
                  <View
                    style={[
                      grid.badge,
                      { backgroundColor: sc.bg, borderColor: sc.border ?? 'transparent' },
                    ]}
                  >
                    <Text style={[grid.badgeText, { color: sc.text }]}>{h.strokes}</Text>
                  </View>
                ) : (
                  <Text style={grid.emptyVal}>—</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const grid = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  headerRow: {
    backgroundColor: colors.surfaceContainer,
    borderTopWidth: 0,
  },
  parRow: { backgroundColor: colors.surfaceBright },
  scoreRow: { backgroundColor: colors.surfaceBright },

  cell: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPressed: { opacity: 0.55 },
  holeNum: { ...typography.labelS, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  parVal: { ...typography.labelM, color: colors.text, fontVariant: ['tabular-nums'] },
  emptyVal: { ...typography.labelM, color: colors.textDisabled },

  badge: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
});

// ── Main ScoreCard ────────────────────────────────────────────────────────────
export function ScoreCard({
  rows,
  onHolePress,
}: {
  rows: Row[];
  onHolePress?: (globalHole: number) => void;
}) {
  const front = rows
    .filter((r) => r.globalHole <= 9)
    .sort((a, b) => a.globalHole - b.globalHole);
  const back = rows
    .filter((r) => r.globalHole >= 10)
    .sort((a, b) => a.globalHole - b.globalHole);

  const isEighteen = back.length > 0;

  return (
    <View style={styles.card}>
      <NineGrid holes={front} onHolePress={onHolePress} />
      {isEighteen ? (
        <>
          <View style={styles.nineDivider} />
          <NineGrid holes={back} onHolePress={onHolePress} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  nineDivider: {
    height: 4,
    backgroundColor: colors.surfaceContainer,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
});
