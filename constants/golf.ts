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
  if (diff <= -2) return { bg: '#1B4332', text: '#D8F3DC' };              // Eagle   — deep muted green / soft mint
  if (diff === -1) return { bg: '#D8F3DC', text: '#1B4332' };             // Birdie  — soft sage / deep green
  if (diff === 0)  return { bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' }; // Par — clean neutral
  if (diff === 1)  return { bg: '#FFF8ED', text: '#92400E' };             // Bogey   — warm cream / amber
  if (diff === 2)  return { bg: '#FFF0F0', text: '#991B1B' };             // Double  — soft blush / deep red
  return                  { bg: '#FFE4E4', text: '#7F1D1D' };             // Triple+ — deeper blush / dark red
}

export const ESC_TABLE = [
  { maxHandicap: 9, maxStrokes: (par: number) => par + 2 },
  { maxHandicap: 19, maxStrokes: (_par: number) => 7 },
  { maxHandicap: 29, maxStrokes: (_par: number) => 8 },
  { maxHandicap: 39, maxStrokes: (_par: number) => 9 },
  { maxHandicap: Infinity, maxStrokes: (_par: number) => 10 },
] as const;

