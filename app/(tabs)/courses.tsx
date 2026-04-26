import { useCallback, useEffect, useRef, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { Link, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { Button, Card } from '@/components/ui';
import { getCourseImageSource } from '@/constants/courseImages';
import { useCourses } from '@/hooks/useCourses';
import { colors, radius, space, typography } from '@/theme/tokens';
import {
  GEMINI_MODEL_LABELS,
  GEMINI_MODEL_OPTIONS,
  clearStoredGeminiModel,
  getStoredGeminiModel,
  resolveGeminiModelForRequest,
  setStoredGeminiModel,
  type GeminiModelId,
} from '@/utils/geminiModelSettings';

export default function CoursesTab() {
  const { courses, loading, error, refresh } = useCourses();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickedGeminiModel, setPickedGeminiModel] = useState<GeminiModelId | null>(null);
  const [activeGeminiModel, setActiveGeminiModel] = useState<string>('');
  const insets = useSafeAreaInsets();
  const plusBtnRef = useRef<View>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await getStoredGeminiModel();
      setPickedGeminiModel(stored);
    })();
  }, []);

  const refreshGeminiModelState = useCallback(async () => {
    const stored = await getStoredGeminiModel();
    setPickedGeminiModel(stored);
    const resolved = await resolveGeminiModelForRequest();
    setActiveGeminiModel(resolved);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      void refreshGeminiModelState();
    }, [refresh, refreshGeminiModelState])
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space[4] }]}>
        <Text style={styles.title}>Courses</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              void refreshGeminiModelState().then(() => setSettingsOpen(true));
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            hitSlop={8}
            accessibilityLabel="Scorecard AI settings"
          >
            <FontAwesome name="cog" size={18} color={colors.primary} />
          </Pressable>
          <View
            ref={plusBtnRef}
            collapsable={false}
          >
            <Pressable
              onPress={() => {
                plusBtnRef.current?.measureInWindow((x, y, width, height) => {
                  setMenuPos({ top: y + height + 8, right: 0 });
                  setMenuOpen(true);
                });
              }}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              hitSlop={8}
              accessibilityLabel="Add course"
            >
              <FontAwesome name="plus" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ height: space[2] }} />

        {loading ? <Text style={styles.muted}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>Error: {error}</Text> : null}

        <View style={styles.list}>
          {courses.map((c) => (
            <Link key={c.id} href={`/course/${c.id}`} asChild>
              <Pressable>
                {({ pressed }) => (
                  <Card style={[styles.courseCard, pressed && styles.courseCardPressed]}>
                    <View style={styles.courseHero}>
                      <Image source={getCourseImageSource(c.imageKey)} style={styles.courseHeroImage} />
                      <View style={styles.courseHeroOverlay} />
                    </View>
                    <View style={styles.courseRow}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={styles.courseName}>{c.name}</Text>
                        <View style={styles.courseMetaRow}>
                          <View style={styles.pill}>
                            <Text style={styles.pillText}>
                              {c.roundCount} round{c.roundCount === 1 ? '' : 's'}
                            </Text>
                          </View>
                          {c.parTotal != null ? (
                            <View style={styles.pill}>
                              <Text style={styles.pillText}>Par {c.parTotal}</Text>
                            </View>
                          ) : null}
                          {c.difficulty != null ? (
                            <View style={[styles.pill, styles.pillPrimary]}>
                              <Text style={[styles.pillText, styles.pillPrimaryText]}>
                                Difficulty {c.difficulty}/5
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <FontAwesome name="chevron-right" size={16} color={colors.textDisabled} />
                    </View>
                  </Card>
                )}
              </Pressable>
            </Link>
          ))}
          {!loading && courses.length === 0 ? (
            <Card>
              <Text style={styles.emptyTitle}>No courses yet</Text>
              <Text style={styles.emptyBody}>Add one by scanning a scorecard or entering details manually.</Text>
              <View style={styles.row}>
                <Link href="/course/scan" asChild>
                  <Button title="Scan scorecard" variant="primary" />
                </Link>
                <Link href="/course/new" asChild>
                  <Button title="Add manually" variant="secondary" />
                </Link>
              </View>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.settingsModalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)} />
          <View
            style={[
              styles.settingsSheet,
              { marginTop: insets.top + space[6], maxHeight: '85%' as const },
            ]}
          >
          <Text style={styles.settingsTitle}>Scorecard AI</Text>
          <Text style={styles.settingsHint}>
            Uses your Gemini API key from the app build. Choose which model parses scorecard photos.
          </Text>
          <Text style={styles.settingsActive}>
            Active model: <Text style={styles.settingsActiveMono}>{activeGeminiModel || '…'}</Text>
          </Text>
          <ScrollView style={styles.settingsList} keyboardShouldPersistTaps="handled">
            {GEMINI_MODEL_OPTIONS.map((id) => {
              const on = pickedGeminiModel === id;
              return (
                <Pressable
                  key={id}
                  onPress={async () => {
                    await setStoredGeminiModel(id);
                    setPickedGeminiModel(id);
                    setActiveGeminiModel(id);
                  }}
                  style={({ pressed }) => [
                    styles.settingsRow,
                    pressed && styles.settingsRowPressed,
                    on && styles.settingsRowOn,
                  ]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.settingsRowLabel}>{GEMINI_MODEL_LABELS[id]}</Text>
                    <Text style={styles.settingsRowId} numberOfLines={1}>
                      {id}
                    </Text>
                  </View>
                  {on ? <FontAwesome name="check" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {pickedGeminiModel ? (
            <Pressable
              onPress={async () => {
                await clearStoredGeminiModel();
                setPickedGeminiModel(null);
                const resolved = await resolveGeminiModelForRequest();
                setActiveGeminiModel(resolved);
              }}
              style={styles.clearPick}
            >
              <Text style={styles.clearPickText}>Clear app choice (use .env or default)</Text>
            </Pressable>
          ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMenuOpen(false);
        }}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
        <View
          style={[
            styles.menu,
            (menuPos
              ? { top: menuPos.top, right: space[4] }
              : { top: insets.top + 80, right: space[4] }) as ViewStyle,
          ]}
        >
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              router.push('/course/scan');
            }}
          >
            <Text style={styles.menuItemText} numberOfLines={1}>Scan scorecard</Text>
            <View style={styles.menuIconSlot}>
              <FontAwesome name="camera" size={16} color={colors.textMuted} />
            </View>
          </Pressable>
          <Pressable
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => {
              setMenuOpen(false);
              router.push('/course/new');
            }}
          >
            <Text style={styles.menuItemText} numberOfLines={1}>Add manually</Text>
            <View style={styles.menuIconSlot}>
              <FontAwesome name="pencil" size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { padding: space[4], gap: space[4], paddingBottom: 40, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  title: { ...typography.headingXl, color: colors.text },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },

  settingsModalRoot: { flex: 1, justifyContent: 'flex-start' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: { opacity: 0.75 },

  settingsSheet: {
    marginHorizontal: space[4],
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[5],
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  settingsTitle: { ...typography.headingM, color: colors.text, marginBottom: space[2] },
  settingsHint: { ...typography.bodyS, color: colors.textMuted, marginBottom: space[3] },
  settingsActive: { ...typography.labelS, color: colors.text, marginBottom: space[3] },
  settingsActiveMono: { fontFamily: 'SpaceMono', fontSize: 12, color: colors.primary },
  settingsList: { maxHeight: 320 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: space[2],
    backgroundColor: colors.surface,
  },
  settingsRowPressed: { opacity: 0.85 },
  settingsRowOn: { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
  settingsRowLabel: { ...typography.bodyS, color: colors.text, fontWeight: '600' },
  settingsRowId: { ...typography.labelS, color: colors.textMuted },
  clearPick: { paddingVertical: space[3], alignItems: 'center' },
  clearPickText: { ...typography.bodyS, color: colors.primary, fontWeight: '600' },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.10)' },
  menu: {
    position: 'absolute',
    width: 220,
    backgroundColor: colors.surfaceBright,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  menuItem: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemText: { ...typography.bodyS, color: colors.text, fontWeight: '600', flex: 1, flexShrink: 1, minWidth: 0 },
  menuIconSlot: { width: 24, alignItems: 'flex-end' },

  list: { gap: 12 },

  courseCard: { padding: space[5], overflow: 'hidden' },
  courseHero: {
    height: 88,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  courseHeroImage: { width: '100%', height: '100%' },
  courseHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.10)' },
  courseCardPressed: { borderColor: colors.outline, shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  courseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  courseName: { ...typography.headingM, color: colors.text },
  courseMetaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.surfaceContainer },
  pillText: { ...typography.labelS, color: colors.textMuted },
  pillPrimary: { backgroundColor: colors.primaryContainer },
  pillPrimaryText: { color: colors.onPrimaryContainer },

  emptyTitle: { ...typography.headingM, color: colors.text },
  emptyBody: { ...typography.bodyS, color: colors.textMuted },

  error: { color: colors.error, fontWeight: '700' },
  muted: { ...typography.bodyS, color: colors.textMuted },
});
