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

export const ESC_TABLE = [
  { maxHandicap: 9, maxStrokes: (par: number) => par + 2 },
  { maxHandicap: 19, maxStrokes: (_par: number) => 7 },
  { maxHandicap: 29, maxStrokes: (_par: number) => 8 },
  { maxHandicap: 39, maxStrokes: (_par: number) => 9 },
  { maxHandicap: Infinity, maxStrokes: (_par: number) => 10 },
] as const;

