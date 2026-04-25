export const VALID_PARS = [3, 4, 5] as const;

export const SCORE_LABELS: Record<number, string> = {
  [-3]: 'Albatross',
  [-2]: 'Eagle',
  [-1]: 'Birdie',
  [0]: 'Par',
  [1]: 'Bogey',
  [2]: 'Double Bogey',
  [3]: 'Triple Bogey',
};

export function getScoreLabel(strokes: number, par: number): string {
  const diff = strokes - par;
  return SCORE_LABELS[diff] ?? (diff > 0 ? `+${diff}` : `${diff}`);
}

/** Score colour coding per DESIGN.md §2.5 */
export function scoreColors(strokes: number, par: number): { bg: string; text: string; border?: string } {
  const diff = strokes - par;
  if (diff <= -2) return { bg: '#14532D', text: '#FFFFFF' };
  if (diff === -1) return { bg: '#BBF7D0', text: '#14532D' };
  if (diff === 0)  return { bg: '#F1F5F9', text: '#1E293B', border: '#94A3B8' };
  if (diff === 1)  return { bg: '#FEF3C7', text: '#92400E' };
  if (diff === 2)  return { bg: '#FEE2E2', text: '#991B1B' };
  return           { bg: '#DC2626', text: '#FFFFFF' };
}

export const ESC_TABLE = [
  { maxHandicap: 9, maxStrokes: (par: number) => par + 2 },
  { maxHandicap: 19, maxStrokes: (_par: number) => 7 },
  { maxHandicap: 29, maxStrokes: (_par: number) => 8 },
  { maxHandicap: 39, maxStrokes: (_par: number) => 9 },
  { maxHandicap: Infinity, maxStrokes: (_par: number) => 10 },
] as const;

