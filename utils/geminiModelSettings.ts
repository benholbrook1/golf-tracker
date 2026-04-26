import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'golflog_gemini_model_id';

/** Model IDs exposed in app settings (Gemini API `models/...` names). */
export const GEMINI_MODEL_OPTIONS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-lite',
] as const;

export type GeminiModelId = (typeof GEMINI_MODEL_OPTIONS)[number];

export function isGeminiModelId(value: string): value is GeminiModelId {
  return (GEMINI_MODEL_OPTIONS as readonly string[]).includes(value);
}

/** Short labels for the picker (IDs still shown). */
export const GEMINI_MODEL_LABELS: Record<GeminiModelId, string> = {
  'gemini-3.1-flash-lite-preview': '3.1 Flash-Lite (preview)',
  'gemini-2.5-flash-lite': '2.5 Flash-Lite',
  'gemini-2.0-flash-lite': '(Deprecated) 2.0 Flash-Lite',
  'gemini-1.5-flash-lite': '(Deprecated) 1.5 Flash-Lite',
};

export async function getStoredGeminiModel(): Promise<GeminiModelId | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw || !isGeminiModelId(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function setStoredGeminiModel(model: GeminiModelId): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, model);
}

export async function clearStoredGeminiModel(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Resolves the model string for API calls.
 * Order: in-app preference → EXPO_PUBLIC_GEMINI_MODEL → default.
 */
export async function resolveGeminiModelForRequest(): Promise<string> {
  const stored = await getStoredGeminiModel();
  if (stored) return stored;
  const env = process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim();
  if (env) return env;
  return 'gemini-2.5-flash-lite';
}
