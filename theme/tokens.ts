export const colors = {
  primary: '#1B5E20',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E8F5E9',
  onPrimaryContainer: '#002106',

  secondary: '#475569',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F1F5F9',
  onSecondaryContainer: '#1E293B',

  surface: '#F8FAFC',
  surfaceDim: '#E2E8F0',
  surfaceBright: '#FFFFFF',
  surfaceContainer: '#F1F5F9',

  error: '#DC2626',
  onError: '#FFFFFF',
  success: '#15803D',
  warning: '#D97706',

  outline: '#94A3B8',
  outlineVariant: '#CBD5E1',

  text: '#1E293B',
  textMuted: '#475569',
  textDisabled: '#94A3B8',
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
} as const;

export const typography = {
  headingXl: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  headingL: { fontSize: 22, fontWeight: '600' as const, lineHeight: 29 },
  headingM: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  bodyM: { fontSize: 16, fontWeight: '400' as const, lineHeight: 26 },
  bodyS: { fontSize: 14, fontWeight: '400' as const, lineHeight: 21 },
  labelM: { fontSize: 14, fontWeight: '500' as const, lineHeight: 14 },
  labelS: { fontSize: 12, fontWeight: '500' as const, lineHeight: 12 },
} as const;

