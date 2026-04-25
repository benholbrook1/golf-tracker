import { useCallback, useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import { colors, radius } from '@/theme/tokens';

const VISIBLE = 3;
const ITEM_W = 56;
const HEIGHT = 52;

interface DrumPickerProps {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  label?: (v: number) => string;
  /** Width of each individual slot (container = itemWidth × 3). Defaults to 56. */
  itemWidth?: number;
}

export function DrumPicker({ values, value, onChange, label, itemWidth = ITEM_W }: DrumPickerProps) {
  const ref = useRef<ScrollView>(null);
  const isMomentum = useRef(false);
  // Set to true when a value change came from the user scrolling.
  // The sync useEffect checks this and skips scrollTo, preventing the loop:
  //   commit → onChange → value prop changes → useEffect → scrollTo → scroll event → commit → ...
  const fromUser = useRef(false);

  const scrollTo = useCallback(
    (idx: number, animated = false) => {
      ref.current?.scrollTo({ x: idx * itemWidth, animated });
    },
    [itemWidth],
  );

  // Sync scroll position for *external* value changes only (e.g. par auto-fill).
  useEffect(() => {
    if (fromUser.current) {
      fromUser.current = false;
      return;
    }
    const idx = values.indexOf(value);
    if (idx >= 0) scrollTo(idx, false);
  }, [value, values, scrollTo]);

  const commit = useCallback(
    (x: number) => {
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(x / itemWidth)));
      if (values[idx] !== value) {
        fromUser.current = true;
        onChange(values[idx]!);
      }
    },
    [values, value, onChange, itemWidth],
  );

  const onDragEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isMomentum.current) commit(e.nativeEvent.contentOffset.x);
    },
    [commit],
  );

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isMomentum.current = false;
      commit(e.nativeEvent.contentOffset.x);
    },
    [commit],
  );

  const containerWidth = itemWidth * VISIBLE;

  return (
    <View style={[styles.container, { width: containerWidth, height: HEIGHT }]}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        decelerationRate="fast"
        onScrollBeginDrag={() => { isMomentum.current = false; }}
        onMomentumScrollBegin={() => { isMomentum.current = true; }}
        onScrollEndDrag={onDragEnd}
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={[styles.content, { paddingHorizontal: itemWidth }]}
      >
        {values.map((v) => {
          const selected = v === value;
          return (
            <View key={v} style={[styles.item, { width: itemWidth, height: HEIGHT }]}>
              <Text style={[styles.itemText, selected && styles.itemTextSelected]}>
                {label ? label(v) : String(v)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Vertical hairlines framing the centre slot */}
      <View pointerEvents="none" style={[styles.line, { left: itemWidth }]} />
      <View pointerEvents="none" style={[styles.line, { left: itemWidth * 2 }]} />

      {/* Left/right fade masks */}
      <View pointerEvents="none" style={[styles.mask, styles.maskLeft, { width: itemWidth }]} />
      <View pointerEvents="none" style={[styles.mask, styles.maskRight, { width: itemWidth }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBright,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textMuted,
  },
  itemTextSelected: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  line: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
  },
  mask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.surfaceBright + 'A0',
  },
  maskLeft: { left: 0 },
  maskRight: { right: 0 },
});
