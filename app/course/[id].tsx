import { createId } from '@paralleldrive/cuid2';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Keyboard, LayoutAnimation, PanResponder, Platform, Pressable, ScrollView, StyleSheet, TextInput, UIManager, View } from 'react-native';

// Enable LayoutAnimation on Android (no-op on iOS)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TEE_SORT_ANIM = {
  duration: 220,
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.75 },
} satisfies Parameters<typeof LayoutAnimation.configureNext>[0];
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import { DrumPicker } from '@/components/ui/DrumPicker';
import { db } from '@/db/client';
import { colors, radius, space, typography } from '@/theme/tokens';
import {
  courseCombos,
  courseHoleTeeYardages,
  courseHoles,
  courseNines,
  courseTees,
  courses,
  roundNines,
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

// Stable references — defined outside the component so DrumPicker's useEffect
// doesn't fire on every render due to a new array reference.
const PAR_VALUES = [3, 4, 5];
const HCP_VALUES = Array.from({ length: 19 }, (_, i) => i); // 0–18
const YARD_VALUES = Array.from({ length: 701 }, (_, i) => i); // 0–700

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = id ?? '';
  const { data, loading, error, refresh } = useCourseDetail(courseId || null);
  const insets = useSafeAreaInsets();

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

  type Tab = 'nines' | 'tees' | 'configs';
  const [activeTab, setActiveTab] = useState<Tab>('nines');
  const [activeNineIdx, setActiveNineIdx] = useState(0);
  const [activeHoleNum, setActiveHoleNum] = useState(1);
  const [notesOpen, setNotesOpen] = useState(false);
  const holeStripRef = useRef<ScrollView | null>(null);
  const ninesScrollRef = useRef<ScrollView | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Tee drag-to-reorder (pure JS, no native modules) ──────────────────────
  const [localTees, setLocalTees] = useState<NonNullable<typeof data>['tees']>([]);
  const localTeesRef = useRef<NonNullable<typeof data>['tees']>([]);
  const [teeDraggingId, setTeeDraggingId] = useState<string | null>(null);
  const [teeInsertIdx, setTeeInsertIdx] = useState(0);
  const [teeScrollEnabled, setTeeScrollEnabled] = useState(true);
  const teeDragStartIdx = useRef(0);
  // Cached PanResponders (one per tee id, stable across renders)
  const teePanResponders = useRef(new Map<string, ReturnType<typeof PanResponder.create>>());
  const teeInsertIdxRef = useRef(0); // shadow of teeInsertIdx for use inside PanResponder
  const TEE_ITEM_HEIGHT = 88; // estimated collapsed card height (px)

  const debounceSave = (key: string, fn: () => Promise<unknown>, ms = 600) => {
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => { fn().catch(console.warn); }, ms);
  };

  useEffect(() => {
    if (!notesOpen) return;
    const scrollToNotes = () => ninesScrollRef.current?.scrollToEnd({ animated: true });
    // Scroll immediately after notes renders
    const timer = setTimeout(scrollToNotes, 60);
    // Also scroll once keyboard finishes animating in
    const kbSub = Keyboard.addListener('keyboardDidShow', scrollToNotes);
    return () => {
      clearTimeout(timer);
      kbSub.remove();
    };
  }, [notesOpen]);

  useEffect(() => {
    if (!holeStripRef.current) return;
    const unit = 48;
    const x = Math.max(0, (activeHoleNum - 1) * unit - unit * 2);
    holeStripRef.current.scrollTo({ x, y: 0, animated: true });
  }, [activeHoleNum]);

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

  // Keep localTees in sync with DB data — but ONLY when the set of IDs changes
  // (a tee was added or deleted). A reorder changes sortOrder only, not IDs, so
  // we never clobber the optimistic order set on drop.
  useEffect(() => {
    if (!data || teeDraggingId !== null) return;
    const newIdSet = [...data.tees].sort((a, b) => a.id.localeCompare(b.id)).map((t) => t.id).join(',');
    const curIdSet = [...localTeesRef.current].sort((a, b) => a.id.localeCompare(b.id)).map((t) => t.id).join(',');
    if (newIdSet !== curIdSet) {
      setLocalTees(data.tees);
      localTeesRef.current = data.tees;
    }
    // Evict stale PanResponder entries regardless
    const ids = new Set(data.tees.map((t) => t.id));
    for (const k of teePanResponders.current.keys()) {
      if (!ids.has(k)) teePanResponders.current.delete(k);
    }
  }, [data, teeDraggingId]);

  // The list shown during drag reorders in real time, committed on release
  const displayedTees = useMemo(() => {
    if (teeDraggingId === null) return localTees;
    const copy = [...localTees];
    const fromIdx = copy.findIndex((t) => t.id === teeDraggingId);
    if (fromIdx >= 0 && teeInsertIdx !== fromIdx) {
      const [item] = copy.splice(fromIdx, 1);
      copy.splice(teeInsertIdx, 0, item!);
    }
    return copy;
  }, [localTees, teeDraggingId, teeInsertIdx]);

  const getTeePanResponder = useCallback(
    (teeId: string) => {
      if (!teePanResponders.current.has(teeId)) {
        const pr = PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            const idx = localTeesRef.current.findIndex((t) => t.id === teeId);
            teeDragStartIdx.current = idx;
            teeInsertIdxRef.current = idx;
            setTeeDraggingId(teeId);
            setTeeInsertIdx(idx);
            setTeeScrollEnabled(false);
          },
          onPanResponderMove: (_, gs) => {
            const delta = Math.round(gs.dy / TEE_ITEM_HEIGHT);
            const next = Math.max(0, Math.min(localTeesRef.current.length - 1, teeDragStartIdx.current + delta));
            if (next !== teeInsertIdxRef.current) {
              teeInsertIdxRef.current = next;
              LayoutAnimation.configureNext(TEE_SORT_ANIM);
              setTeeInsertIdx(next);
            }
          },
          onPanResponderRelease: async (_, gs) => {
            const delta = Math.round(gs.dy / TEE_ITEM_HEIGHT);
            const finalIdx = Math.max(0, Math.min(localTeesRef.current.length - 1, teeDragStartIdx.current + delta));
            LayoutAnimation.configureNext(TEE_SORT_ANIM);
            setTeeDraggingId(null);
            setTeeScrollEnabled(true);
            teeInsertIdxRef.current = 0;
            if (finalIdx !== teeDragStartIdx.current) {
              const reordered = [...localTeesRef.current];
              const [item] = reordered.splice(teeDragStartIdx.current, 1);
              reordered.splice(finalIdx, 0, item!);
              setLocalTees(reordered);
              localTeesRef.current = reordered;
              try {
                for (let i = 0; i < reordered.length; i++) {
                  await db.update(courseTees).set(withTimestamp({ sortOrder: i })).where(eq(courseTees.id, reordered[i]!.id));
                }
                // No refresh() — localTees is already correct; a re-fetch here causes a visible flicker
              } catch (e) { console.warn('teeOrder', e); }
            }
          },
          onPanResponderTerminate: () => {
            LayoutAnimation.configureNext(TEE_SORT_ANIM);
            setTeeDraggingId(null);
            setTeeScrollEnabled(true);
            teeInsertIdxRef.current = 0;
          },
        });
        teePanResponders.current.set(teeId, pr);
      }
      return teePanResponders.current.get(teeId)!;
    },
    [] // stable — reads from refs only
  );

  useEffect(() => {
    comboPickerInit.current = false;
  }, [courseId]);

  useEffect(() => {
    if (!data || data.nines.length < 2 || comboPickerInit.current) return;
    setNewFrontId(data.nines[0]!.id);
    setNewBackId(data.nines[1]!.id);
    comboPickerInit.current = true;
  }, [data]);

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

  const onAddNine = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const newName = `Nine ${data.nines.length + 1}`;
      const nineId = createId();
      await db.insert(courseNines).values({ id: nineId, courseId: data.course.id, name: newName });

      const holeIds: { id: string; num: number }[] = [];
      for (let num = 1; num <= 9; num++) {
        const holeId = createId();
        holeIds.push({ id: holeId, num });
        await db.insert(courseHoles).values({ id: holeId, nineId, holeNumber: num, par: 4 });
      }

      for (const tee of data.tees) {
        for (const h of holeIds) {
          await db.insert(courseHoleTeeYardages).values({
            id: createId(),
            courseHoleId: h.id,
            courseTeeId: tee.id,
            yards: 300, // default par 4 yardage
          });
        }
      }

      await refresh();
      setActiveNineIdx(data.nines.length); // select the new nine
      setActiveHoleNum(1);
    } catch (e) {
      Alert.alert('Could not add nine', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteNine = (nineId: string) => {
    if (!data) return;
    if (data.nines.length <= 1) {
      Alert.alert('Cannot delete', 'A course needs at least one nine.');
      return;
    }
    Alert.alert('Delete nine?', 'All holes and yardages for this nine will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const nine = data.nines.find((n) => n.id === nineId);
            if (!nine) return;
            const holeIds = nine.holes.map((h) => h.id);

            // Block if any rounds used this nine
            if (holeIds.length > 0) {
              const [used] = await db
                .select({ n: count() })
                .from(roundNines)
                .where(and(eq(roundNines.nineId, nineId), isNull(roundNines.deletedAt)));
              if (Number(used?.n ?? 0) > 0) {
                Alert.alert('Cannot delete', 'This nine has saved round data.');
                return;
              }
            }

            // Hard delete — we've already confirmed no rounds use this nine,
            // so there's no orphaned data. This also frees up the name so it
            // can be reused (the unique index on courseNines(courseId, name)
            // applies to all rows, including soft-deleted ones).
            if (holeIds.length > 0) {
              await db
                .delete(courseHoleTeeYardages)
                .where(inArray(courseHoleTeeYardages.courseHoleId, holeIds));
              await db
                .delete(courseHoles)
                .where(eq(courseHoles.nineId, nineId));
            }
            // Hard-delete combos that reference this nine (also safe — the
            // roundNines check above ensures no rounds ran through this nine,
            // and combos built from it couldn't have been played without it).
            await db
              .delete(courseCombos)
              .where(and(
                eq(courseCombos.courseId, data.course.id),
                isNull(courseCombos.deletedAt),
              ));
            await db.delete(courseNines).where(eq(courseNines.id, nineId));
            setActiveNineIdx(0);
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
      const nameConflict = await db
        .select({ id: courseCombos.id })
        .from(courseCombos)
        .where(and(eq(courseCombos.courseId, data.course.id), isNull(courseCombos.deletedAt), eq(courseCombos.name, nm)))
        .limit(1);
      if (nameConflict[0]) {
        Alert.alert('Name already used', 'Pick a different configuration name for this course.');
        return;
      }

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
        Alert.alert('Could not add', 'This configuration violates a uniqueness constraint (likely duplicate name).');
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

  const PAR_DEFAULT_YARDS: Record<number, number> = { 3: 150, 4: 300, 5: 450 };

  // ── Individual auto-save handlers ──────────────────────────────────────────

  const handleCourseName = (val: string) => {
    setName(val);
    if (!val.trim()) return;
    debounceSave('course_name', () =>
      db.update(courses).set(withTimestamp({ name: val.trim() })).where(eq(courses.id, courseId))
    );
  };

  const handleNineName = (nineId: string, val: string) => {
    setNineNameById((m) => ({ ...m, [nineId]: val }));
    debounceSave(`nine_${nineId}`, () =>
      db.update(courseNines).set(withTimestamp({ name: val.trim() || 'Nine' })).where(eq(courseNines.id, nineId))
    );
  };

  const handleTeeName = (teeId: string, val: string) => {
    setTeeNameById((m) => ({ ...m, [teeId]: val }));
    debounceSave(`tee_${teeId}`, () =>
      db.update(courseTees).set(withTimestamp({ name: val.trim() || 'Tee' })).where(eq(courseTees.id, teeId))
    );
  };

  const handleDefaultTee = async (teeId: string) => {
    if (!data) return;
    setDefaultTeeId(teeId);
    try {
      await db.update(courses).set(withTimestamp({ defaultTeeId: teeId })).where(eq(courses.id, data.course.id));
      for (const t of data.tees) {
        await db.update(courseTees)
          .set(withTimestamp({ isDefault: t.id === teeId }))
          .where(eq(courseTees.id, t.id));
      }
    } catch (e) { console.warn('auto-save defaultTee', e); }
  };


  const handleNotes = (holeId: string, val: string) => {
    setHoleEdits((m) => {
      const base = m[holeId];
      return base ? { ...m, [holeId]: { ...base, notes: val } } : m;
    });
    debounceSave(`notes_${holeId}`, () =>
      db.update(courseHoles).set(withTimestamp({ notes: val.trim() || null })).where(eq(courseHoles.id, holeId))
    );
  };

  const handlePar = async (holeId: string, newPar: number) => {
    if (!data) return;
    const defaultYard = PAR_DEFAULT_YARDS[newPar];
    setHoleEdits((m) => {
      const base = m[holeId];
      if (!base) return m;
      const newYards = defaultYard
        ? Object.fromEntries(Object.keys(base.yards).map((k) => [k, String(defaultYard)]))
        : base.yards;
      return { ...m, [holeId]: { ...base, par: String(newPar), yards: newYards } };
    });
    try {
      const defTeeId = defaultTeeId ?? data.tees[0]?.id;
      const mainYards = defaultYard ?? null;
      await db.update(courseHoles)
        .set(withTimestamp({ par: newPar, yards: defTeeId ? mainYards : null }))
        .where(eq(courseHoles.id, holeId));
      if (defaultYard) {
        for (const tee of data.tees) {
          await db.update(courseHoleTeeYardages)
            .set(withTimestamp({ yards: defaultYard }))
            .where(and(eq(courseHoleTeeYardages.courseHoleId, holeId), eq(courseHoleTeeYardages.courseTeeId, tee.id), isNull(courseHoleTeeYardages.deletedAt)));
        }
      }
    } catch (e) { console.warn('auto-save par', e); }
  };

  const handleHcp = async (holeId: string, hcp: number) => {
    const hcpVal = hcp === 0 ? null : hcp;
    setHoleEdits((m) => {
      const base = m[holeId];
      return base ? { ...m, [holeId]: { ...base, handicap: hcp === 0 ? '' : String(hcp) } } : m;
    });
    try {
      await db.update(courseHoles).set(withTimestamp({ handicap: hcpVal })).where(eq(courseHoles.id, holeId));
    } catch (e) { console.warn('auto-save hcp', e); }
  };

  const handleYard = async (holeId: string, teeId: string, yards: number) => {
    if (!data) return;
    const yardsVal = yards === 0 ? null : yards;
    setHoleEdits((m) => {
      const base = m[holeId];
      return base ? { ...m, [holeId]: { ...base, yards: { ...base.yards, [teeId]: yards === 0 ? '' : String(yards) } } } : m;
    });
    try {
      await db.update(courseHoleTeeYardages)
        .set(withTimestamp({ yards: yardsVal }))
        .where(and(eq(courseHoleTeeYardages.courseHoleId, holeId), eq(courseHoleTeeYardages.courseTeeId, teeId), isNull(courseHoleTeeYardages.deletedAt)));
      const defTeeId = defaultTeeId ?? data.tees[0]?.id;
      if (teeId === defTeeId) {
        await db.update(courseHoles).set(withTimestamp({ yards: yardsVal })).where(eq(courseHoles.id, holeId));
      }
    } catch (e) { console.warn('auto-save yard', e); }
  };

  const handleComboEdit = (comboId: string, patch: Partial<ComboEdit>) => {
    setComboEdits((m) => ({ ...m, [comboId]: { ...m[comboId]!, ...patch } }));
    debounceSave(`combo_${comboId}`, async () => {
      const ed = { ...comboEdits[comboId], ...patch };
      if (!ed?.name?.trim()) return;
      const rating = Number(ed.rating);
      const slope = Math.round(Number(ed.slope));
      if (!Number.isFinite(rating) || !Number.isFinite(slope) || slope <= 0) return;
      await db.update(courseCombos).set(withTimestamp({ name: ed.name.trim(), rating, slope })).where(eq(courseCombos.id, comboId));
    });
  };

  // Value arrays for drum pickers

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
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error ?? 'Course not found'}</Text>
        <Pressable onPress={() => router.back()} style={styles.btnOutline}>
          <Text style={styles.btnOutlineText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const orderedPairsTotal = data.nines.length >= 2 ? data.nines.length * (data.nines.length - 1) : 0;
  const existingPairs = new Set(data.combos.map((c) => `${c.frontNineId}::${c.backNineId}`));
  const allPairsCreated = orderedPairsTotal > 0 && existingPairs.size >= orderedPairsTotal;

  // Derived values for nines panel
  const safeNineIdx = Math.min(activeNineIdx, Math.max(0, (data?.nines.length ?? 1) - 1));
  const activeNine = data.nines[safeNineIdx] ?? null;
  const activeHole = activeNine?.holes.find((h) => h.holeNumber === activeHoleNum) ?? null;
  const activeHoleEdit = activeHole ? holeEdits[activeHole.id] : null;
  const maxHole = activeNine?.holes.length ?? 9;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Fixed top area ── */}
      <View style={[styles.topArea, { paddingTop: insets.top + space[3] }]}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
            hitSlop={8}
          >
            <Text style={styles.navBtnText}>← Back</Text>
          </Pressable>
          <TextInput
            value={name}
            onChangeText={handleCourseName}
            style={styles.courseNameInput}
            placeholder="Course name"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="words"
          />
        </View>

        {/* Tab strip */}
        <View style={styles.tabStrip}>
          {(['nines', 'tees', 'configs'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabOn]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextOn]}>
                {tab === 'nines' ? 'Nines' : tab === 'tees' ? 'Tees' : 'Configs'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Nines tab ── */}
      {activeTab === 'nines' ? (
        <View style={styles.tabContent}>
          {/* Scrollable editing area — one outer scroll, no nested flex:1 scroll */}
          <ScrollView
            ref={ninesScrollRef}
            style={styles.ninesScroll}
            contentContainerStyle={styles.ninesScrollContent}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustKeyboardInsets
          >
            {/* Nine selector — scrollable chips + fixed + button */}
            <View style={styles.nineSelectorRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nineSelectorContent}
                contentInsetAdjustmentBehavior="never"
              >
                {data.nines.map((n, idx) => (
                  <Pressable
                    key={n.id}
                    onPress={() => { setActiveNineIdx(idx); setActiveHoleNum(1); setNotesOpen(false); }}
                    style={[styles.nineChip, safeNineIdx === idx && styles.nineChipOn]}
                  >
                    <Text style={[styles.nineChipText, safeNineIdx === idx && styles.nineChipTextOn]} numberOfLines={1}>
                      {nineNameById[n.id] ?? n.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                onPress={onAddNine}
                disabled={saving}
                style={styles.nineAddBtn}
              >
                <Text style={styles.nineAddBtnText}>+</Text>
              </Pressable>
            </View>

            {/* Nine name edit row + delete button */}
            {activeNine ? (
              <View style={styles.nineNameRow}>
                <TextInput
                  value={nineNameById[activeNine.id] ?? activeNine.name}
                  onChangeText={(v) => handleNineName(activeNine.id, v)}
                  style={styles.nineNameInput}
                  placeholder="e.g. Pine, West"
                  placeholderTextColor={colors.textDisabled}
                />
                <Pressable
                  onPress={() => onDeleteNine(activeNine.id)}
                  style={styles.deleteIconBtn}
                  hitSlop={6}
                >
                  <Text style={styles.deleteIconText}>✕</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Hole number strip */}
            <ScrollView
              ref={(r) => { holeStripRef.current = r; }}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.holeStrip}
              contentInsetAdjustmentBehavior="never"
            >
              {Array.from({ length: maxHole }, (_, i) => i + 1).map((h) => {
                const holeObj = activeNine?.holes.find((x) => x.holeNumber === h);
                const edit = holeObj ? holeEdits[holeObj.id] : undefined;
                const needsEdit = (() => {
                  if (!edit) return false;
                  if (edit.par !== '' && edit.par !== '4') return false;
                  if (edit.handicap !== '' && edit.handicap !== '0') return false;
                  if (edit.notes.trim() !== '') return false;
                  const yardVals = Object.values(edit.yards);
                  if (yardVals.some((y) => y !== '' && y !== '300')) return false;
                  return true;
                })();
                const on = h === activeHoleNum;
                return (
                  <Pressable
                    key={h}
                    onPress={() => { setActiveHoleNum(h); setNotesOpen(false); }}
                    style={[styles.holeChip, on && styles.holeChipOn]}
                    hitSlop={6}
                  >
                    <Text style={[styles.holeChipText, on && styles.holeChipTextOn]}>{h}</Text>
                    {needsEdit && !on ? <View style={styles.holeDot} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Hole editor — plain View, content always visible */}
            <View style={styles.holeEditorContent}>
              {activeHole && activeHoleEdit ? (
                <>
                  <View style={styles.holeMetaBar}>
                    <View style={styles.holeMetaField}>
                      <Text style={styles.fieldLabel}>Par</Text>
                      <DrumPicker
                        values={PAR_VALUES}
                        value={parseInt(activeHoleEdit.par, 10) || 4}
                        onChange={(v) => handlePar(activeHole.id, v)}
                        itemWidth={44}
                      />
                    </View>
                    <View style={styles.holeMetaField}>
                      <Text style={styles.fieldLabel}>HCP</Text>
                      <DrumPicker
                        values={HCP_VALUES}
                        value={parseInt(activeHoleEdit.handicap, 10) || 0}
                        onChange={(v) => handleHcp(activeHole.id, v)}
                        label={(v) => (v === 0 ? '—' : String(v))}
                        itemWidth={44}
                      />
                    </View>
                  </View>

                  {data.tees.length > 0 ? (
                    <View style={styles.yardsSection}>
                      {data.tees.map((t) => (
                        <View key={t.id} style={styles.yardRow}>
                          <Text style={styles.yardLabel} numberOfLines={1}>
                            {teeNameById[t.id] ?? t.name}
                          </Text>
                          <DrumPicker
                            values={YARD_VALUES}
                            value={parseInt(activeHoleEdit.yards[t.id] ?? '0', 10) || 0}
                            onChange={(v) => handleYard(activeHole.id, t.id, v)}
                            label={(v) => (v === 0 ? '—' : String(v))}
                            itemWidth={52}
                          />
                          <Text style={styles.yardUnit}>yds</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.muted}>Add tees first to enter yardages.</Text>
                  )}

                  <Pressable
                    onPress={() => setNotesOpen((o) => !o)}
                    style={styles.notesToggle}
                  >
                    <Text style={styles.notesToggleText}>
                      {notesOpen ? '▾ Notes' : `▸ Notes${activeHoleEdit.notes ? ' •' : ''}`}
                    </Text>
                  </Pressable>
                  {notesOpen ? (
                    <TextInput
                      style={styles.notesInput}
                      value={activeHoleEdit.notes}
                      onChangeText={(v) => handleNotes(activeHole.id, v)}
                      placeholder="Local knowledge, hazards…"
                      placeholderTextColor={colors.textDisabled}
                      multiline
                      autoFocus
                    />
                  ) : null}
                </>
              ) : (
                <Text style={styles.muted}>No hole data available.</Text>
              )}
            </View>
          </ScrollView>

          {/* Prev / Next — fixed below the scroll area */}
          <View style={[styles.prevNextRow, { paddingBottom: insets.bottom + space[3] }]}>
            <Pressable
              onPress={() => { setActiveHoleNum((h) => Math.max(1, h - 1)); setNotesOpen(false); }}
              disabled={activeHoleNum <= 1}
              style={[styles.prevNextBtn, activeHoleNum <= 1 && styles.prevNextBtnDisabled]}
            >
              <Text style={styles.prevNextText}>← Prev</Text>
            </Pressable>
            <Text style={styles.holeIndicator}>Hole {activeHoleNum} / {maxHole}</Text>
            <Pressable
              onPress={() => { setActiveHoleNum((h) => Math.min(maxHole, h + 1)); setNotesOpen(false); }}
              disabled={activeHoleNum >= maxHole}
              style={[styles.prevNextBtn, activeHoleNum >= maxHole && styles.prevNextBtnDisabled]}
            >
              <Text style={styles.prevNextText}>Next →</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ── Tees tab ── */}
      {activeTab === 'tees' ? (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={[styles.tabScrollContent, { paddingBottom: insets.bottom + space[8] }]}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustKeyboardInsets
          scrollEnabled={teeScrollEnabled}
        >
          <Text style={styles.sectionTitle}>Tees</Text>
          <Text style={styles.hint}>The default tee provides the primary yardage shown during scoring.</Text>
          {displayedTees.length === 0 ? (
            <Text style={styles.muted}>No tees yet — add one below (e.g. "Blue", "White").</Text>
          ) : null}

          <View style={styles.teeListContainer}>
          {displayedTees.map((t) => {
            const isDragging = t.id === teeDraggingId;
            const panResponder = getTeePanResponder(t.id);
            const isDefault = defaultTeeId === t.id;
            return (
              <Animated.View
                key={t.id}
                style={[styles.teeCard, isDragging && styles.teeCardActive]}
              >
                <View style={styles.teeRow}>
                  <View {...panResponder.panHandlers} style={styles.dragHandle} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={styles.dragHandleIcon}>☰</Text>
                  </View>
                  <TextInput
                    value={teeNameById[t.id] ?? t.name}
                    onChangeText={(v) => handleTeeName(t.id, v)}
                    style={styles.teeNameInput}
                    placeholder="Tee name"
                    placeholderTextColor={colors.textDisabled}
                  />
                  <Pressable
                    onPress={() => handleDefaultTee(t.id)}
                    style={[styles.chip, isDefault && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, isDefault && styles.chipTextOn]}>
                      {isDefault ? 'Default' : 'Set default'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => onDeleteTee(t.id)} style={styles.deleteIconBtn} hitSlop={6}>
                    <Text style={styles.deleteIconText}>✕</Text>
                  </Pressable>
                </View>
              </Animated.View>
            );
          })}
          </View>

          <View style={styles.addRow}>
            <TextInput
              value={newTeeName}
              onChangeText={setNewTeeName}
              style={styles.inputFlex}
              placeholder="New tee name"
              placeholderTextColor={colors.textDisabled}
            />
            <Pressable onPress={onAddTee} style={styles.addBtn} disabled={saving}>
              <Text style={styles.addBtnText}>Add tee</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Pressable onPress={onDelete} style={styles.destructiveBtn}>
            <Text style={styles.destructiveBtnText}>Delete course</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {/* ── Configs tab ── */}
      {activeTab === 'configs' ? (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={[styles.tabScrollContent, { paddingBottom: insets.bottom + space[8] }]}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustKeyboardInsets
        >
          {data.nines.length < 2 ? (
            <Text style={styles.muted}>You need at least two nines to create 18-hole configurations.</Text>
          ) : (
            <>
              <Text style={styles.sectionTitle}>18-hole configurations</Text>
              <Text style={styles.hint}>Named layouts for full rounds. Rating and slope are used for handicap differentials.</Text>

              {data.combos.map((c) => {
                const ed = comboEdits[c.id] ?? { name: c.name, rating: String(c.rating), slope: String(c.slope) };
                const frontName = nineNameById[c.frontNineId] ?? data.nines.find((n) => n.id === c.frontNineId)?.name ?? '—';
                const backName = nineNameById[c.backNineId] ?? data.nines.find((n) => n.id === c.backNineId)?.name ?? '—';
                return (
                  <View key={c.id} style={styles.comboCard}>
                    <Text style={styles.comboMeta}>Front: {frontName} · Back: {backName}</Text>
                    <TextInput
                      style={styles.input}
                      value={ed.name}
                      onChangeText={(v) => handleComboEdit(c.id, { name: v })}
                      placeholder="Configuration name"
                      placeholderTextColor={colors.textDisabled}
                    />
                    <View style={styles.ratingRow}>
                      <View style={styles.ratingField}>
                        <Text style={styles.fieldLabel}>Rating</Text>
                        <TextInput
                          style={styles.ratingInput}
                          keyboardType="decimal-pad"
                          value={ed.rating}
                          onChangeText={(v) => handleComboEdit(c.id, { rating: v })}
                          placeholder="72.0"
                          placeholderTextColor={colors.textDisabled}
                        />
                      </View>
                      <View style={styles.ratingField}>
                        <Text style={styles.fieldLabel}>Slope</Text>
                        <TextInput
                          style={styles.ratingInput}
                          keyboardType="number-pad"
                          value={ed.slope}
                          onChangeText={(v) => handleComboEdit(c.id, { slope: v })}
                          placeholder="113"
                          placeholderTextColor={colors.textDisabled}
                        />
                      </View>
                    </View>
                    <Pressable onPress={() => onDeleteCombo(c.id)} style={styles.inlineDestructive}>
                      <Text style={styles.inlineDestructiveText}>Delete this configuration</Text>
                    </Pressable>
                  </View>
                );
              })}

              {!allPairsCreated ? (
                <View style={styles.addComboBlock}>
                  <Text style={styles.fieldLabel}>Add configuration</Text>
                  <View style={styles.pickerGroup}>
                    <Text style={styles.pickerLabel}>Front nine</Text>
                    <View style={styles.pillRow}>
                      {data.nines.map((n) => (
                        <Pressable
                          key={`f-${n.id}`}
                          onPress={() => setNewFrontId(n.id)}
                          style={[styles.pill, newFrontId === n.id && styles.pillOn]}
                        >
                          <Text style={[styles.pillText, newFrontId === n.id && styles.pillTextOn]} numberOfLines={1}>
                            {nineNameById[n.id] ?? n.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.pickerGroup}>
                    <Text style={styles.pickerLabel}>Back nine</Text>
                    <View style={styles.pillRow}>
                      {data.nines.map((n) => (
                        <Pressable
                          key={`b-${n.id}`}
                          onPress={() => setNewBackId(n.id)}
                          style={[styles.pill, newBackId === n.id && styles.pillOn]}
                        >
                          <Text style={[styles.pillText, newBackId === n.id && styles.pillTextOn]} numberOfLines={1}>
                            {nineNameById[n.id] ?? n.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <TextInput
                    value={newComboName}
                    onChangeText={setNewComboName}
                    style={styles.input}
                    placeholder="Configuration name"
                    placeholderTextColor={colors.textDisabled}
                  />
                  <View style={styles.ratingRow}>
                    <View style={styles.ratingField}>
                      <Text style={styles.fieldLabel}>Rating</Text>
                      <TextInput
                        style={styles.ratingInput}
                        keyboardType="decimal-pad"
                        value={newComboRating}
                        onChangeText={setNewComboRating}
                        placeholderTextColor={colors.textDisabled}
                      />
                    </View>
                    <View style={styles.ratingField}>
                      <Text style={styles.fieldLabel}>Slope</Text>
                      <TextInput
                        style={styles.ratingInput}
                        keyboardType="number-pad"
                        value={newComboSlope}
                        onChangeText={setNewComboSlope}
                        placeholderTextColor={colors.textDisabled}
                      />
                    </View>
                  </View>
                  <Pressable onPress={onAddCombo} disabled={saving} style={[styles.addBtn, saving && styles.disabled]}>
                    <Text style={styles.addBtnText}>Add configuration</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.muted}>All possible configurations are already saved.</Text>
              )}
            </>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

// Strip lineHeight from typography spreads when used in TextInput —
// iOS shifts text vertically when lineHeight is set on a fixed-height input.
const inputBodyM = { fontSize: typography.bodyM.fontSize, fontWeight: typography.bodyM.fontWeight } as const;
const inputBodyS = { fontSize: typography.bodyS.fontSize, fontWeight: typography.bodyS.fontWeight } as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, padding: space[4], justifyContent: 'center', gap: space[3] },

  // ── Fixed top area ──
  topArea: {
    backgroundColor: colors.surfaceBright,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    gap: space[3],
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  navBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  navBtnPressed: { opacity: 0.6 },
  navBtnText: { ...typography.labelM, color: colors.text },
  courseNameInput: {
    flex: 1,
    height: 36,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    ...inputBodyM,
    color: colors.text,
  },
  tabStrip: { flexDirection: 'row', gap: space[2] },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabOn: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  tabText: { ...typography.labelM, color: colors.textMuted },
  tabTextOn: { ...typography.labelM, color: colors.onPrimaryContainer, fontWeight: '700' },

  // ── Tab content areas ──
  tabContent: { flex: 1 },
  tabScrollContent: { padding: space[4], gap: space[3] },

  // ── Nines panel ──
  nineSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: space[3],
    paddingRight: space[4],
  },
  nineSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[4],
    paddingRight: space[2],
  },
  nineChip: {
    paddingHorizontal: space[3],
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceContainer,
  },
  nineChipOn: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  nineChipText: { ...typography.labelM, color: colors.textMuted },
  nineChipTextOn: { ...typography.labelM, color: colors.onPrimaryContainer, fontWeight: '700' },
  nineAddBtn: {
    paddingHorizontal: space[3],
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceBright,
  },
  nineAddBtnText: { ...typography.labelM, color: colors.primary, fontWeight: '600' },

  nineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[1],
  },
  nineNameInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    ...inputBodyM,
    color: colors.text,
  },

  holeStrip: { gap: 8, paddingVertical: space[3], paddingHorizontal: space[4] },
  holeChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceBright,
  },
  holeChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  holeChipText: { ...typography.labelM, color: colors.text },
  holeChipTextOn: { ...typography.labelM, color: colors.onPrimary, fontWeight: '700' },
  holeDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  ninesScroll: { flex: 1 },
  ninesScrollContent: { paddingBottom: space[4] },
  holeEditorContent: { padding: space[4], gap: space[4] },

  holeMetaBar: {
    flexDirection: 'row',
    gap: space[6],
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[4],
  },
  holeMetaField: { alignItems: 'center', gap: space[2] },
  fieldLabel: { ...typography.labelS, color: colors.textMuted },

  yardsSection: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space[4],
    gap: space[3],
  },
  yardRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  yardLabel: { ...typography.labelS, color: colors.textMuted, flex: 1 },
  yardUnit: { ...typography.labelS, color: colors.textMuted, width: 28 },

  notesToggle: {
    paddingVertical: space[2],
    paddingHorizontal: space[1],
    alignSelf: 'flex-start',
  },
  notesToggleText: {
    ...typography.labelM,
    color: colors.primary,
  },
  notesInput: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: space[3],
    minHeight: 72,
    ...inputBodyS,
    color: colors.text,
  },

  prevNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBright,
  },
  prevNextBtn: {
    paddingVertical: 10,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBright,
  },
  prevNextBtnDisabled: { opacity: 0.35 },
  prevNextText: { ...typography.labelM, color: colors.text },
  holeIndicator: { ...typography.labelS, color: colors.textMuted },

  // ── Tees / Configs shared ──
  sectionTitle: { ...typography.headingM, color: colors.text },
  hint: { ...typography.bodyS, color: colors.textMuted },
  muted: { ...typography.bodyS, color: colors.textMuted },

  input: {
    minHeight: 44,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    ...inputBodyM,
    color: colors.text,
  },
  inputFlex: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    ...inputBodyM,
    color: colors.text,
  },

  teeCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    borderRadius: radius.md,
    marginBottom: space[2],
    overflow: 'hidden',
  },
  teeCardActive: {
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 12,
    transform: [{ scale: 1.025 }],
    borderColor: colors.primary,
  },
  teeListContainer: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    padding: space[2],
    marginBottom: space[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  teeRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[2] },
  dragHandle: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  dragHandleIcon: { fontSize: 18, color: colors.textMuted, lineHeight: 22 },
  teeNameInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    ...inputBodyM,
    color: colors.text,
  },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceContainer,
  },
  chipOn: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: { ...typography.labelS, color: colors.textMuted },
  chipTextOn: { ...typography.labelS, color: colors.onPrimaryContainer, fontWeight: '700' },
  deleteIconBtn: { padding: 6 },
  deleteIconText: { fontSize: 16, color: colors.error },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  addBtn: {
    minHeight: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { ...typography.labelM, color: colors.primary, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant, marginVertical: space[2] },

  comboCard: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
    backgroundColor: colors.surfaceBright,
  },
  comboMeta: { ...typography.labelS, color: colors.textMuted },
  ratingRow: { flexDirection: 'row', gap: space[3] },
  ratingField: { flex: 1, gap: space[1] },
  ratingInput: {
    minHeight: 44,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    ...inputBodyM,
    color: colors.text,
  },
  inlineDestructive: { alignSelf: 'flex-start', paddingVertical: 4 },
  inlineDestructiveText: { ...typography.labelM, color: colors.error },

  addComboBlock: {
    gap: space[3],
    padding: space[4],
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  pickerGroup: { gap: space[2] },
  pickerLabel: { ...typography.labelS, color: colors.textMuted },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  pill: {
    paddingHorizontal: space[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceContainer,
  },
  pillOn: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  pillText: { ...typography.labelS, color: colors.textMuted },
  pillTextOn: { ...typography.labelS, color: colors.onPrimaryContainer, fontWeight: '700' },

  destructiveBtn: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[3],
  },
  destructiveBtnText: { ...typography.labelM, color: colors.error, fontWeight: '700' },

  btnOutline: {
    marginTop: space[3],
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  btnOutlineText: { ...typography.labelM, color: colors.text },
  errorText: { ...typography.bodyM, color: colors.error },
});
