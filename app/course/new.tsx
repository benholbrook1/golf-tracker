import { createId } from '@paralleldrive/cuid2';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { STOCK_COURSE_IMAGE_KEYS, type StockCourseImageKey, stockCourseImages } from '@/constants/courseImages';
import { db } from '@/db/client';
import { courseHoles, courseNines, courses } from '@/db/schema';
import { colors, radius, space, typography } from '@/theme/tokens';

const inputBodyM = { fontSize: typography.bodyM.fontSize, fontWeight: typography.bodyM.fontWeight } as const;

export default function NewCourseScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [imageKey, setImageKey] = useState<StockCourseImageKey>('stock-golf-1');

  const onCreate = async () => {
    const name = courseName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a name for the course.');
      return;
    }
    setBusy(true);
    try {
      const [course] = await db
        .insert(courses)
        .values({ id: createId(), name, imageKey })
        .returning();
      if (!course) throw new Error('Failed to create course');

      const nineId = createId();
      await db.insert(courseNines).values({ id: nineId, courseId: course.id, name: 'Front 9' });
      await db.insert(courseHoles).values(
        Array.from({ length: 9 }, (_, i) => ({
          id: createId(),
          nineId,
          holeNumber: i + 1,
          par: 4,
        }))
      );

      router.replace(`/course/${course.id}`);
    } catch (e) {
      Alert.alert('Could not create course', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          hitSlop={8}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New course</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[8] }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Course name */}
        <View style={styles.field}>
          <Text style={styles.label}>Course name</Text>
          <TextInput
            value={courseName}
            onChangeText={setCourseName}
            placeholder="e.g. Maple Grove GC"
            placeholderTextColor={colors.textDisabled}
            style={styles.input}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onCreate}
          />
        </View>

        {/* Image */}
        <View style={styles.field}>
          <Text style={styles.label}>Course image</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageRow}
          >
            {STOCK_COURSE_IMAGE_KEYS.map((k) => {
              const on = imageKey === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setImageKey(k)}
                  style={[styles.imageChip, on && styles.imageChipOn]}
                >
                  <Image source={stockCourseImages[k]} style={styles.imageThumb} />
                  {on ? <View style={styles.imageCheckBadge}><Text style={styles.imageCheckText}>✓</Text></View> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Text style={styles.hint}>
          Tees, nines, and hole details can be added after creation.
        </Text>

        <Pressable
          onPress={onCreate}
          disabled={busy}
          style={[styles.createBtn, busy && styles.createBtnDisabled]}
        >
          <Text style={styles.createBtnText}>{busy ? 'Creating…' : 'Create course'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    backgroundColor: colors.surfaceBright,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    gap: space[3],
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  backBtnPressed: { opacity: 0.6 },
  backBtnText: { ...typography.labelM, color: colors.text },
  headerTitle: { ...typography.headingM, color: colors.text, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 70 }, // mirrors back button width

  content: { padding: space[4], gap: space[5] },

  field: { gap: space[2] },
  label: { ...typography.labelM, color: colors.textMuted },

  input: {
    height: 48,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    ...inputBodyM,
    color: colors.text,
  },

  imageRow: { flexDirection: 'row', gap: space[3], paddingVertical: space[1] },
  imageChip: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  imageChipOn: { borderColor: colors.primary },
  imageThumb: { width: 88, height: 64 },
  imageCheckBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCheckText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },

  hint: { ...typography.bodyS, color: colors.textMuted },

  createBtn: {
    paddingVertical: 15,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { fontSize: 16, fontWeight: '700', lineHeight: 24, color: colors.onPrimary },
});
