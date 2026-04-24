import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/Themed';
import { useCourses, useCourseDetail } from '@/hooks/useCourses';
import { db } from '@/db/client';
import { roundNines, rounds } from '@/db/schema';

type Selection =
  | { type: 'combo'; comboId: string; frontNineId: string; backNineId: string; label: string }
  | { type: 'nine'; nineId: string; label: string };

function todayISODate(): string {
  return new Date().toISOString().split('T')[0]!;
}

export default function NewRoundScreen() {
  const { courses, loading, error } = useCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const courseDetail = useCourseDetail(selectedCourseId);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [creating, setCreating] = useState(false);

  const selections = useMemo(() => {
    if (!courseDetail.data) return [];
    const { combos, nines } = courseDetail.data;

    const comboItems: Selection[] = combos.map((c) => ({
      type: 'combo',
      comboId: c.id,
      frontNineId: c.frontNineId,
      backNineId: c.backNineId,
      label: c.name,
    }));

    const nineItems: Selection[] = nines.map((n) => ({
      type: 'nine',
      nineId: n.id,
      label: n.name,
    }));

    return [...comboItems, ...nineItems];
  }, [courseDetail.data]);

  const onCreateRound = async () => {
    if (!selectedCourseId || !selection) return;
    if (creating) return;

    setCreating(true);
    try {
      if (selection.type === 'combo') {
        const inserted = await db
          .insert(rounds)
          .values({
            courseId: selectedCourseId,
            comboId: selection.comboId,
            date: todayISODate(),
            totalScore: 0,
          })
          .returning();

        const round = inserted[0]!;
        await db.insert(roundNines).values([
          { roundId: round.id, nineId: selection.frontNineId, nineOrder: 1 },
          { roundId: round.id, nineId: selection.backNineId, nineOrder: 2 },
        ]);

        router.replace(`/round/${round.id}/hole/1`);
      } else {
        const inserted = await db
          .insert(rounds)
          .values({
            courseId: selectedCourseId,
            comboId: null,
            date: todayISODate(),
            totalScore: 0,
          })
          .returning();

        const round = inserted[0]!;
        await db.insert(roundNines).values([{ roundId: round.id, nineId: selection.nineId, nineOrder: 1 }]);

        router.replace(`/round/${round.id}/hole/1`);
      }
    } catch (e) {
      Alert.alert('Failed to create round', e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>New Round</Text>

      {loading ? <Text>Loading courses…</Text> : null}
      {error ? <Text style={styles.error}>Error: {error}</Text> : null}

      <Text style={styles.sectionTitle}>1) Choose course</Text>
      <View style={styles.list}>
        {courses.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => {
              setSelectedCourseId(c.id);
              setSelection(null);
            }}
            style={[styles.item, selectedCourseId === c.id && styles.itemSelected]}
          >
            <Text style={styles.itemText}>{c.name}</Text>
          </Pressable>
        ))}
        {courses.length === 0 && !loading ? <Text>No courses yet. Run seed or add scanner later.</Text> : null}
      </View>

      <Text style={styles.sectionTitle}>2) Choose 18-hole combo or 9-hole nine</Text>
      {courseDetail.loading ? <Text>Loading options…</Text> : null}
      {courseDetail.error ? <Text style={styles.error}>Error: {courseDetail.error}</Text> : null}

      <View style={styles.list}>
        {selections.map((s) => {
          const key = s.type === 'combo' ? `combo-${s.comboId}` : `nine-${s.nineId}`;
          const selected =
            selection?.type === s.type &&
            (s.type === 'combo'
              ? (selection as any).comboId === s.comboId
              : (selection as any).nineId === s.nineId);

          return (
            <Pressable key={key} onPress={() => setSelection(s)} style={[styles.item, selected && styles.itemSelected]}>
              <Text style={styles.itemText}>{s.type === 'combo' ? `18: ${s.label}` : `9: ${s.label}`}</Text>
            </Pressable>
          );
        })}
        {selectedCourseId && selections.length === 0 && !courseDetail.loading ? (
          <Text>No nines/combos found for this course.</Text>
        ) : null}
      </View>

      <Pressable
        onPress={onCreateRound}
        disabled={!selectedCourseId || !selection || creating}
        style={[styles.primaryButton, (!selectedCourseId || !selection || creating) && styles.primaryButtonDisabled]}
      >
        <Text style={styles.primaryButtonText}>{creating ? 'Creating…' : 'Start round'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#999',
  },
  itemSelected: {
    borderColor: '#2f80ed',
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2f80ed',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: '#c62828',
  },
});

