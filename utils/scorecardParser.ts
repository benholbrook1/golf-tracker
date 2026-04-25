import { ScorecardParseResult, ScorecardParseSchema } from '@/utils/validators';

const SYSTEM_PROMPT = `You parse golf scorecard images. Return ONLY a JSON object — no markdown, no explanation, no code fences.

Shape:
{
  "courseName": "string",
  "tees": [ "Championship", "Blue", "White" ],
  "nines": [
    {
      "name": "Front 9",
      "holes": [
        { "holeNumber": 1, "par": 4, "handicap": 7, "yardages": [ 400, 385, 360 ] }
      ]
    }
  ]
}

Rules:
- "tees" is the list of tee names / colors as columns on the card (left-to-right or top-to-bottom, same order you use in yardages). Include every tee column you can read. If only one column exists, use a one-element array (e.g. [ "Yardage" ] or the printed tee name).
- Each hole has "yardages": an array of integers (or null) with the SAME length as "tees" — [i] is yards from tees[i]. Use null if that cell is missing or illegible.
- Each nine has exactly 9 holes. "holeNumber" must be 1–9 *within that nine* (repeat 1–9 for the second and third nine blocks). Do NOT use 10–18 for the back nine in JSON; use 1–9 for the back nine as well.
- par must be 3–6 (3–5 typical; 6 is rare)
- handicap is the printed stroke index (1–9 per side or 1–18 for full 18; never > 18)
- Return 1 nine for 9-hole cards, 2 for standard 18, 3 for 27-hole facilities
- courseName is the full printed name`;

function getProxyUrl(): string | null {
  return process.env.EXPO_PUBLIC_SCORECARD_LLM_PROXY_URL ?? null;
}

function getGeminiApiKey(): string | null {
  // NOTE: Any EXPO_PUBLIC_* value is bundled into the client. This is acceptable for a
  // personal dev phone MVP, but is NOT safe for App Store distribution.
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? null;
}

function getGeminiModel(): string {
  return process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-1.5-flash';
}

function normalizeProxyPayload(data: unknown): unknown {
  const candidate = (() => {
    if (typeof data === 'string') return data;
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (typeof obj.json === 'string') return obj.json;
      if (typeof obj.result === 'string') return obj.result;
    }
    return data;
  })();

  const clean =
    typeof candidate === 'string' ? candidate.replace(/```json|```/g, '').trim() : JSON.stringify(candidate);

  return JSON.parse(clean);
}

/**
 * DB + schema store hole index 1–9 *within* each nine. Scorecards and LLMs often output 10–18 (or 19–27) as global labels.
 * Map those to 1–9 before Zod/DB.
 */
function holeNumberToLocal1to9(raw: unknown): number {
  const n0 =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw.trim())
        : NaN;
  if (!Number.isFinite(n0)) return 1;
  const h = Math.trunc(n0);
  if (h >= 1 && h <= 9) return h;
  if (h >= 10 && h <= 18) return h - 9;
  if (h >= 19 && h <= 27) return h - 18;
  if (h > 27) return (((h - 1) % 9) + 1) as number; // 28+ (stray global index)
  return 1; // 0 or negative; user can fix in review
}

/** Coerce LLM / legacy JSON into the shape expected by ScorecardParseSchema (tees + yardages per hole). */
export function normalizeScorecardParseJson(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const o = input as Record<string, unknown>;
  const ninesIn = o.nines;
  if (!Array.isArray(ninesIn)) return input;

  const inferYardageColumnCount = (): number => {
    let maxLen = 1;
    for (const nine of ninesIn) {
      if (typeof nine !== 'object' || nine === null) continue;
      const holesIn = (nine as Record<string, unknown>).holes;
      if (!Array.isArray(holesIn)) continue;
      for (const h of holesIn) {
        if (typeof h !== 'object' || h === null) continue;
        const hole = h as Record<string, unknown>;
        if (Array.isArray(hole.yardages) && hole.yardages.length > 0) {
          maxLen = Math.max(maxLen, hole.yardages.length);
        } else if ('yards' in hole) {
          maxLen = Math.max(maxLen, 1);
        }
      }
    }
    return maxLen;
  };

  /** Aligned with `ScorecardParseSchema`: enough columns for busy cards; cap to avoid z.array too_big. */
  const MAX_TEE_COLS = 16;
  const MAX_HOLE_YARDS = 2000;

  const teeListRaw = (() => {
    const t = o.tees;
    if (Array.isArray(t) && t.length > 0) {
      return t.map((x) => (typeof x === 'string' ? x.trim() : String(x)).trim() || 'Tee');
    }
    const nCols = inferYardageColumnCount();
    if (nCols > 1) {
      return Array.from({ length: nCols }, (_, i) => `Tee ${i + 1}`);
    }
    return ['Yardage'] as string[];
  })();
  const tees = teeListRaw.slice(0, MAX_TEE_COLS);
  const teeCount = tees.length;

  const nines = ninesIn.map((nine) => {
    if (typeof nine !== 'object' || nine === null) return nine;
    const n = nine as Record<string, unknown>;
    const holesIn = n.holes;
    if (!Array.isArray(holesIn)) return nine;
    const holes = holesIn.map((h) => {
      if (typeof h !== 'object' || h === null) return h;
      const hole = h as Record<string, unknown>;

      const toNum = (v: unknown): number | null => {
        if (v === null || v === undefined) return null;
        const n0 = typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
        if (!Number.isFinite(n0)) return null;
        if (n0 < 0) return null;
        if (n0 > MAX_HOLE_YARDS) return null; // e.g. total 9/18 printed in a cell, or model typo
        return Math.trunc(n0);
      };

      let yardages: (number | null)[] = [];
      if (Array.isArray(hole.yardages)) {
        yardages = (hole.yardages as unknown[]).map((v) => toNum(v));
      } else if ('yards' in hole) {
        yardages = [toNum(hole.yards)];
      } else {
        yardages = new Array(teeCount).fill(null);
      }
      while (yardages.length < teeCount) yardages.push(null);
      if (yardages.length > teeCount) yardages = yardages.slice(0, teeCount);

      const { yards: _drop, ...rest } = hole;
      const holeNumber = holeNumberToLocal1to9(rest.holeNumber);
      return { ...rest, holeNumber, yardages };
    });
    return { ...n, holes };
  });

  return { ...o, tees, nines };
}

function extractGeminiText(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Gemini response: unexpected shape');
  }

  const root = data as Record<string, unknown>;
  const candidates = root.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Gemini response: no candidates');
  }

  const first = candidates[0] as Record<string, unknown>;
  const content = first.content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error('Gemini response: missing content.parts');
  }

  const texts = parts
    .map((p) => (typeof p === 'object' && p !== null ? (p as Record<string, unknown>).text : undefined))
    .filter((t): t is string => typeof t === 'string');

  if (texts.length === 0) {
    throw new Error('Gemini response: no text parts');
  }

  return texts.join('').replace(/```json|```/g, '').trim();
}

async function parseViaProxy(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<unknown> {
  const url = getProxyUrl();
  if (!url) throw new Error('Missing EXPO_PUBLIC_SCORECARD_LLM_PROXY_URL');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaType,
      base64Image,
      systemPrompt: SYSTEM_PROMPT,
    }),
  });

  if (!response.ok) {
    throw new Error(`Scorecard proxy error: ${response.status}`);
  }

  const data: unknown = await response.json();
  return normalizeProxyPayload(data);
}

async function parseViaGeminiDirect(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<unknown> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Missing Gemini config. Set EXPO_PUBLIC_GEMINI_API_KEY for a personal phone MVP, or set EXPO_PUBLIC_SCORECARD_LLM_PROXY_URL for a proxy.'
    );
  }

  const model = getGeminiModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: {
      role: 'system',
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Parse this scorecard. Return JSON only.' },
          {
            inlineData: {
              mimeType: mediaType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      // If unsupported by a given model/API version, Gemini will error and we fall back below.
      responseMimeType: 'application/json',
    },
  };

  const tryRequest = async (payload: unknown) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  };

  let response = await tryRequest(body);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    // Retry without responseMimeType (some setups/models reject unknown fields)
    const fallbackBody = {
      systemInstruction: body.systemInstruction,
      contents: body.contents,
      generationConfig: {
        temperature: 0,
      },
    };
    response = await tryRequest(fallbackBody);
    if (!response.ok) {
      throw new Error(`Gemini error: ${response.status}${text ? ` — ${text}` : ''}`);
    }
  }

  const data: unknown = await response.json();
  const text = extractGeminiText(data);
  return JSON.parse(text);
}

export async function parseScorecardImage(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<ScorecardParseResult> {
  const proxyUrl = getProxyUrl();
  const json: unknown = proxyUrl
    ? await parseViaProxy(base64Image, mediaType)
    : await parseViaGeminiDirect(base64Image, mediaType);

  const normalized = normalizeScorecardParseJson(json);
  return ScorecardParseSchema.parse(normalized);
}
