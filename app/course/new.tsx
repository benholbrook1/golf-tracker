import { createId } from '@paralleldrive/cuid2';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/Themed';
import { db } from '@/db/client';
import { courseCombos, courseHoleTeeYardages, courseHoles, courseNines, courseTees, courses } from '@/db/schema';
import { withTimestamp } from '@/utils/timestamps';
import { eq } from 'drizzle-orm';

const DEFAULT_FRONT_PARS = [4, 3, 5, 4, 3, 4, 5, 4, 3] as const;
const DEFAULT_BACK_PARS = [4, 5, 3, 4, 4, 5, 3, 4, 4] as const;

type TeeForm = { key: string; name: string };
type HoleForm = { par: string; handicap: string; notes: string; yardages: string[] };
type NineForm = { key: string; name: string; holes: HoleForm[] };

function defaultHoles(pars: readonly number[], teeCount: number): HoleForm[] {
  return pars.map((p) => ({
    par: String(p),
    handicap: '',
    notes: '',
    yardages: Array.from({ length: teeCount }, () => ''),
  }));
}

function coerceInt(s: string, fallback: number): number {
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export default function ManualCourseScreen() {
  const [busy, setBusy] = useState(false);
  const [courseName, setCourseName] = useState('');

  const [tees, setTees] = useState<TeeForm[]>([{ key: createId(), name: 'Default' }]);
  const [defaultTeeIdx, setDefaultTeeIdx] = useState(0);

  const [nines, setNines] = useState<NineForm[]>([
    { key: createId(), name: 'Front 9', holes: defaultHoles(DEFAULT_FRONT_PARS, 1) },
    { key: createId(), name: 'Back 9', holes: defaultHoles(DEFAULT_BACK_PARS, 1) },
  ]);

  const canAddNine = nines.length < 3;
  const canRemoveNine = nines.length > 1;

  const onAddTee = () => {
    setTees((t) => [...t, { key: createId(), name: `Tee ${t.length + 1}` }]);
    setNines((ns) =>
      ns.map((n) => ({
        ...n,
        holes: n.holes.map((h) => ({ ...h, yardages: [...h.yardages, ''] })),
      }))
    );
  };

  const onRemoveTee = (idx: number) => {
    if (tees.length <= 1) return;
    setTees((t) => t.filter((_, i) => i !== idx));
    setNines((ns) =>
      ns.map((n) => ({
        ...n,
        holes: n.holes.map((h) => ({ ...h, yardages: h.yardages.filter((_, i) => i !== idx) })),
      }))
    );
    setDefaultTeeIdx((cur) => {
      if (cur === idx) return 0;
      if (cur > idx) return cur - 1;
      return cur;
    });
  };

  const onAddNine = () => {
    if (!canAddNine) return;
    setNines((ns) => [
      ...ns,
      { key: createId(), name: `Nine ${ns.length + 1}`, holes: defaultHoles(DEFAULT_FRONT_PARS, tees.length) },
    ]);
  };

  const onRemoveNine = (idx: number) => {
    if (!canRemoveNine) return;
    setNines((ns) => ns.filter((_, i) => i !== idx));
  };

  const computedCombosPreview = useMemo(() => {
    if (nines.length < 2) return [];
    const ids = nines.map((n) => n.key);
    if (ids.length === 2) return [{ front: ids[0]!, back: ids[1]!, name: '18 Holes' }];
    if (ids.length === 3)
      return [
        { front: ids[0]!, back: ids[1]!, name: 'A + B' },
        { front: ids[0]!, back: ids[2]!, name: 'A + C' },
        { front: ids[1]!, back: ids[2]!, name: 'B + C' },
      ];
    return [];
  }, [nines]);

  const onCreate = async () => {
    const name = courseName.trim();
    if (!name) {
      Alert.alert('Missing name', 'Enter a course name.');
      return;
    }
    const teeNames = tees.map((t) => t.name.trim()).filter(Boolean);
    if (teeNames.length !== tees.length) {
      Alert.alert('Tees', 'Each tee needs a name.');
      return;
    }
    const nineNames = nines.map((n) => n.name.trim()).filter(Boolean);
    if (nineNames.length !== nines.length) {
      Alert.alert('Nines', 'Each nine needs a name.');
      return;
    }

    setBusy(true);
    try {
      const [course] = await db.insert(courses).values({ name }).returning();
      if (!course) throw new Error('Failed to create course');

      const teeRows = await db
        .insert(courseTees)
        .values(
          tees.map((t, i) => ({
            id: createId(),
            courseId: course.id,
            name: t.name.trim(),
            sortOrder: i,
            isDefault: i === defaultTeeIdx,
          }))
        )
        .returning();

      const defaultTee = teeRows[defaultTeeIdx] ?? teeRows[0];
      if (!defaultTee) throw new Error('Failed to create tees');

      await db.update(courses).set(withTimestamp({ defaultTeeId: defaultTee.id })).where(eq(courses.id, course.id));

      const nineRows = await db
        .insert(courseNines)
        .values(
          nines.map((n) => ({
            id: createId(),
            courseId: course.id,
            name: n.name.trim(),
          }))
        )
        .returning();

      const nineIdByIndex = nineRows.map((n) => n.id);

      // Holes
      const holeInserts: Array<(typeof courseHoles.$inferInsert) & { id: string }> = [];
      const perHoleYardage: Array<{ nineIdx: number; holeIdx: number; holeId: string }> = [];
      for (let ni = 0; ni < nines.length; ni++) {
        const nine = nines[ni]!;
        for (let hi = 0; hi < 9; hi++) {
          const hf = nine.holes[hi]!;
          const par = coerceInt(hf.par, 4);
          if (par < 3 || par > 6) throw new Error(`Invalid par for nine ${ni + 1} hole ${hi + 1}`);
          const handicapRaw = hf.handicap.trim();
          const handicap = handicapRaw === '' ? null : coerceInt(handicapRaw, 0);
          if (handicap != null && (handicap < 1 || handicap > 18)) {
            throw new Error(`Invalid handicap for nine ${ni + 1} hole ${hi + 1}`);
          }

          const holeId = createId();
          const yardsDefaultRaw = hf.yardages[defaultTeeIdx]?.trim() ?? '';
          const yardsDefault = yardsDefaultRaw === '' ? null : coerceInt(yardsDefaultRaw, 0);

          holeInserts.push({
            id: holeId,
            nineId: nineIdByIndex[ni]!,
            holeNumber: hi + 1,
            par,
            handicap,
            yards: yardsDefault,
            notes: hf.notes.trim() === '' ? null : hf.notes.trim(),
          });
          perHoleYardage.push({ nineIdx: ni, holeIdx: hi, holeId });
        }
      }

      await db.insert(courseHoles).values(holeInserts);

      // Per-tee yardages
      for (const ref of perHoleYardage) {
        const hf = nines[ref.nineIdx]!.holes[ref.holeIdx]!;
        for (let ti = 0; ti < teeRows.length; ti++) {
          const tr = teeRows[ti]!;
          const raw = hf.yardages[ti]?.trim() ?? '';
          const yards = raw === '' ? null : coerceInt(raw, 0);
          await db.insert(courseHoleTeeYardages).values({
            id: createId(),
            courseHoleId: ref.holeId,
            courseTeeId: tr.id,
            yards,
          });
        }
      }

      // Default combos (same behavior as scan import; rating/slope can be edited later on the course screen)
      const defaultRating = 72.0;
      const defaultSlope = 113;
      if (nineRows.length === 2) {
        await db.insert(courseCombos).values({
          id: createId(),
          courseId: course.id,
          name: '18 Holes',
          frontNineId: nineRows[0]!.id,
          backNineId: nineRows[1]!.id,
          rating: defaultRating,
          slope: defaultSlope,
        });
      }
      if (nineRows.length === 3) {
        const [a, b, c] = nineRows;
        await db.insert(courseCombos).values([
          { id: createId(), courseId: course.id, name: 'A + B', frontNineId: a!.id, backNineId: b!.id, rating: defaultRating, slope: defaultSlope },
          { id: createId(), courseId: course.id, name: 'A + C', frontNineId: a!.id, backNineId: c!.id, rating: defaultRating, slope: defaultSlope },
          { id: createId(), courseId: course.id, name: 'B + C', frontNineId: b!.id, backNineId: c!.id, rating: defaultRating, slope: defaultSlope },
        ]);
      }

      router.replace({ pathname: '/round/new', params: { courseId: course.id } });
    } catch (e) {
      Alert.alert('Create failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Manual course</Text>
      <Text style={styles.subtitle}>Enter the same info you’d get from scanning a scorecard.</Text>

      <Text style={styles.section}>Course</Text>
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={courseName}
        onChangeText={setCourseName}
        placeholder="e.g. Maple Grove GC"
        style={styles.input}
        placeholderTextColor="#777"
        autoCapitalize="words"
      />

      <Text style={styles.section}>Tees</Text>
      <Text style={styles.hint}>Add tee names and pick the default tee (used for the main yards field).</Text>
      {tees.map((t, idx) => (
        <View key={t.key} style={styles.row}>
          <TextInput
            value={t.name}
            onChangeText={(txt) => setTees((ts) => ts.map((x, i) => (i === idx ? { ...x, name: txt } : x)))}
            style={styles.inputFlex}
            placeholder={`Tee ${idx + 1}`}
            placeholderTextColor="#777"
          />
          <Pressable onPress={() => setDefaultTeeIdx(idx)} style={[styles.chip, defaultTeeIdx === idx && styles.chipOn]}>
            <Text style={[styles.chipText, defaultTeeIdx === idx && styles.chipTextOn]}>
              {defaultTeeIdx === idx ? 'Default' : 'Set'}
            </Text>
          </Pressable>
          <Pressable onPress={() => onRemoveTee(idx)} disabled={tees.length <= 1} style={styles.deleteChip}>
            <Text style={styles.deleteChipText}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={onAddTee} style={styles.secondary} disabled={busy}>
        <Text style={styles.secondaryText}>Add tee</Text>
      </Pressable>

      <Text style={styles.section}>Nines</Text>
      <Text style={styles.hint}>You can add up to 3 nines. Each nine has 9 holes.</Text>
      {nines.map((n, ni) => (
        <View key={n.key} style={styles.block}>
          <View style={styles.row}>
            <Text style={styles.blockTitle}>Nine {ni + 1}</Text>
            <Pressable onPress={() => onRemoveNine(ni)} disabled={!canRemoveNine} style={styles.smallDanger}>
              <Text style={styles.smallDangerText}>Remove</Text>
            </Pressable>
          </View>
          <TextInput
            value={n.name}
            onChangeText={(txt) => setNines((ns) => ns.map((x, i) => (i === ni ? { ...x, name: txt } : x)))}
            style={styles.input}
            placeholder="Nine name"
            placeholderTextColor="#777"
          />

          <Text style={styles.subSection}>Holes</Text>
          {n.holes.map((h, hi) => (
            <View key={`${n.key}-${hi}`} style={styles.holeCard}>
              <Text style={styles.holeTitle}>Hole {hi + 1}</Text>
              <View style={styles.holeRow}>
                <Text style={styles.mini}>Par</Text>
                <TextInput
                  value={h.par}
                  onChangeText={(txt) =>
                    setNines((ns) =>
                      ns.map((x, i) =>
                        i === ni ? { ...x, holes: x.holes.map((hh, j) => (j === hi ? { ...hh, par: txt } : hh)) } : x
                      )
                    )
                  }
                  style={styles.tiny}
                  keyboardType="number-pad"
                />
                <Text style={styles.mini}>HCP</Text>
                <TextInput
                  value={h.handicap}
                  onChangeText={(txt) =>
                    setNines((ns) =>
                      ns.map((x, i) =>
                        i === ni ? { ...x, holes: x.holes.map((hh, j) => (j === hi ? { ...hh, handicap: txt } : hh)) } : x
                      )
                    )
                  }
                  style={styles.tiny}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor="#999"
                />
              </View>

              {tees.map((t, ti) => (
                <View key={`${n.key}-${hi}-${t.key}`} style={styles.holeRow}>
                  <Text style={styles.mini} numberOfLines={1}>
                    {t.name.trim() || `Tee ${ti + 1}`} yds
                  </Text>
                  <TextInput
                    value={h.yardages[ti] ?? ''}
                    onChangeText={(txt) =>
                      setNines((ns) =>
                        ns.map((x, i) =>
                          i === ni
                            ? {
                                ...x,
                                holes: x.holes.map((hh, j) =>
                                  j === hi
                                    ? { ...hh, yardages: hh.yardages.map((yv, k) => (k === ti ? txt : yv)) }
                                    : hh
                                ),
                              }
                            : x
                        )
                      )
                    }
                    style={styles.yards}
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor="#999"
                  />
                </View>
              ))}

              <Text style={styles.mini}>Notes</Text>
              <TextInput
                value={h.notes}
                onChangeText={(txt) =>
                  setNines((ns) =>
                    ns.map((x, i) =>
                      i === ni ? { ...x, holes: x.holes.map((hh, j) => (j === hi ? { ...hh, notes: txt } : hh)) } : x
                    )
                  )
                }
                style={styles.notes}
                placeholder="Optional notes for this hole"
                placeholderTextColor="#999"
              />
            </View>
          ))}
        </View>
      ))}

      {canAddNine ? (
        <Pressable onPress={onAddNine} style={styles.secondary} disabled={busy}>
          <Text style={styles.secondaryText}>Add nine</Text>
        </Pressable>
      ) : null}

      {computedCombosPreview.length ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>18-hole configs that will be created</Text>
          {computedCombosPreview.map((c) => (
            <Text key={c.name} style={styles.previewLine}>
              {c.name}
            </Text>
          ))}
        </View>
      ) : null}

      <Pressable onPress={onCreate} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
        <Text style={styles.primaryText}>{busy ? 'Creating…' : 'Create course'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { opacity: 0.8, fontWeight: '600' },
  section: { marginTop: 10, fontSize: 16, fontWeight: '900' },
  subSection: { marginTop: 10, fontSize: 14, fontWeight: '900', opacity: 0.85 },
  label: { marginTop: 6, fontSize: 14, fontWeight: '800', opacity: 0.75 },
  hint: { fontSize: 12, fontWeight: '600', opacity: 0.75, lineHeight: 18 },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    fontWeight: '700',
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999',
    fontWeight: '700',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#999' },
  chipOn: { backgroundColor: '#2f80ed', borderColor: '#2f80ed' },
  chipText: { fontSize: 12, fontWeight: '900' },
  chipTextOn: { color: '#fff' },
  deleteChip: { paddingHorizontal: 10, paddingVertical: 8 },
  deleteChipText: { fontSize: 16, color: '#c62828', fontWeight: '900' },
  secondary: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2f80ed',
  },
  secondaryText: { color: '#2f80ed', fontWeight: '900' },
  block: { marginTop: 6, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, gap: 8 },
  blockTitle: { fontSize: 14, fontWeight: '900' },
  smallDanger: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#c62828' },
  smallDangerText: { color: '#c62828', fontWeight: '900' },
  holeCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 10, gap: 6 },
  holeTitle: { fontSize: 13, fontWeight: '900' },
  holeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mini: { fontSize: 12, fontWeight: '800', opacity: 0.7, minWidth: 54 },
  tiny: { width: 54, borderWidth: 1, borderColor: '#999', borderRadius: 10, padding: 8, fontWeight: '800' },
  yards: { flex: 1, minWidth: 110, borderWidth: 1, borderColor: '#999', borderRadius: 10, padding: 8, fontWeight: '800' },
  notes: { borderWidth: 1, borderColor: '#999', borderRadius: 10, padding: 10, minHeight: 54, fontWeight: '600' },
  preview: { marginTop: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#999', gap: 6 },
  previewTitle: { fontSize: 14, fontWeight: '900' },
  previewLine: { fontSize: 13, fontWeight: '700', opacity: 0.85 },
  primary: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2f80ed',
    alignItems: 'center',
  },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
