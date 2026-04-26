import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { getScoreLabel, scoreColors } from '@/constants/golf';
import { HoleScoreInput, HoleScoreSchema } from '@/utils/validators';
import { colors, radius, space, typography } from '@/theme/tokens';

type Props = {
  par: number;
  initial?: Partial<HoleScoreInput>;
  onSave: (data: HoleScoreInput) => Promise<void> | void;
};

function Counter({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={cStyles.counterRow}>
      <Text style={cStyles.counterLabel}>{label}</Text>
      <View style={cStyles.counterControls}>
        <Pressable onPress={onDec} style={cStyles.counterBtn} hitSlop={6}>
          <Text style={cStyles.counterBtnText}>−</Text>
        </Pressable>
        <Text style={cStyles.counterValue}>{value}</Text>
        <Pressable onPress={onInc} style={cStyles.counterBtn} hitSlop={6}>
          <Text style={cStyles.counterBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function HoleEntry({ par, initial, onSave }: Props) {
  const [strokes, setStrokes] = useState(initial?.strokes ?? par);
  const [putts, setPutts] = useState(initial?.putts ?? 2);
  const [fairwayHit, setFairwayHit] = useState(initial?.fairwayHit ?? false);
  const [gir, setGir] = useState(initial?.gir ?? false);
  const [penalties, setPenalties] = useState(initial?.penalties ?? 0);

  // Reset when navigating to a new hole
  useEffect(() => {
    setStrokes(initial?.strokes ?? par);
    setPutts(initial?.putts ?? 2);
    setFairwayHit(initial?.fairwayHit ?? false);
    setGir(initial?.gir ?? false);
    setPenalties(initial?.penalties ?? 0);
  }, [initial?.strokes, initial?.putts, initial?.fairwayHit, initial?.gir, initial?.penalties, par]);

  useEffect(() => { if (par === 3) setFairwayHit(false); }, [par]);

  const sc = useMemo(() => scoreColors(strokes, par), [strokes, par]);
  const label = useMemo(() => getScoreLabel(strokes, par), [strokes, par]);

  // Called after every user interaction with the new values merged in
  function commit(overrides: Partial<HoleScoreInput>) {
    const candidate: HoleScoreInput = {
      strokes:    overrides.strokes    ?? strokes,
      putts:      overrides.putts      ?? putts,
      fairwayHit: overrides.fairwayHit ?? fairwayHit,
      gir:        overrides.gir        ?? gir,
      penalties:  overrides.penalties  ?? penalties,
    };
    const result = HoleScoreSchema.safeParse(candidate);
    if (result.success) onSave(candidate);
  }

  function changeStrokes(next: number) {
    const s = Math.max(1, Math.min(20, next));
    const p = Math.min(putts, s); // clamp putts
    setStrokes(s);
    setPutts(p);
    commit({ strokes: s, putts: p });
  }

  function changePutts(next: number) {
    const p = Math.max(0, Math.min(Math.min(10, strokes), next));
    setPutts(p);
    commit({ putts: p });
  }

  function changePenalties(next: number) {
    const v = Math.max(0, Math.min(10, next));
    setPenalties(v);
    commit({ penalties: v });
  }

  function toggleFairway() {
    const v = !fairwayHit;
    setFairwayHit(v);
    commit({ fairwayHit: v });
  }

  function toggleGir() {
    const v = !gir;
    setGir(v);
    commit({ gir: v });
  }

  return (
    <View style={styles.card}>
      {/* Score hero */}
      <View style={styles.heroRow}>
        <Pressable onPress={() => changeStrokes(strokes - 1)} style={styles.heroBtn} hitSlop={8}>
          <Text style={styles.heroBtnText}>−</Text>
        </Pressable>

        <View style={[styles.heroCenter, { backgroundColor: sc.bg, borderColor: sc.border ?? sc.bg }]}>
          <Text style={[styles.heroScore, { color: sc.text }]}>{strokes}</Text>
          <Text style={[styles.heroLabel, { color: sc.text }]}>{label}</Text>
        </View>

        <Pressable onPress={() => changeStrokes(strokes + 1)} style={styles.heroBtn} hitSlop={8}>
          <Text style={styles.heroBtnText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <Counter label="Putts"     value={putts}     onDec={() => changePutts(putts - 1)}         onInc={() => changePutts(putts + 1)} />
      <Counter label="Penalties" value={penalties} onDec={() => changePenalties(penalties - 1)} onInc={() => changePenalties(penalties + 1)} />

      <View style={styles.divider} />

      <View style={styles.toggleRow}>
        {par !== 3 ? (
          <Pressable onPress={toggleFairway} style={[styles.toggle, fairwayHit && styles.toggleOn]}>
            <Text style={[styles.toggleText, fairwayHit && styles.toggleTextOn]}>Fairway</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={toggleGir} style={[styles.toggle, gir && styles.toggleOn]}>
          <Text style={[styles.toggleText, gir && styles.toggleTextOn]}>GIR</Text>
        </Pressable>
      </View>
    </View>
  );
}

const cStyles = StyleSheet.create({
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterLabel: { ...typography.bodyM, color: colors.text },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: { fontSize: 22, fontWeight: '600', color: colors.text, lineHeight: 26 },
  counterValue: {
    width: 40,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[4],
    gap: space[4],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },

  heroRow: { flexDirection: 'row', alignItems: 'stretch', gap: space[3] },
  heroBtn: {
    width: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnText: { fontSize: 32, fontWeight: '300', color: colors.text, lineHeight: 36, includeFontPadding: false },
  heroCenter: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space[4],
    alignItems: 'center',
    gap: space[1],
  },
  heroScore: { fontSize: 52, fontWeight: '700', lineHeight: 56, fontVariant: ['tabular-nums'] },
  heroLabel: { fontSize: 13, fontWeight: '600', lineHeight: 16 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },

  toggleRow: { flexDirection: 'row', gap: space[3] },
  toggle: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  toggleText: { ...typography.labelM, color: colors.textMuted },
  toggleTextOn: { color: colors.onPrimaryContainer, fontWeight: '700' },
});
