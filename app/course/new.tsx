import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/Themed';
import { confirmScorecardParse } from '@/hooks/useCourseImport';
import type { ScorecardParseResult } from '@/utils/validators';

const DEFAULT_FRONT_PARS = [4, 3, 5, 4, 3, 4, 5, 4, 3] as const;
const DEFAULT_BACK_PARS = [4, 5, 3, 4, 4, 5, 3, 4, 4] as const;

function buildDefault18(courseName: string): ScorecardParseResult {
  return {
    courseName,
    tees: ['Default'],
    nines: [
      {
        name: 'Front 9',
        holes: DEFAULT_FRONT_PARS.map((par, i) => ({
          holeNumber: i + 1,
          par,
          yardages: [null],
          handicap: null,
        })),
      },
      {
        name: 'Back 9',
        holes: DEFAULT_BACK_PARS.map((par, i) => ({
          holeNumber: i + 1,
          par,
          yardages: [null],
          handicap: null,
        })),
      },
    ],
  };
}

export default function ManualCourseScreen() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    const n = name.trim();
    if (!n) return null;
    return buildDefault18(n);
  }, [name]);

  const onCreate = async () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Missing name', 'Enter a course name.');
      return;
    }
    setBusy(true);
    try {
      await confirmScorecardParse(buildDefault18(n), { selectedTeeIndex: 0 });
      router.replace('/round/new');
    } catch (e) {
      Alert.alert('Create failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manual course</Text>
      <Text style={styles.subtitle}>Creates a default 18-hole layout (seed-like pars) so you can start a round immediately.</Text>

      <Text style={styles.label}>Course name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Maple Grove GC" style={styles.input} placeholderTextColor="#777" />

      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Preview</Text>
          <Text style={styles.previewLine}>
            {preview.nines[0]!.name}: {preview.nines[0]!.holes.map((h) => h.par).join(',')}
          </Text>
          <Text style={styles.previewLine}>
            {preview.nines[1]!.name}: {preview.nines[1]!.holes.map((h) => h.par).join(',')}
          </Text>
        </View>
      ) : null}

      <Pressable onPress={onCreate} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
        <Text style={styles.primaryText}>{busy ? 'Creating…' : 'Create course'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    opacity: 0.8,
    fontWeight: '600',
  },
  label: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.75,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    fontWeight: '700',
  },
  preview: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#999',
    gap: 6,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  previewLine: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.85,
  },
  primary: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2f80ed',
    alignItems: 'center',
  },
  primaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
});
