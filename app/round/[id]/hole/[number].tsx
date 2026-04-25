import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/Themed';
import { HoleEntry } from '@/components/HoleEntry';
import { useRound } from '@/hooks/useRound';
import type { HoleScoreInput } from '@/utils/validators';

export default function HoleScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <HoleScreenInner />
    </>
  );
}

function HoleScreenInner() {
  const params = useLocalSearchParams<{ id?: string; number?: string }>();
  const roundId = params.id ?? null;
  const holeNumberGlobal = params.number ? Number(params.number) : NaN;

  const { round, roundNines, yardageByCourseHoleId, loading, error, saveHole } = useRound(roundId);

  const resolved = useMemo(() => {
    if (!Number.isFinite(holeNumberGlobal) || holeNumberGlobal < 1) return null;
    if (!round || roundNines.length === 0) return null;

    const maxGlobal = roundNines.length * 9;
    if (holeNumberGlobal > maxGlobal) return null;
    const nineOrder = Math.ceil(holeNumberGlobal / 9);
    const holeNumberWithinNine = ((holeNumberGlobal - 1) % 9) + 1;

    const rn = roundNines.find((n) => n.nineOrder === nineOrder);
    if (!rn) return null;

    const courseHole = rn.courseHoles.find((h) => h.holeNumber === holeNumberWithinNine);
    if (!courseHole) return null;

    const existing = rn.holes.find((hs) => hs.holeNumber === holeNumberWithinNine) ?? null;

    return {
      rn,
      courseHole,
      existing,
      holeNumberWithinNine,
      maxGlobal,
    };
  }, [holeNumberGlobal, round, roundNines]);

  const onSave = async (data: HoleScoreInput) => {
    if (!resolved) return;
    await saveHole(resolved.rn.id, resolved.courseHole.id, resolved.holeNumberWithinNine, data);

    const next = holeNumberGlobal + 1;
    if (next <= resolved.maxGlobal) {
      router.replace(`/round/${roundId}/hole/${next}`);
    } else {
      router.replace(`/round/${roundId}/summary`);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (error || !round || !resolved) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Error: {error ?? 'Unable to resolve hole.'}</Text>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const prev = holeNumberGlobal - 1;
  const next = holeNumberGlobal + 1;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Hole {holeNumberGlobal}</Text>
      <Text style={styles.subtitle}>
        {round.date}
        {round.tee ? ` · ${round.tee.name}` : ''}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          Yards:{' '}
          {yardageByCourseHoleId.get(resolved.courseHole.id) ??
            resolved.courseHole.yards ??
            '—'}
        </Text>
        <Text style={styles.metaText}>HCP: {resolved.courseHole.handicap ?? '—'}</Text>
      </View>
      {resolved.courseHole.notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{resolved.courseHole.notes}</Text>
        </View>
      ) : null}

      <HoleEntry
        par={resolved.courseHole.par}
        initial={
          resolved.existing
            ? {
                strokes: resolved.existing.strokes,
                putts: resolved.existing.putts,
                fairwayHit: resolved.existing.fairwayHit,
                gir: resolved.existing.gir,
                penalties: resolved.existing.penalties,
              }
            : undefined
        }
        onSave={onSave}
      />

      <View style={styles.nav}>
        <Pressable
          onPress={() => {
            if (prev < 1) return;
            router.replace(`/round/${roundId}/hole/${prev}`);
          }}
          disabled={prev < 1}
          style={[styles.navBtn, prev < 1 && styles.navBtnDisabled]}
        >
          <Text style={styles.navBtnText}>Prev</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (next <= resolved.maxGlobal) {
              router.replace(`/round/${roundId}/hole/${next}`);
            } else {
              router.replace(`/round/${roundId}/summary`);
            }
          }}
          style={styles.navBtn}
          onLongPress={() => {
            Alert.alert('Jump', 'Go to summary?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Summary', onPress: () => router.replace(`/round/${roundId}/summary`) },
            ]);
          }}
        >
          <Text style={styles.navBtnText}>{next <= resolved.maxGlobal ? 'Next' : 'Summary'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    opacity: 0.8,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaText: { fontWeight: '700', opacity: 0.8 },
  notesBox: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, gap: 6 },
  notesLabel: { fontSize: 12, fontWeight: '900', opacity: 0.7 },
  notesText: { fontSize: 14, fontWeight: '600', opacity: 0.85 },
  nav: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  back: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: '#c62828',
  },
});

