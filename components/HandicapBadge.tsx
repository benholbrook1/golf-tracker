import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { HandicapEngine } from '@/utils/handicap';
import { colors, radius, space } from '@/theme/tokens';

export function HandicapBadge() {
  const [index, setIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await HandicapEngine.getHandicapIndex();
      setIndex(v);
    } catch {
      setIndex(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const hasIndex = !loading && index != null;

  return (
    <View style={styles.card}>
      <RNText style={styles.label}>Handicap Index</RNText>
      <RNText style={[styles.value, !hasIndex && styles.valueMuted]}>
        {loading ? '—' : index == null ? '—' : index.toFixed(1)}
      </RNText>
      {!loading && index == null ? (
        <RNText style={styles.hint}>Complete 3+ rated 18-hole rounds to establish an index</RNText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: space[5],
    gap: space[1],
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 52,
    fontWeight: '700',
    lineHeight: 58,
    color: colors.onPrimary,
    fontVariant: ['tabular-nums'],
  },
  valueMuted: { fontSize: 38, lineHeight: 44 },
  hint: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: 'rgba(255,255,255,0.65)',
    marginTop: space[1],
  },
});
