import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Text } from '@/components/Themed';
import { colors, radius, space, typography } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive-outline';

type Props = PressableProps & {
  variant?: ButtonVariant;
  title: string;
};

export function Button({ variant = 'primary', title, disabled, style, ...props }: Props) {
  return (
    <Pressable
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !disabled ? pressedStyles[variant] : null,
        disabled ? styles.disabled : null,
        typeof style === 'function' ? style({ pressed, hovered: false }) : style,
      ]}
      {...props}
    >
      <Text style={[styles.label, labelStyles[variant], disabled ? styles.disabledText : null]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.labelM,
  },
  disabled: { opacity: 0.55 },
  disabledText: { color: colors.textDisabled },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surfaceBright,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: space[3],
    alignItems: 'flex-start',
    minHeight: 44,
  },
  'destructive-outline': {
    backgroundColor: colors.surfaceBright,
    borderWidth: 1,
    borderColor: colors.error,
  },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: '#155218' },
  secondary: { backgroundColor: colors.surfaceContainer },
  ghost: { opacity: 0.75 },
  'destructive-outline': { backgroundColor: '#FEE2E2' },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.onPrimary },
  secondary: { color: colors.primary },
  ghost: { color: colors.primary },
  'destructive-outline': { color: colors.error },
});

