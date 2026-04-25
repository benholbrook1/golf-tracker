import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { Text } from '@/components/Themed';
import { useCourses } from '@/hooks/useCourses';

export default function CoursesTab() {
  const { courses, loading, error, refresh } = useCourses();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Courses</Text>
      <Text style={styles.subtitle}>Your saved facilities. Edit rating and slope for handicaps when needed.</Text>

      <View style={styles.row}>
        <Link href="/course/scan" asChild>
          <Pressable style={styles.secondary}>
            <Text style={styles.secondaryText}>Scan scorecard</Text>
          </Pressable>
        </Link>
        <Link href="/course/new" asChild>
          <Pressable style={styles.secondary}>
            <Text style={styles.secondaryText}>Add manually</Text>
          </Pressable>
        </Link>
      </View>

      {loading ? <Text style={styles.muted}>Loading…</Text> : null}
      {error ? <Text style={styles.error}>Error: {error}</Text> : null}

      <View style={styles.list}>
        {courses.map((c) => (
          <Link key={c.id} href={`/course/${c.id}`} asChild>
            <Pressable style={styles.item}>
              <Text style={styles.itemText}>{c.name}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
        ))}
        {!loading && courses.length === 0 ? <Text style={styles.empty}>No courses yet. Add one to start tracking rounds.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 14, fontWeight: '600', opacity: 0.85 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2f80ed',
  },
  secondaryText: { color: '#2f80ed', fontWeight: '800' },
  list: { gap: 8, marginTop: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#999',
  },
  itemText: { fontSize: 16, fontWeight: '800', flex: 1 },
  chevron: { fontSize: 22, opacity: 0.4, fontWeight: '300' },
  error: { color: '#c62828' },
  empty: { fontSize: 15, fontWeight: '600', opacity: 0.8 },
  muted: { fontWeight: '600', opacity: 0.7 },
});
