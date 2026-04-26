import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmScorecardParse } from '@/hooks/useCourseImport';
import { parseScorecardImage } from '@/utils/scorecardParser';
import type { ScorecardParseResult } from '@/utils/validators';
import { ScorecardParseSchema } from '@/utils/validators';
import { colors, radius, space, typography } from '@/theme/tokens';

type Step = 'pick' | 'parse' | 'review';

function mediaTypeFromPicker(t: string | undefined): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (t === 'image/png') return 'image/png';
  if (t === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

const inputStyle = {
  minHeight: 40,
  backgroundColor: colors.surfaceContainer,
  borderWidth: 1,
  borderColor: colors.outlineVariant,
  borderRadius: radius.md,
  paddingHorizontal: space[3],
  paddingVertical: space[2],
  fontSize: 15,
  fontWeight: '400' as const,
  color: colors.text,
};

export default function CourseScanScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedMime, setPickedMime] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [parse, setParse] = useState<ScorecardParseResult | null>(null);
  const [selectedTeeIndex, setSelectedTeeIndex] = useState(0);
  const parseStartedRef = useRef(false);

  const canConfirm = useMemo(() => {
    if (!parse || step !== 'review' || busy) return false;
    if (parse.courseName.trim().length === 0) return false;
    if (selectedTeeIndex < 0 || selectedTeeIndex >= parse.tees.length) return false;
    return true;
  }, [parse, step, busy, selectedTeeIndex]);

  const onPick = async () => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to scan a scorecard.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;
      setPickedUri(asset.uri);
      setPickedMime(mediaTypeFromPicker(asset.mimeType));
      parseStartedRef.current = false;
      setStep('parse');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 'parse' || !pickedUri || parseStartedRef.current) return;
    parseStartedRef.current = true;
    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        const base64 = await new File(pickedUri).base64();
        const parsed = await parseScorecardImage(base64, pickedMime);
        if (cancelled) return;
        setSelectedTeeIndex(0);
        setParse(parsed);
        setStep('review');
      } catch (e) {
        if (cancelled) return;
        Alert.alert('Parse failed', e instanceof Error ? e.message : String(e));
        setStep('pick');
        setPickedUri(null);
        setParse(null);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pickedMime, pickedUri, step]);

  const updateCourseName = (text: string) => {
    if (!parse) return;
    setParse({ ...parse, courseName: text });
  };

  const updatePar = (nineIdx: number, holeIdx: number, text: string) => {
    if (!parse) return;
    const n = Number(text);
    if (!Number.isFinite(n)) return;
    const next = JSON.parse(JSON.stringify(parse)) as ScorecardParseResult;
    next.nines[nineIdx]!.holes[holeIdx]!.par = n;
    setParse(next);
  };

  const updateYardage = (nineIdx: number, holeIdx: number, text: string) => {
    if (!parse) return;
    const next = JSON.parse(JSON.stringify(parse)) as ScorecardParseResult;
    const trimmed = text.trim();
    const y = trimmed.length === 0 ? null : Number(trimmed);
    if (trimmed.length > 0 && !Number.isFinite(y)) return;
    next.nines[nineIdx]!.holes[holeIdx]!.yardages[selectedTeeIndex] = y;
    setParse(next);
  };

  const updateHandicap = (nineIdx: number, holeIdx: number, text: string) => {
    if (!parse) return;
    const next = JSON.parse(JSON.stringify(parse)) as ScorecardParseResult;
    const trimmed = text.trim();
    next.nines[nineIdx]!.holes[holeIdx]!.handicap = trimmed.length === 0 ? null : Number(trimmed);
    setParse(next);
  };

  const onConfirm = async () => {
    if (!parse) return;
    setBusy(true);
    try {
      const checked = ScorecardParseSchema.safeParse(parse);
      if (!checked.success) {
        Alert.alert('Invalid data', 'Check course name, pars (3–6), yardages (0–2000 or blank), and handicap (1–18 or blank).');
        return;
      }
      const { courseId } = await confirmScorecardParse(checked.data, { selectedTeeIndex });
      Alert.alert('Saved', 'Course created from scorecard.', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/round/new', params: { courseId } }) },
      ]);
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('pick');
    setPickedUri(null);
    setParse(null);
  };

  return (
    <View style={styles.screen}>
      {/* Fixed header */}
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <RNText style={styles.backBtnText}>← Back</RNText>
        </Pressable>
        <RNText style={styles.headerTitle}>Scan scorecard</RNText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[8] }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Pick step */}
        {step === 'pick' ? (
          <View style={styles.pickCard}>
            <RNText style={styles.pickTitle}>Import from photo</RNText>
            <RNText style={styles.pickBody}>
              Choose a photo of a scorecard and we'll extract the hole layout automatically.
            </RNText>
            <Pressable
              onPress={onPick}
              disabled={busy}
              style={[styles.primaryBtn, styles.pickBtn, busy && styles.btnDisabled]}
            >
              <RNText style={styles.primaryBtnText}>{busy ? 'Working…' : 'Choose photo'}</RNText>
            </Pressable>
          </View>
        ) : null}

        {/* Parse step */}
        {step === 'parse' ? (
          <View style={styles.card}>
            <RNText style={styles.cardTitle}>Analysing scorecard…</RNText>
            <RNText style={styles.cardBody}>This may take a few seconds.</RNText>
            <Pressable onPress={reset} style={styles.outlineBtn}>
              <RNText style={styles.outlineBtnText}>Cancel</RNText>
            </Pressable>
          </View>
        ) : null}

        {/* Review step */}
        {step === 'review' && parse ? (
          <>
            {/* Course name */}
            <View style={styles.card}>
              <RNText style={styles.fieldLabel}>Course name</RNText>
              <TextInput
                value={parse.courseName}
                onChangeText={updateCourseName}
                style={styles.courseNameInput}
                placeholder="Course name"
                placeholderTextColor={colors.textDisabled}
                autoCorrect
                autoCapitalize="words"
              />
            </View>

            {/* Tee selector */}
            <View style={styles.card}>
              <RNText style={styles.fieldLabel}>Tee set</RNText>
              <RNText style={styles.cardBody}>
                {parse.tees.length} column{parse.tees.length !== 1 ? 's' : ''} detected. Select which to import as yardages.
              </RNText>
              <View style={styles.chipRow}>
                {parse.tees.map((tee, i) => (
                  <Pressable
                    key={`${tee}-${i}`}
                    onPress={() => setSelectedTeeIndex(i)}
                    style={[styles.chip, i === selectedTeeIndex && styles.chipOn]}
                  >
                    <RNText style={[styles.chipText, i === selectedTeeIndex && styles.chipTextOn]}>{tee}</RNText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Nines */}
            {parse.nines.map((nine, nineIdx) => (
              <View key={`${nine.name}-${nineIdx}`} style={styles.card}>
                <RNText style={styles.cardTitle}>{nine.name}</RNText>

                {/* Column headers */}
                <View style={styles.holeRowHeader}>
                  <RNText style={[styles.holeColLabel, styles.colHole]}>#</RNText>
                  <RNText style={[styles.holeColLabel, styles.colPar]}>Par</RNText>
                  <RNText style={[styles.holeColLabel, styles.colYards]}>
                    Yards ({parse.tees[selectedTeeIndex] ?? '—'})
                  </RNText>
                  <RNText style={[styles.holeColLabel, styles.colHcp]}>HCP</RNText>
                </View>

                <View style={styles.divider} />

                {nine.holes.map((h, holeIdx) => (
                  <View key={h.holeNumber} style={styles.holeRow}>
                    <RNText style={[styles.holeNum, styles.colHole]}>{h.holeNumber}</RNText>
                    <TextInput
                      keyboardType="number-pad"
                      value={String(h.par)}
                      onChangeText={(t) => updatePar(nineIdx, holeIdx, t)}
                      style={[styles.cellInput, styles.colPar]}
                      placeholderTextColor={colors.textDisabled}
                    />
                    <TextInput
                      keyboardType="number-pad"
                      value={h.yardages[selectedTeeIndex] == null ? '' : String(h.yardages[selectedTeeIndex])}
                      onChangeText={(t) => updateYardage(nineIdx, holeIdx, t)}
                      style={[styles.cellInput, styles.colYards]}
                      placeholder="—"
                      placeholderTextColor={colors.textDisabled}
                    />
                    <TextInput
                      keyboardType="number-pad"
                      value={h.handicap == null ? '' : String(h.handicap)}
                      onChangeText={(t) => updateHandicap(nineIdx, holeIdx, t)}
                      style={[styles.cellInput, styles.colHcp]}
                      placeholder="—"
                      placeholderTextColor={colors.textDisabled}
                    />
                  </View>
                ))}
              </View>
            ))}

            {/* Actions */}
            <Pressable
              onPress={onConfirm}
              disabled={!canConfirm}
              style={[styles.primaryBtn, !canConfirm && styles.btnDisabled]}
            >
              <RNText style={styles.primaryBtnText}>{busy ? 'Saving…' : 'Save course'}</RNText>
            </Pressable>

            <Pressable onPress={reset} style={styles.outlineBtn}>
              <RNText style={styles.outlineBtnText}>Start over</RNText>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },

  header: {
    backgroundColor: colors.surfaceBright,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { ...typography.headingM, color: colors.text },
  backBtn: { minWidth: 80 },
  backBtnText: { ...typography.labelM, color: colors.primary, fontWeight: '600', lineHeight: 20 },

  scroll: { flex: 1 },
  content: { padding: space[4], gap: space[4] },

  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[4],
    gap: space[3],
  },
  cardTitle: { ...typography.headingM, color: colors.text },
  cardBody: { ...typography.bodyS, color: colors.textMuted },
  fieldLabel: { fontSize: 12, fontWeight: '500', lineHeight: 16, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  pickCard: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[6],
    gap: space[4],
    alignItems: 'center',
  },
  pickTitle: { ...typography.headingM, color: colors.text },
  pickBody: { ...typography.bodyS, color: colors.textMuted, textAlign: 'center', paddingHorizontal: space[2] },
  pickBtn: { alignSelf: 'stretch', paddingHorizontal: space[6] },

  courseNameInput: {
    ...inputStyle,
    fontSize: 17,
    fontWeight: '600' as const,
    minHeight: 48,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
  },
  chipOn: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: colors.text },
  chipTextOn: { color: colors.primary },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },

  holeRowHeader: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  holeColLabel: { fontSize: 11, fontWeight: '500', lineHeight: 15, color: colors.textDisabled, textTransform: 'uppercase' },

  holeRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  holeNum: { fontSize: 14, fontWeight: '600', lineHeight: 18, color: colors.textMuted },

  colHole: { width: 28, textAlign: 'center' },
  colPar:  { width: 52 },
  colYards: { flex: 1 },
  colHcp:  { width: 52 },

  cellInput: { ...inputStyle, textAlign: 'center' },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600', lineHeight: 22, color: colors.onPrimary },

  outlineBtn: {
    borderRadius: radius.lg,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
  },
  outlineBtnText: { fontSize: 15, fontWeight: '500', lineHeight: 20, color: colors.text },

  btnDisabled: { opacity: 0.45 },
});
