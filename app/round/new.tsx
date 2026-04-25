import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/Themed';
import { useCourses, useCourseDetail } from '@/hooks/useCourses';
import { db } from '@/db/client';
import { roundNines, rounds } from '@/db/schema';

type Selection =
  | { type: 'combo'; comboId: string; frontNineId: string; backNineId: string; label: string }
  | { type: 'nine'; nineId: string; label: string };

function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NewRoundScreen() {
  const { courseId: preselectCourseId } = useLocalSearchParams<{ courseId?: string }>();
  const { courses, loading, error, refresh } = useCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const courseDetail = useCourseDetail(selectedCourseId);
  const { refresh: refreshCourseDetail } = courseDetail;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [creating, setCreating] = useState(false);
  const [roundDate, setRoundDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (preselectCourseId && typeof preselectCourseId === 'string') {
      setSelectedCourseId(preselectCourseId);
    }
  }, [preselectCourseId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (selectedCourseId) {
        refreshCourseDetail();
      }
    }, [refresh, selectedCourseId, refreshCourseDetail])
  );

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
            date: toLocalYMD(roundDate),
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
            date: toLocalYMD(roundDate),
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
      <Text style={styles.title}>New round</Text>
      <Text style={styles.lede}>When and where you played, then the side or 18 you are scoring.</Text>

      {loading ? <Text>Loading courses…</Text> : null}
      {error ? <Text style={styles.error}>Error: {error}</Text> : null}

      <Text style={styles.sectionTitle}>Date</Text>
      <Pressable
        onPress={() => setShowDatePicker(true)}
        style={styles.dateButton}
        accessibilityRole="button"
        accessibilityLabel="Choose round date"
      >
        <Text style={styles.dateButtonText}>{toLocalYMD(roundDate)}</Text>
        <Text style={styles.dateHint}>{Platform.OS === 'android' ? 'Tap to change' : ''}</Text>
      </Pressable>
      {showDatePicker ? (
        <DateTimePicker
          value={roundDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            if (Platform.OS === 'android') setShowDatePicker(false);
            if (d) {
              d.setHours(0, 0, 0, 0);
              setRoundDate(d);
            }
          }}
        />
      ) : null}
      <Pressable onPress={() => setShowDatePicker((s) => !s)}>
        <Text style={styles.linkish}>{showDatePicker ? 'Hide' : 'Change date'}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Course</Text>
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
        {courses.length === 0 && !loading ? (
          <View style={styles.emptyCourse}>
            <Text style={styles.emptyCourseText}>Add a course first (scan a scorecard or create a default layout).</Text>
            <View style={styles.emptyRow}>
              <Link href="/course/scan" asChild>
                <Pressable style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Scan</Text>
                </Pressable>
              </Link>
              <Link href="/course/new" asChild>
                <Pressable style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Manual</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>What you are playing</Text>
      <Text style={styles.hint}>
        18: uses a stored front/back pair. 9: one side only. You can fix rating and slope under Courses.
      </Text>
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
  lede: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.85,
    lineHeight: 20,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: { fontSize: 17, fontWeight: '800' },
  dateHint: { fontSize: 13, opacity: 0.6, fontWeight: '600' },
  linkish: { fontSize: 14, fontWeight: '800', color: '#2f80ed' },
  hint: { fontSize: 13, fontWeight: '600', opacity: 0.75, lineHeight: 18 },
  emptyCourse: { gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' },
  emptyCourseText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  emptyRow: { flexDirection: 'row', gap: 10 },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#2f80ed',
  },
  smallBtnText: { color: 'white', fontWeight: '800' },
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

