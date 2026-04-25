import { createId } from '@paralleldrive/cuid2';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/Themed';
import { db } from '@/db/client';
import {
  courseCombos,
  courseHoleTeeYardages,
  courseHoles,
  courseNines,
  courseTees,
  courses,
  rounds,
} from '@/db/schema';
import { useCourseDetail } from '@/hooks/useCourses';
import { softDelete, withTimestamp } from '@/utils/timestamps';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';

type HoleEdit = {
  par: string;
  handicap: string;
  notes: string;
  /** teeId → yards as string (empty = null) */
  yards: Record<string, string>;
};

type ComboEdit = { name: string; rating: string; slope: string };

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = id ?? '';
  const { data, loading, error, refresh } = useCourseDetail(courseId || null);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [defaultTeeId, setDefaultTeeId] = useState<string | null>(null);
  const [teeNameById, setTeeNameById] = useState<Record<string, string>>({});
  const [newTeeName, setNewTeeName] = useState('');
  const [nineNameById, setNineNameById] = useState<Record<string, string>>({});
  const [holeEdits, setHoleEdits] = useState<Record<string, HoleEdit>>({});
  const [comboEdits, setComboEdits] = useState<Record<string, ComboEdit>>({});
  const [newFrontId, setNewFrontId] = useState<string>('');
  const [newBackId, setNewBackId] = useState<string>('');
  const [newComboName, setNewComboName] = useState('18 Holes');
  const [newComboRating, setNewComboRating] = useState('72.0');
  const [newComboSlope, setNewComboSlope] = useState('113');
  const comboPickerInit = useRef(false);

  const syncFromData = useCallback(() => {
    if (!data) return;
    setName(data.course.name);
    setDefaultTeeId(data.course.defaultTeeId ?? data.tees[0]?.id ?? null);
    const names: Record<string, string> = {};
    for (const t of data.tees) {
      names[t.id] = t.name;
    }
    setTeeNameById(names);

    const nines: Record<string, string> = {};
    for (const n of data.nines) {
      nines[n.id] = n.name;
    }
    setNineNameById(nines);

    const holes: Record<string, HoleEdit> = {};
    for (const n of data.nines) {
      for (const h of n.holes) {
        const yMap = data.yardageByHoleTee.get(h.id) ?? new Map();
        const yards: Record<string, string> = {};
        for (const t of data.tees) {
          const v = yMap.get(t.id);
          yards[t.id] = v == null || v === 0 ? '' : String(v);
        }
        holes[h.id] = {
          par: String(h.par),
          handicap: h.handicap == null ? '' : String(h.handicap),
          notes: h.notes ?? '',
          yards,
        };
      }
    }
    setHoleEdits(holes);

    const ce: Record<string, ComboEdit> = {};
    for (const c of data.combos) {
      ce[c.id] = { name: c.name, rating: String(c.rating), slope: String(c.slope) };
    }
    setComboEdits(ce);
  }, [data]);

  useEffect(() => {
    syncFromData();
  }, [syncFromData]);

  useEffect(() => {
    comboPickerInit.current = false;
  }, [courseId]);

  useEffect(() => {
    if (!data || data.nines.length < 2 || comboPickerInit.current) return;
    setNewFrontId(data.nines[0]!.id);
    setNewBackId(data.nines[1]!.id);
    comboPickerInit.current = true;
  }, [data]);

  const onSave = async () => {
    if (!data) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a course name.');
      return;
    }
    if (data.tees.length === 0) {
      Alert.alert('Tees', 'Add at least one tee before saving.');
      return;
    }
    const defTee = defaultTeeId && data.tees.some((t) => t.id === defaultTeeId) ? defaultTeeId : data.tees[0]!.id;

    for (const c of data.combos) {
      const ed = comboEdits[c.id];
      if (!ed) continue;
      const rating = Number(ed.rating);
      const slope = Number(ed.slope);
      if (!ed.name.trim()) {
        Alert.alert('Validation', 'Each 18-hole configuration needs a name.');
        return;
      }
      if (!Number.isFinite(rating) || !Number.isFinite(slope) || slope <= 0) {
        Alert.alert('Invalid rating/slope', `Check values for “${c.name}”.`);
        return;
      }
    }

    setSaving(true);
    try {
      await db
        .update(courses)
        .set(
          withTimestamp({
            name: trimmed,
            defaultTeeId: defTee,
          })
        )
        .where(eq(courses.id, data.course.id));

      for (let i = 0; i < data.tees.length; i++) {
        const t = data.tees[i]!;
        const label = (teeNameById[t.id] ?? t.name).trim() || 'Tee';
        await db
          .update(courseTees)
          .set(
            withTimestamp({
              name: label,
              sortOrder: i,
              isDefault: t.id === defTee,
            })
          )
          .where(eq(courseTees.id, t.id));
      }

      for (const n of data.nines) {
        const nName = (nineNameById[n.id] ?? n.name).trim() || 'Nine';
        await db
          .update(courseNines)
          .set(withTimestamp({ name: nName }))
          .where(eq(courseNines.id, n.id));
      }

      for (const c of data.combos) {
        const ed = comboEdits[c.id];
        if (!ed) continue;
        await db
          .update(courseCombos)
          .set(
            withTimestamp({
              name: ed.name.trim(),
              rating: Number(ed.rating),
              slope: Math.round(Number(ed.slope)),
            })
          )
          .where(eq(courseCombos.id, c.id));
      }

      const yardRows = await db
        .select()
        .from(courseHoleTeeYardages)
        .where(
          and(
            inArray(
              courseHoleTeeYardages.courseHoleId,
              data.nines.flatMap((n) => n.holes.map((h) => h.id))
            ),
            isNull(courseHoleTeeYardages.deletedAt)
          )
        );
      const yKey = (holeId: string, teeId: string) => `${holeId}::${teeId}`;
      const yMap = new Map(yardRows.map((r) => [yKey(r.courseHoleId, r.courseTeeId), r]));

      for (const n of data.nines) {
        for (const h of n.holes) {
          const he = holeEdits[h.id];
          if (!he) continue;
          const par = Number(he.par);
          if (!Number.isInteger(par) || par < 3 || par > 6) {
            throw new Error(`Invalid par for hole ${h.holeNumber}`);
          }
          const hcp = he.handicap.trim() === '' ? null : Number(he.handicap);
          if (hcp != null && (!Number.isInteger(hcp) || hcp < 1)) {
            throw new Error(`Invalid stroke index for hole ${h.holeNumber}`);
          }

          let mainYards: number | null = null;
          const dEdit = he.yards[defTee]?.trim() ?? '';
          if (dEdit !== '') {
            const y = Number(dEdit);
            if (!Number.isFinite(y) || y < 0) {
              throw new Error(`Invalid yards (default tee) for hole ${h.holeNumber}`);
            }
            mainYards = Math.round(y);
          }

          await db
            .update(courseHoles)
            .set(
              withTimestamp({
                par,
                handicap: hcp,
                notes: he.notes.trim() === '' ? null : he.notes.trim(),
                yards: mainYards,
              })
            )
            .where(eq(courseHoles.id, h.id));

          for (const t of data.tees) {
            const raw = he.yards[t.id]?.trim() ?? '';
            const yards: number | null = raw === '' ? null : Math.round(Number(raw));
            if (raw !== '' && (!Number.isFinite(yards!) || (yards as number) < 0)) {
              throw new Error(`Invalid yards for ${t.name} on hole ${h.holeNumber}`);
            }
            const k = yKey(h.id, t.id);
            const row = yMap.get(k);
            if (row) {
              await db
                .update(courseHoleTeeYardages)
                .set(withTimestamp({ yards }))
                .where(eq(courseHoleTeeYardages.id, row.id));
            } else {
              await db.insert(courseHoleTeeYardages).values({
                id: createId(),
                courseHoleId: h.id,
                courseTeeId: t.id,
                yards,
              });
            }
          }
        }
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

  const onAddTee = async () => {
    if (!data) return;
    const label = newTeeName.trim();
    if (!label) {
      Alert.alert('Tee name', 'Enter a name for the new tee.');
      return;
    }
    setSaving(true);
    try {
      const sortOrder =
        data.tees.length > 0 ? Math.max(...data.tees.map((t) => t.sortOrder), 0) + 1 : 0;
      const isFirst = data.tees.length === 0;
      const [row] = await db
        .insert(courseTees)
        .values({
          id: createId(),
          courseId: data.course.id,
          name: label,
          sortOrder,
          isDefault: isFirst,
        })
        .returning();
      if (!row) return;

      if (isFirst) {
        await db
          .update(courses)
          .set(withTimestamp({ defaultTeeId: row.id }))
          .where(eq(courses.id, data.course.id));
        setDefaultTeeId(row.id);
      }

      const defTee =
        data.course.defaultTeeId ?? data.tees.find((t) => t.isDefault)?.id ?? data.tees[0]?.id;
      for (const n of data.nines) {
        for (const h of n.holes) {
          let y: number | null = null;
          if (!isFirst && defTee) {
            const raw = holeEdits[h.id]?.yards[defTee]?.trim() ?? '';
            y = raw === '' || raw === '—' ? null : Math.round(Number(raw));
            if (raw !== '' && raw !== '—' && !Number.isFinite(y!)) y = null;
          }
          await db.insert(courseHoleTeeYardages).values({
            id: createId(),
            courseHoleId: h.id,
            courseTeeId: row.id,
            yards: y,
          });
        }
      }
      setNewTeeName('');
      await refresh();
    } catch (e) {
      Alert.alert('Could not add tee', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteTee = (teeId: string) => {
    if (!data) return;
    if (data.tees.length <= 1) {
      Alert.alert('Keep one tee', 'A course needs at least one tee for yardages.');
      return;
    }
    Alert.alert('Delete tee?', 'Yardage rows for this tee will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const now = softDelete();
            await db
              .update(courseHoleTeeYardages)
              .set(now)
              .where(
                and(eq(courseHoleTeeYardages.courseTeeId, teeId), isNull(courseHoleTeeYardages.deletedAt))
              );
            await db
              .update(courseTees)
              .set(now)
              .where(eq(courseTees.id, teeId));

            let nextDef = data.course.defaultTeeId;
            if (nextDef === teeId) {
              const remain = data.tees.filter((t) => t.id !== teeId);
              const pick = remain[0];
              if (pick) {
                nextDef = pick.id;
                for (const t of remain) {
                  await db
                    .update(courseTees)
                    .set(
                      withTimestamp({ isDefault: t.id === pick.id })
                    )
                    .where(eq(courseTees.id, t.id));
                }
                await db
                  .update(courses)
                  .set(withTimestamp({ defaultTeeId: pick.id }))
                  .where(eq(courses.id, data.course.id));
                setDefaultTeeId(pick.id);
              }
            }
            await refresh();
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : String(e));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const onAddCombo = async () => {
    if (!data) return;
    if (data.nines.length < 2) {
      Alert.alert('Need two nines', 'Add a second nine before creating 18-hole configurations.');
      return;
    }
    if (!newFrontId || !newBackId) {
      Alert.alert('Pick nines', 'Select a front and a back nine.');
      return;
    }
    const nm = newComboName.trim() || '18 Holes';
    const rating = Number(newComboRating);
    const slope = Math.round(Number(newComboSlope));
    if (!Number.isFinite(rating) || !Number.isFinite(slope) || slope <= 0) {
      Alert.alert('Rating / slope', 'Enter valid numbers.');
      return;
    }
    setSaving(true);
    try {
      await db.insert(courseCombos).values({
        id: createId(),
        courseId: data.course.id,
        name: nm,
        frontNineId: newFrontId,
        backNineId: newBackId,
        rating,
        slope,
      });
      setNewComboName('18 Holes');
      setNewComboRating('72.0');
      setNewComboSlope('113');
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('constraint')) {
        Alert.alert('Already exists', 'A configuration with this front and back nine is already saved. Edit the name and rating in the list above.');
        return;
      }
      Alert.alert('Could not add', msg);
    } finally {
      setSaving(false);
    }
  };

  const onDeleteCombo = (comboId: string) => {
    if (!data) return;
    Alert.alert('Delete configuration?', '18-hole layouts used by saved rounds cannot be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const [r] = await db
              .select({ n: count() })
              .from(rounds)
              .where(and(eq(rounds.comboId, comboId), isNull(rounds.deletedAt)));
            if (Number(r?.n ?? 0) > 0) {
              Alert.alert('Cannot delete', 'This configuration has saved rounds.');
              return;
            }
            await db.update(courseCombos).set(softDelete()).where(eq(courseCombos.id, comboId));
            await refresh();
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : String(e));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
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
              const allHoleIds = data.nines.flatMap((n) => n.holes.map((h) => h.id));
              if (allHoleIds.length > 0) {
                await db
                  .update(courseHoleTeeYardages)
                  .set(now)
                  .where(
                    and(
                      inArray(courseHoleTeeYardages.courseHoleId, allHoleIds),
                      isNull(courseHoleTeeYardages.deletedAt)
                    )
                  );
              }
              for (const t of data.tees) {
                await db
                  .update(courseTees)
                  .set(now)
                  .where(and(eq(courseTees.id, t.id), isNull(courseTees.deletedAt)));
              }
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

  const setHole = (holeId: string, patch: Partial<HoleEdit>) => {
    setHoleEdits((m) => {
      const base = m[holeId];
      if (!base) return m;
      if (patch.yards) {
        return { ...m, [holeId]: { ...base, yards: { ...base.yards, ...patch.yards } } };
      }
      return { ...m, [holeId]: { ...base, ...patch } };
    });
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

      <Text style={styles.sectionTitle}>Tees & default</Text>
      <Text style={styles.hint}>Default tee drives the main “yards” on each hole for scoring; set per-tee yardages below.</Text>
      {data.tees.length === 0 ? (
        <Text style={styles.muted}>No tees yet. Add the first (e.g. “Blue”, “White”).</Text>
      ) : null}
      {data.tees.map((t) => (
        <View key={t.id} style={styles.teeRow}>
          <TextInput
            value={teeNameById[t.id] ?? t.name}
            onChangeText={(tName) => setTeeNameById((m) => ({ ...m, [t.id]: tName }))}
            style={styles.teeNameInput}
            placeholder="Tee name"
            placeholderTextColor="#777"
          />
          <Pressable
            onPress={() => setDefaultTeeId(t.id)}
            style={[styles.chip, defaultTeeId === t.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, defaultTeeId === t.id && styles.chipTextOn]}>
              {defaultTeeId === t.id ? 'Default' : 'Set default'}
            </Text>
          </Pressable>
          <Pressable onPress={() => onDeleteTee(t.id)} style={styles.teeDelete}>
            <Text style={styles.teeDeleteText}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.addTeeRow}>
        <TextInput
          value={newTeeName}
          onChangeText={setNewTeeName}
          style={styles.inputFlex}
          placeholder="New tee name"
          placeholderTextColor="#777"
        />
        <Pressable onPress={onAddTee} style={styles.secondary} disabled={saving}>
          <Text style={styles.secondaryText}>Add tee</Text>
        </Pressable>
      </View>

      {data.nines.map((n) => (
        <View key={n.id} style={styles.nineBlock}>
          <Text style={styles.sectionTitle}>Nine: name</Text>
          <TextInput
            value={nineNameById[n.id] ?? n.name}
            onChangeText={(t) => setNineNameById((m) => ({ ...m, [n.id]: t }))}
            style={styles.input}
            placeholder="e.g. Pine / West"
            placeholderTextColor="#777"
          />
          {n.holes.map((h) => {
            const he = holeEdits[h.id];
            if (!he) return null;
            return (
              <View key={h.id} style={styles.holeCard}>
                <View style={styles.holeRow}>
                  <Text style={styles.holeNo}>H{h.holeNumber}</Text>
                  <Text style={styles.mini}>Par</Text>
                  <TextInput
                    style={styles.tinyIn}
                    keyboardType="number-pad"
                    value={he.par}
                    onChangeText={(t) => setHole(h.id, { par: t })}
                  />
                  <Text style={styles.mini}>HCP</Text>
                  <TextInput
                    style={styles.tinyIn}
                    keyboardType="number-pad"
                    value={he.handicap}
                    onChangeText={(t) => setHole(h.id, { handicap: t })}
                  />
                </View>
                {data.tees.map((t) => (
                  <View key={t.id} style={styles.teeYardsRow}>
                    <Text style={styles.teeYardsLabel} numberOfLines={1}>
                      {teeNameById[t.id] ?? t.name} yds
                    </Text>
                    <TextInput
                      style={styles.teeYardsIn}
                      keyboardType="number-pad"
                      value={he.yards[t.id] ?? ''}
                      onChangeText={(txt) =>
                        setHole(h.id, {
                          yards: { ...he.yards, [t.id]: txt },
                        })
                      }
                      placeholder="—"
                      placeholderTextColor="#999"
                    />
                  </View>
                ))}
                <Text style={styles.mini}>Notes</Text>
                <TextInput
                  style={styles.notesIn}
                  value={he.notes}
                  onChangeText={(t) => setHole(h.id, { notes: t })}
                  placeholder="Local notes for this hole"
                  placeholderTextColor="#999"
                />
              </View>
            );
          })}
        </View>
      ))}

      {data.combos.length > 0 || data.nines.length >= 2 ? (
        <>
          <Text style={styles.sectionTitle}>18-hole configurations</Text>
          <Text style={styles.hint}>
            Name each rated layout (e.g. “Pine + Oak front/back”). Handicap differentials use rating and slope.
          </Text>
        </>
      ) : null}
      {data.combos.map((c) => {
        const ed = comboEdits[c.id] ?? {
          name: c.name,
          rating: String(c.rating),
          slope: String(c.slope),
        };
        return (
          <View key={c.id} style={styles.comboCard}>
            <View style={styles.comboHead}>
              <Text style={styles.comboLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={ed.name}
                onChangeText={(t) => setComboEdits((m) => ({ ...m, [c.id]: { ...ed, name: t } }))}
                placeholder="Configuration name"
                placeholderTextColor="#777"
              />
            </View>
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
            <Pressable onPress={() => onDeleteCombo(c.id)} style={styles.comboDelete}>
              <Text style={styles.dangerText}>Delete this configuration</Text>
            </Pressable>
          </View>
        );
      })}

      {data.nines.length >= 2 ? (
        <View style={styles.addCombo}>
          <Text style={styles.label}>Add configuration</Text>
            <View style={styles.pickerBlock}>
            <Text style={styles.muted}>Front nine</Text>
            {data.nines.map((n) => (
              <Pressable
                key={`f-${n.id}`}
                onPress={() => setNewFrontId(n.id)}
                style={[styles.pill, newFrontId === n.id && styles.pillOn]}
              >
                <Text
                  style={[styles.pillText, newFrontId === n.id && styles.pillTextOn]}
                  numberOfLines={1}
                >
                  {nineNameById[n.id] ?? n.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.pickerBlock}>
            <Text style={styles.muted}>Back nine</Text>
            {data.nines.map((n) => (
              <Pressable
                key={`b-${n.id}`}
                onPress={() => setNewBackId(n.id)}
                style={[styles.pill, newBackId === n.id && styles.pillOn]}
              >
                <Text
                  style={[styles.pillText, newBackId === n.id && styles.pillTextOn]}
                  numberOfLines={1}
                >
                  {nineNameById[n.id] ?? n.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.mini}>Name</Text>
          <TextInput
            value={newComboName}
            onChangeText={setNewComboName}
            style={styles.input}
            placeholder="18 Holes"
            placeholderTextColor="#777"
          />
          <View style={styles.row}>
            <Text style={styles.mini}>Rating</Text>
            <TextInput
              style={styles.inputSmall}
              keyboardType="decimal-pad"
              value={newComboRating}
              onChangeText={setNewComboRating}
            />
            <Text style={styles.mini}>Slope</Text>
            <TextInput
              style={styles.inputSmall}
              keyboardType="number-pad"
              value={newComboSlope}
              onChangeText={setNewComboSlope}
            />
          </View>
          <Pressable onPress={onAddCombo} style={styles.secondary} disabled={saving}>
            <Text style={styles.secondaryText}>Add configuration</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable onPress={onSave} disabled={saving} style={[styles.primary, saving && styles.disabled]}>
        <Text style={styles.primaryText}>{saving ? 'Working…' : 'Save'}</Text>
      </Pressable>

      <Pressable onPress={onDelete} style={styles.danger}>
        <Text style={styles.dangerText}>Delete course</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 40 },
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900' },
  sectionTitle: { fontSize: 17, fontWeight: '900', marginTop: 6 },
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
  inputFlex: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    padding: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  comboCard: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 12, gap: 8, marginTop: 4 },
  comboHead: { gap: 6 },
  comboLabel: { fontSize: 12, fontWeight: '800', opacity: 0.7 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  mini: { fontSize: 12, fontWeight: '700', opacity: 0.7 },
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
  dangerText: { color: '#c62828', fontSize: 15, fontWeight: '800' },
  error: { color: '#c62828' },
  btn: { marginTop: 12, borderWidth: 1, borderColor: '#999', borderRadius: 12, padding: 12, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  muted: { opacity: 0.8, fontWeight: '600' },
  nineBlock: { gap: 6, marginTop: 4 },
  holeCard: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 10, gap: 6, marginTop: 6 },
  holeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  holeNo: { width: 36, fontSize: 15, fontWeight: '900' },
  tinyIn: { width: 48, borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 6, fontWeight: '700' },
  teeYardsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teeYardsLabel: { width: 88, fontSize: 12, fontWeight: '700', opacity: 0.8 },
  teeYardsIn: { flex: 1, minWidth: 100, borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 6, fontWeight: '600' },
  notesIn: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 10,
    padding: 8,
    minHeight: 64,
    fontWeight: '500',
  },
  teeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  teeNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 10,
    padding: 8,
    fontWeight: '600',
  },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#999' },
  chipOn: { backgroundColor: '#2f80ed', borderColor: '#2f80ed' },
  chipText: { fontSize: 12, fontWeight: '800', color: '#111' },
  chipTextOn: { color: '#fff' },
  teeDelete: { padding: 6 },
  teeDeleteText: { fontSize: 16, color: '#c62828' },
  addTeeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2f80ed',
  },
  secondaryText: { color: '#2f80ed', fontWeight: '800' },
  addCombo: { marginTop: 4, gap: 8, padding: 8, backgroundColor: '#f6f6f6', borderRadius: 12 },
  pickerBlock: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#999' },
  pillOn: { backgroundColor: '#2f80ed', borderColor: '#2f80ed' },
  pillText: { fontSize: 13, fontWeight: '700' },
  pillTextOn: { color: '#fff' },
  comboDelete: { alignSelf: 'flex-start' },
});
