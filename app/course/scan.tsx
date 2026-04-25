import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';

import { Text } from '@/components/Themed';
import { confirmScorecardParse } from '@/hooks/useCourseImport';
import { parseScorecardImage } from '@/utils/scorecardParser';
import type { ScorecardParseResult } from '@/utils/validators';
import { ScorecardParseSchema } from '@/utils/validators';

type Step = 'pick' | 'parse' | 'review';

function mediaTypeFromPicker(t: string | undefined): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (t === 'image/png') return 'image/png';
  if (t === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

export default function CourseScanScreen() {
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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

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
    if (step !== 'parse') return;
    if (!pickedUri) return;
    if (parseStartedRef.current) return;
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

    return () => {
      cancelled = true;
    };
  }, [pickedMime, pickedUri, step]);

  const updateCourseName = (text: string) => {
    if (!parse) return;
    const next = { ...parse, courseName: text };
    setParse(next);
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
        Alert.alert(
          'Invalid data',
          'Check course name, pars (3–6), one yardage per tee column (0–2000 or empty), and handicap (1–18 or empty).'
        );
        return;
      }

      await confirmScorecardParse(checked.data, { selectedTeeIndex });
      Alert.alert('Saved', 'Course created from scorecard.', [{ text: 'OK', onPress: () => router.replace('/round/new') }]);
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Scan scorecard</Text>
      <Text style={styles.subtitle}>
        Parses using either `EXPO_PUBLIC_SCORECARD_LLM_PROXY_URL` (preferred) or a personal-phone MVP path with
        `EXPO_PUBLIC_GEMINI_API_KEY` (+ optional `EXPO_PUBLIC_GEMINI_MODEL`). Nothing is written to SQLite until you confirm.
      </Text>

      {step === 'pick' ? (
        <Pressable onPress={onPick} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
          <Text style={styles.primaryText}>{busy ? 'Working…' : 'Choose photo'}</Text>
        </Pressable>
      ) : null}

      {step === 'parse' ? (
        <View style={styles.block}>
          <Text style={styles.label}>Parsing…</Text>
          <Text style={styles.mono}>{pickedUri}</Text>
          <Pressable
            onPress={() => {
              setStep('pick');
              setPickedUri(null);
              setParse(null);
            }}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Start over</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'review' && parse ? (
        <View style={styles.block}>
          <Text style={styles.label}>Course name (saved to database)</Text>
          <TextInput
            value={parse.courseName}
            onChangeText={updateCourseName}
            style={styles.courseNameInput}
            placeholder="Course name"
            placeholderTextColor="#777"
            autoCorrect
            autoCapitalize="words"
          />

          <Text style={styles.label}>Tee set for this course</Text>
          <Text style={styles.teeHelp}>
            Parsed {parse.tees.length} column{parse.tees.length === 1 ? '' : 's'}. Choose which set to store as yardages when you play. You can still edit values below.
          </Text>
          <View style={styles.teeRow}>
            {parse.tees.map((tee, i) => (
              <Pressable
                key={`${tee}-${i}`}
                onPress={() => setSelectedTeeIndex(i)}
                style={[styles.teeChip, i === selectedTeeIndex && styles.teeChipActive]}
              >
                <Text style={[styles.teeChipText, i === selectedTeeIndex && styles.teeChipTextActive]}>{tee}</Text>
              </Pressable>
            ))}
          </View>

          {parse.nines.map((nine, nineIdx) => (
            <View key={`${nine.name}-${nineIdx}`} style={styles.nine}>
              <Text style={styles.nineTitle}>{nine.name}</Text>
              {nine.holes.map((h, holeIdx) => (
                <View key={h.holeNumber} style={styles.holeRow}>
                  <Text style={styles.holeNo}>#{h.holeNumber}</Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={String(h.par)}
                    onChangeText={(t) => updatePar(nineIdx, holeIdx, t)}
                    style={styles.input}
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    placeholder={`Yards (${parse.tees[selectedTeeIndex] ?? 'tee'})`}
                    keyboardType="number-pad"
                    value={h.yardages[selectedTeeIndex] == null ? '' : String(h.yardages[selectedTeeIndex])}
                    onChangeText={(t) => updateYardage(nineIdx, holeIdx, t)}
                    style={styles.inputWide}
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    placeholder="HI"
                    keyboardType="number-pad"
                    value={h.handicap == null ? '' : String(h.handicap)}
                    onChangeText={(t) => updateHandicap(nineIdx, holeIdx, t)}
                    style={styles.inputWide}
                    placeholderTextColor="#777"
                  />
                </View>
              ))}
            </View>
          ))}

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                setStep('parse');
                setParse(null);
              }}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Back</Text>
            </Pressable>

            <Pressable onPress={onConfirm} disabled={!canConfirm} style={[styles.primary, !canConfirm && styles.disabled]}>
              <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Confirm to database'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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
    fontWeight: '900',
  },
  subtitle: {
    opacity: 0.8,
    fontWeight: '600',
  },
  block: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.75,
  },
  mono: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.75,
  },
  courseNameInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    fontSize: 18,
    fontWeight: '800',
  },
  teeHelp: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  teeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#999',
    backgroundColor: 'transparent',
  },
  teeChipActive: {
    backgroundColor: '#2f80ed',
    borderColor: '#2f80ed',
  },
  teeChipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  teeChipTextActive: {
    color: 'white',
  },
  nine: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#999',
    gap: 8,
  },
  nineTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  holeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  holeNo: {
    width: 34,
    fontWeight: '900',
  },
  input: {
    width: 52,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#999',
    fontWeight: '800',
  },
  inputWide: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#999',
    fontWeight: '700',
  },
  actions: {
    marginTop: 12,
    gap: 10,
  },
  primary: {
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
  secondary: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
});
