import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text } from '@/components/Themed';
import { useCourses, useCourseDetail } from '@/hooks/useCourses';
import { db } from '@/db/client';
import { roundNines, rounds } from '@/db/schema';
import { colors, radius, space, typography } from '@/theme/tokens';

type Selection =
  | { type: 'combo'; comboId: string; frontNineId: string; backNineId: string; label: string }
  | { type: 'nine'; nineId: string; label: string };

function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function NewRoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NewRoundInner />
    </>
  );
}

function NewRoundInner() {
  const { courseId: preselectCourseId } = useLocalSearchParams<{ courseId?: string }>();
  const { courses, loading, error, refresh } = useCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const courseDetail = useCourseDetail(selectedCourseId);
  const { refresh: refreshCourseDetail } = courseDetail;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedTeeId, setSelectedTeeId] = useState<string | null>(null);
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
      if (selectedCourseId) refreshCourseDetail();
    }, [refresh, selectedCourseId, refreshCourseDetail]),
  );

  useEffect(() => {
    if (!courseDetail.data) return;
    const preferred = courseDetail.data.course.defaultTeeId ?? courseDetail.data.tees[0]?.id ?? null;
    setSelectedTeeId(preferred);
  }, [courseDetail.data?.course.id]);

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
    const teeId = selectedTeeId ?? courseDetail.data?.course.defaultTeeId ?? courseDetail.data?.tees[0]?.id ?? null;
    if (!teeId) {
      Alert.alert('Select tee', 'Pick the tee you played from.');
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      if (selection.type === 'combo') {
        const inserted = await db
          .insert(rounds)
          .values({ courseId: selectedCourseId, comboId: selection.comboId, teeId, date: toLocalYMD(roundDate), totalScore: 0 })
          .returning();
        const round = inserted[0]!;
        await db.insert(roundNines).values([
          { roundId: round.id, nineId: selection.frontNineId, nineOrder: 1 },
          { roundId: round.id, nineId: selection.backNineId, nineOrder: 2 },
        ]);
        router.replace(`/round/${round.id}/play?hole=1`);
      } else {
        const inserted = await db
          .insert(rounds)
          .values({ courseId: selectedCourseId, comboId: null, teeId, date: toLocalYMD(roundDate), totalScore: 0 })
          .returning();
        const round = inserted[0]!;
        await db.insert(roundNines).values([{ roundId: round.id, nineId: selection.nineId, nineOrder: 1 }]);
        router.replace(`/round/${round.id}/play?hole=1`);
      }
    } catch (e) {
      Alert.alert('Failed to create round', e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const canStart = !!selectedCourseId && !!selection && !creating;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <FontAwesome name="chevron-left" size={16} color={colors.text} />
        </Pressable>
        <RNText style={styles.headerTitle}>New round</RNText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Date ── */}
        <View style={styles.section}>
          <RNText style={styles.sectionLabel}>Date</RNText>
          <Pressable
            onPress={() => setShowDatePicker((s) => !s)}
            style={({ pressed }) => [styles.dateBtn, pressed && styles.dateBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Choose round date"
          >
            <FontAwesome name="calendar" size={15} color={colors.textMuted} />
            <RNText style={styles.dateBtnText}>{formatDateLabel(roundDate)}</RNText>
            <RNText style={styles.dateBtnSub}>{toLocalYMD(roundDate)}</RNText>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={roundDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(_, d) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (d) { d.setHours(0, 0, 0, 0); setRoundDate(d); }
              }}
            />
          ) : null}
        </View>

        {/* ── Course ── */}
        <View style={styles.section}>
          <RNText style={styles.sectionLabel}>Course</RNText>
          {loading ? (
            <Text style={styles.mutedText}>Loading courses…</Text>
          ) : error ? (
            <Text style={styles.errorText}>Error: {error}</Text>
          ) : courses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No courses yet. Add one first.</Text>
              <View style={styles.emptyRow}>
                <Pressable style={styles.smallBtn} onPress={() => router.push('/course/scan')}>
                  <RNText style={styles.smallBtnText}>Scan scorecard</RNText>
                </Pressable>
                <Pressable style={styles.smallBtn} onPress={() => router.push('/course/new')}>
                  <RNText style={styles.smallBtnText}>Add manually</RNText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.optionList}>
              {courses.map((c) => {
                const selected = selectedCourseId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => { setSelectedCourseId(c.id); setSelection(null); }}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                  >
                    <View style={[styles.optionRadio, selected && styles.optionRadioSelected]}>
                      {selected ? <View style={styles.optionRadioDot} /> : null}
                    </View>
                    <RNText style={[styles.optionText, selected && styles.optionTextSelected]}>{c.name}</RNText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ── What you're playing ── */}
        {selectedCourseId ? (
          <View style={styles.section}>
            <RNText style={styles.sectionLabel}>What you're playing</RNText>
            <RNText style={styles.sectionHint}>18-hole configs are rated for handicap. 9-hole rounds are unrated.</RNText>
            {courseDetail.loading ? (
              <Text style={styles.mutedText}>Loading options…</Text>
            ) : courseDetail.error ? (
              <Text style={styles.errorText}>Error: {courseDetail.error}</Text>
            ) : selections.length === 0 ? (
              <Text style={styles.mutedText}>No nines or configs found for this course.</Text>
            ) : (
              <View style={styles.optionList}>
                {selections.map((s) => {
                  const key = s.type === 'combo' ? `combo-${s.comboId}` : `nine-${s.nineId}`;
                  const selected =
                    selection?.type === s.type &&
                    (s.type === 'combo'
                      ? (selection as any).comboId === s.comboId
                      : (selection as any).nineId === s.nineId);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSelection(s)}
                      style={[styles.optionCard, selected && styles.optionCardSelected]}
                    >
                      <View style={[styles.optionRadio, selected && styles.optionRadioSelected]}>
                        {selected ? <View style={styles.optionRadioDot} /> : null}
                      </View>
                      <View style={styles.optionCardBody}>
                        <RNText style={[styles.optionText, selected && styles.optionTextSelected]}>
                          {s.label}
                        </RNText>
                        <RNText style={styles.optionBadge}>
                          {s.type === 'combo' ? '18 holes' : '9 holes'}
                        </RNText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* ── Tee ── */}
        {selectedCourseId && courseDetail.data?.tees.length ? (
          <View style={styles.section}>
            <RNText style={styles.sectionLabel}>Tee</RNText>
            <View style={styles.teeRow}>
              {courseDetail.data.tees.map((t) => {
                const selected = (selectedTeeId ?? courseDetail.data?.course.defaultTeeId) === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setSelectedTeeId(t.id)}
                    style={[styles.teeChip, selected && styles.teeChipSelected]}
                  >
                    <RNText style={[styles.teeChipText, selected && styles.teeChipTextSelected]}>{t.name}</RNText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── Start button ── */}
        <Pressable
          onPress={onCreateRound}
          disabled={!canStart}
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
        >
          <RNText style={styles.startBtnText}>{creating ? 'Creating…' : 'Start round'}</RNText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: colors.surfaceBright,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    gap: space[3],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', lineHeight: 22, color: colors.text },
  headerSpacer: { width: 36 },

  scroll: { flex: 1 },
  content: { padding: space[4], gap: space[6], paddingBottom: space[12] },

  section: { gap: space[3] },
  sectionLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHint: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: colors.textMuted, marginTop: -space[1] },

  mutedText: { ...typography.bodyS, color: colors.textMuted },
  errorText: { ...typography.bodyS, color: colors.error },

  // Date
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  dateBtnPressed: { backgroundColor: colors.surfaceContainer },
  dateBtnText: { flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 22, color: colors.text },
  dateBtnSub: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: colors.textMuted },

  // Option cards (course / combo / nine)
  optionList: { gap: space[2] },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioSelected: { borderColor: colors.primary },
  optionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  optionCardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontSize: 15, fontWeight: '500', lineHeight: 22, color: colors.text },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  optionBadge: { fontSize: 12, fontWeight: '500', lineHeight: 16, color: colors.textMuted },

  // Tee chips
  teeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  teeChip: {
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBright,
  },
  teeChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
  teeChipText: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: colors.text },
  teeChipTextSelected: { color: colors.primary, fontWeight: '600' },

  // Empty state
  emptyCard: {
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBright,
  },
  emptyCardText: { ...typography.bodyS, color: colors.textMuted },
  emptyRow: { flexDirection: 'row', gap: space[2] },
  smallBtn: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  smallBtnText: { fontSize: 13, fontWeight: '600', lineHeight: 18, color: colors.primary },

  // Start button
  startBtn: {
    paddingVertical: 15,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { fontSize: 16, fontWeight: '700', lineHeight: 24, color: colors.onPrimary },
});
