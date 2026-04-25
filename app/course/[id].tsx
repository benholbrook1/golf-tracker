import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/Themed';
import { db } from '@/db/client';
import { courseCombos, courseHoles, courseNines, courses, rounds } from '@/db/schema';
import { useCourseDetail } from '@/hooks/useCourses';
import { softDelete, withTimestamp } from '@/utils/timestamps';
import { and, count, eq, isNull } from 'drizzle-orm';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = id ?? '';
  const { data, loading, error, refresh } = useCourseDetail(courseId || null);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [comboEdits, setComboEdits] = useState<Record<string, { rating: string; slope: string }>>({});

  const syncFromData = useCallback(() => {
    if (!data) return;
    setName(data.course.name);
    const next: Record<string, { rating: string; slope: string }> = {};
    for (const c of data.combos) {
      next[c.id] = { rating: String(c.rating), slope: String(c.slope) };
    }
    setComboEdits(next);
  }, [data]);

  useEffect(() => {
    syncFromData();
  }, [syncFromData]);

  const onSave = async () => {
    if (!data) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a course name.');
      return;
    }
    setSaving(true);
    try {
      await db.update(courses).set(withTimestamp({ name: trimmed })).where(eq(courses.id, data.course.id));

      for (const c of data.combos) {
        const ed = comboEdits[c.id];
        if (!ed) continue;
        const rating = Number(ed.rating);
        const slope = Number(ed.slope);
        if (!Number.isFinite(rating) || !Number.isFinite(slope) || slope <= 0) {
          Alert.alert('Invalid rating/slope', `Check values for ${c.name}.`);
          return;
        }
        await db
          .update(courseCombos)
          .set(withTimestamp({ rating, slope: Math.round(slope) }))
          .where(eq(courseCombos.id, c.id));
      }

      await refresh();
      syncFromData();
      Alert.alert('Saved', 'Course updated.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!data) return;
    Alert.alert(
      'Delete course?',
      'This cannot be undone. You can only delete a course with no saved rounds at this course.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const [r] = await db
                .select({ n: count() })
                .from(rounds)
                .where(and(eq(rounds.courseId, data.course.id), isNull(rounds.deletedAt)));
              if (Number(r?.n ?? 0) > 0) {
                Alert.alert('Cannot delete', 'This course has saved rounds. Delete or keep those rounds first.');
                return;
              }
              const now = softDelete();
              for (const n of data.nines) {
                await db
                  .update(courseHoles)
                  .set(now)
                  .where(and(eq(courseHoles.nineId, n.id), isNull(courseHoles.deletedAt)));
              }
              await db
                .update(courseCombos)
                .set(now)
                .where(and(eq(courseCombos.courseId, data.course.id), isNull(courseCombos.deletedAt)));
              await db
                .update(courseNines)
                .set(now)
                .where(and(eq(courseNines.courseId, data.course.id), isNull(courseNines.deletedAt)));
              await db.update(courses).set(now).where(eq(courses.id, data.course.id));
              router.replace('/courses');
            } catch (e) {
              Alert.alert('Delete failed', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  };

  if (!courseId) {
    return (
      <View style={styles.center}>
        <Text>Missing course id</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error: {error ?? 'Course not found'}</Text>
        <Pressable onPress={() => router.back()} style={styles.btn}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit course</Text>
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={styles.input}
        placeholder="Course name"
        placeholderTextColor="#777"
        autoCapitalize="words"
      />

      {data.combos.length > 0 ? (
        <>
          <Text style={styles.label}>18-hole rated layouts</Text>
          <Text style={styles.hint}>Used for handicap differentials. Edit if your scorecard had placeholders.</Text>
          {data.combos.map((c) => {
            const ed = comboEdits[c.id] ?? { rating: String(c.rating), slope: String(c.slope) };
            return (
              <View key={c.id} style={styles.comboCard}>
                <Text style={styles.comboTitle}>{c.name}</Text>
                <View style={styles.row}>
                  <Text style={styles.mini}>Rating</Text>
                  <TextInput
                    style={styles.inputSmall}
                    keyboardType="decimal-pad"
                    value={ed.rating}
                    onChangeText={(t) => setComboEdits((m) => ({ ...m, [c.id]: { ...ed, rating: t } }))}
                    placeholder="72.0"
                  />
                  <Text style={styles.mini}>Slope</Text>
                  <TextInput
                    style={styles.inputSmall}
                    keyboardType="number-pad"
                    value={ed.slope}
                    onChangeText={(t) => setComboEdits((m) => ({ ...m, [c.id]: { ...ed, slope: t } }))}
                    placeholder="113"
                  />
                </View>
              </View>
            );
          })}
        </>
      ) : (
        <Text style={styles.muted}>No 18-hole rated combos (9-hole only or single loop).</Text>
      )}

      <Pressable onPress={onSave} disabled={saving} style={[styles.primary, saving && styles.disabled]}>
        <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>

      <Pressable onPress={onDelete} style={styles.danger}>
        <Text style={styles.dangerText}>Delete course</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900' },
  label: { fontSize: 14, fontWeight: '800', opacity: 0.8 },
  hint: { fontSize: 12, fontWeight: '600', opacity: 0.75 },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    padding: 12,
    fontSize: 17,
    fontWeight: '600',
  },
  comboCard: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 12, gap: 8 },
  comboTitle: { fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  mini: { fontSize: 13, fontWeight: '700' },
  inputSmall: {
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 10,
    padding: 8,
    fontWeight: '700',
  },
  primary: { backgroundColor: '#2f80ed', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '900' },
  danger: { borderWidth: 1, borderColor: '#c62828', borderRadius: 12, padding: 14, alignItems: 'center' },
  dangerText: { color: '#c62828', fontSize: 16, fontWeight: '800' },
  error: { color: '#c62828' },
  btn: { marginTop: 12, borderWidth: 1, borderColor: '#999', borderRadius: 12, padding: 12, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  muted: { opacity: 0.8, fontWeight: '600' },
});
