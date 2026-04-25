import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { HoleScoreInput, HoleScoreSchema } from '@/utils/validators';
import { getScoreLabel } from '@/constants/golf';

type Props = {
  par: number;
  initial?: Partial<HoleScoreInput>;
  onSave: (data: HoleScoreInput) => Promise<void> | void;
};

export function HoleEntry({ par, initial, onSave }: Props) {
  const [strokes, setStrokes] = useState<number>(initial?.strokes ?? par);
  const [putts, setPutts] = useState<number>(initial?.putts ?? 2);
  const [fairwayHit, setFairwayHit] = useState<boolean>(initial?.fairwayHit ?? false);
  const [gir, setGir] = useState<boolean>(initial?.gir ?? false);
  const [penalties, setPenalties] = useState<number>(initial?.penalties ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStrokes(initial?.strokes ?? par);
    setPutts(initial?.putts ?? 2);
    setFairwayHit(initial?.fairwayHit ?? false);
    setGir(initial?.gir ?? false);
    setPenalties(initial?.penalties ?? 0);
  }, [
    initial?.strokes,
    initial?.putts,
    initial?.fairwayHit,
    initial?.gir,
    initial?.penalties,
    par,
  ]);

  useEffect(() => {
    // keep putts valid as strokes change
    setPutts((p) => Math.min(p, strokes));
  }, [strokes]);

  useEffect(() => {
    // Fairway hit doesn't apply on par 3s.
    if (par === 3) setFairwayHit(false);
  }, [par]);

  const scoreLabel = useMemo(() => getScoreLabel(strokes, par), [strokes, par]);

  const onInc = (value: number, setter: (v: number) => void, max: number) => {
    setter(Math.min(max, value + 1));
  };
  const onDec = (value: number, setter: (v: number) => void, min: number) => {
    setter(Math.max(min, value - 1));
  };

  const handleSave = async () => {
    setError(null);
    const candidate: HoleScoreInput = { strokes, putts, fairwayHit, gir, penalties };
    try {
      HoleScoreSchema.parse(candidate);
    } catch (e) {
      setError('Please enter valid strokes/putts.');
      return;
    }

    setSaving(true);
    try {
      await onSave(candidate);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.parText}>Par {par}</Text>
        <Text style={styles.scoreLabel}>{scoreLabel}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Strokes</Text>
        <View style={styles.counter}>
          <Pressable onPress={() => onDec(strokes, setStrokes, 1)} style={styles.counterButton}>
            <Text style={styles.counterButtonText}>−</Text>
          </Pressable>
          <Text style={styles.value}>{strokes}</Text>
          <Pressable onPress={() => onInc(strokes, setStrokes, 20)} style={styles.counterButton}>
            <Text style={styles.counterButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Putts</Text>
        <View style={styles.counter}>
          <Pressable onPress={() => onDec(putts, setPutts, 0)} style={styles.counterButton}>
            <Text style={styles.counterButtonText}>−</Text>
          </Pressable>
          <Text style={styles.value}>{putts}</Text>
          <Pressable onPress={() => onInc(putts, setPutts, Math.min(10, strokes))} style={styles.counterButton}>
            <Text style={styles.counterButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Penalties</Text>
        <View style={styles.counter}>
          <Pressable onPress={() => onDec(penalties, setPenalties, 0)} style={styles.counterButton}>
            <Text style={styles.counterButtonText}>−</Text>
          </Pressable>
          <Text style={styles.value}>{penalties}</Text>
          <Pressable onPress={() => onInc(penalties, setPenalties, 10)} style={styles.counterButton}>
            <Text style={styles.counterButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.toggles}>
        {par !== 3 ? (
          <Pressable
            onPress={() => setFairwayHit((v) => !v)}
            style={[styles.toggle, fairwayHit && styles.toggleOn]}
          >
            <Text style={styles.toggleText}>Fairway</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => setGir((v) => !v)} style={[styles.toggle, gir && styles.toggleOn]}>
          <Text style={styles.toggleText}>GIR</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={handleSave} disabled={saving} style={[styles.save, saving && styles.saveDisabled]}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#999',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  parText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonText: {
    fontSize: 20,
    fontWeight: '800',
  },
  value: {
    width: 32,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  toggles: {
    flexDirection: 'row',
    gap: 10,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
  },
  toggleOn: {
    borderColor: '#2f80ed',
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  save: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2f80ed',
    alignItems: 'center',
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  error: {
    color: '#c62828',
    fontWeight: '600',
  },
});

