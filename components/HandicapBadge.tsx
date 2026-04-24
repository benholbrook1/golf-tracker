import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { HandicapEngine } from '@/utils/handicap';

export function HandicapBadge() {
  const [index, setIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const v = await HandicapEngine.getHandicapIndex();
      setIndex(v);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIndex(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Handicap Index</Text>
        <Pressable onPress={load} style={styles.refresh} disabled={loading}>
          <Text style={styles.refreshText}>{loading ? '…' : '↻'}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.value}>
        {loading ? '—' : index == null ? 'Need 3+ scored rounds' : index.toFixed(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#999',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.85,
  },
  refresh: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#999',
  },
  refreshText: {
    fontSize: 16,
    fontWeight: '900',
  },
  value: {
    fontSize: 28,
    fontWeight: '900',
  },
  error: {
    color: '#c62828',
    fontWeight: '700',
  },
});
