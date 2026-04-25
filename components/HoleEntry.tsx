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
  large,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  large?: boolean;
}) {
  return (
    <View style={cStyles.counterRow}>
      <Text style={cStyles.counterLabel}>{label}</Text>
      <View style={cStyles.counterControls}>
        <Pressable onPress={onDec} style={[cStyles.counterBtn, large && cStyles.counterBtnLarge]} hitSlop={6}>
          <Text style={[cStyles.counterBtnText, large && cStyles.counterBtnTextLarge]}>−</Text>
        </Pressable>
        <Text style={[cStyles.counterValue, large && cStyles.counterValueLarge]}>{value}</Text>
        <Pressable onPress={onInc} style={[cStyles.counterBtn, large && cStyles.counterBtnLarge]} hitSlop={6}>
          <Text style={[cStyles.counterBtnText, large && cStyles.counterBtnTextLarge]}>+</Text>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStrokes(initial?.strokes ?? par);
    setPutts(initial?.putts ?? 2);
    setFairwayHit(initial?.fairwayHit ?? false);
    setGir(initial?.gir ?? false);
    setPenalties(initial?.penalties ?? 0);
  }, [initial?.strokes, initial?.putts, initial?.fairwayHit, initial?.gir, initial?.penalties, par]);

  useEffect(() => { setPutts((p) => Math.min(p, strokes)); }, [strokes]);
  useEffect(() => { if (par === 3) setFairwayHit(false); }, [par]);

  const sc = useMemo(() => scoreColors(strokes, par), [strokes, par]);
  const label = useMemo(() => getScoreLabel(strokes, par), [strokes, par]);

  const handleSave = async () => {
    setError(null);
    const candidate: HoleScoreInput = { strokes, putts, fairwayHit, gir, penalties };
    try { HoleScoreSchema.parse(candidate); }
    catch { setError('Please enter valid strokes / putts.'); return; }
    setSaving(true);
    try { await onSave(candidate); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.card}>
      {/* Score hero */}
      <View style={[styles.hero, { backgroundColor: sc.bg, borderColor: sc.border ?? sc.bg }]}>
        <Text style={[styles.heroScore, { color: sc.text }]}>{strokes}</Text>
        <Text style={[styles.heroLabel, { color: sc.text, opacity: 0.85 }]}>{label}</Text>
      </View>

      {/* Strokes counter (large) */}
      <Counter
        label="Strokes"
        value={strokes}
        onDec={() => setStrokes((v) => Math.max(1, v - 1))}
        onInc={() => setStrokes((v) => Math.min(20, v + 1))}
        large
      />

      <View style={styles.divider} />

      {/* Putts + Penalties (compact) */}
      <Counter
        label="Putts"
        value={putts}
        onDec={() => setPutts((v) => Math.max(0, v - 1))}
        onInc={() => setPutts((v) => Math.min(Math.min(10, strokes), v + 1))}
      />
      <Counter
        label="Penalties"
        value={penalties}
        onDec={() => setPenalties((v) => Math.max(0, v - 1))}
        onInc={() => setPenalties((v) => Math.min(10, v + 1))}
      />

      <View style={styles.divider} />

      {/* Fairway / GIR toggles */}
      <View style={styles.toggleRow}>
        {par !== 3 ? (
          <Pressable
            onPress={() => setFairwayHit((v) => !v)}
            style={[styles.toggle, fairwayHit && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, fairwayHit && styles.toggleTextOn]}>Fairway</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setGir((v) => !v)}
          style={[styles.toggle, gir && styles.toggleOn]}
        >
          <Text style={[styles.toggleText, gir && styles.toggleTextOn]}>GIR</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>
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
  counterBtnLarge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
  },
  counterBtnText: { fontSize: 22, fontWeight: '600', color: colors.text, lineHeight: 26 },
  counterBtnTextLarge: { fontSize: 28, lineHeight: 32 },
  counterValue: {
    width: 40,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  counterValueLarge: { fontSize: 28, width: 52 },
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

  hero: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space[4],
    alignItems: 'center',
    gap: space[1],
  },
  heroScore: {
    fontSize: 52,
    fontWeight: '700',
    lineHeight: 56,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    ...typography.labelM,
    fontWeight: '600',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
  },

  toggleRow: {
    flexDirection: 'row',
    gap: space[3],
  },
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
  toggleOn: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  toggleText: { ...typography.labelM, color: colors.textMuted },
  toggleTextOn: { color: colors.onPrimaryContainer, fontWeight: '700' },

  errorText: { ...typography.bodyS, color: colors.error },

  saveBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', lineHeight: 22, color: colors.onPrimary },
});
