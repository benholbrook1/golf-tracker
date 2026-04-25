# ParTracker — AI Model Reference & Implementation Guide

> **Purpose of this document**: This PLAN is the single source of truth for building ParTracker. It is written to be consumed by an AI coding assistant. Every architectural decision, schema definition, component contract, and phase dependency is documented here. Do not deviate from the patterns described without updating this file first.

---

## 1. Project Overview

ParTracker is a **local-first mobile golf scoring app** built with Expo (React Native) and TypeScript. It tracks hole-by-hole scores, calculates handicap index, and provides round analytics. The data model is sync-ready for a future Supabase backend without refactoring.

### Core Principles

- **Local-first**: All data lives in SQLite on-device. No network required to score a round.
- **Sync-ready**: Every table uses UUID primary keys and ISO-8601 `created_at`/`updated_at`/`deleted_at` timestamps. This is non-negotiable — do not use auto-increment integers as PKs.
- **Soft deletes only**: Never call `db.delete()` directly. Set `deletedAt` to the current ISO timestamp. All queries must filter `WHERE deleted_at IS NULL`.
- **Validation at the boundary**: Zod schemas validate all data before it touches the database — especially AI-parsed scorecard output.
- **Type safety end-to-end**: Drizzle ORM provides schema-to-query type safety. Do not write raw SQL strings.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Expo (React Native) | Single codebase for iOS + Android, TypeScript first-class, Expo Go for dev |
| Language | TypeScript (strict mode) | Type safety from schema to UI |
| Local DB | `expo-sqlite` | Bundled with Expo, real SQLite engine, no network |
| ORM | Drizzle ORM (`drizzle-orm/expo-sqlite`) | Type-safe, migration-based, maps 1:1 to SQL |
| Validation | Zod | Schema validation at data entry and AI parse boundaries |
| Navigation | Expo Router (file-based) | Consistent with Expo ecosystem |
| State | React `useState` / `useReducer` | Local component state only for MVP; no global store needed |
| Images (MVP) | `expo-image-picker` | Expo-native image picking for scorecard capture (Phase 3) |
| AI | Pluggable vision-capable LLM provider | Scorecard image parsing via vision API; provider is intentionally undecided |
| Build | EAS Build | Required for production SQLite on device |

---

## 3. Project Structure

```
partracker/
├── app/                          # Expo Router screens
│   ├── (tabs)/
│   │   ├── index.tsx             # Home (placeholder for now)
│   │   ├── rounds.tsx            # Round history
│   │   └── two.tsx               # Stats placeholder (tab title is “Stats”)
│   ├── round/
│   │   ├── new.tsx               # Round setup (course + combo selection)
│   │   ├── [id]/
│   │   │   ├── hole/[number].tsx # Hole entry screen
│   │   │   └── summary.tsx       # Round summary
│   ├── seed.tsx                  # Dev-only seed runner (Expo runtime)
│   └── course/
│       ├── new.tsx               # Manual course creation
│       └── scan.tsx              # AI scorecard scanner
├── db/
│   ├── client.ts                 # DB connection + migration runner (init here)
│   ├── schema.ts                 # All Drizzle table definitions (single source)
│   ├── seed.ts                   # Dev seed script — run before building UI
│   └── migrations/               # Drizzle migrations + Expo migrator bundle
│       ├── migrations.json       # Bundled migration payload consumed by `drizzle-orm/expo-sqlite/migrator`
│       ├── *.sql                 # Generated SQL migrations (`drizzle-kit generate`)
│       └── meta/                 # Drizzle migration metadata (`drizzle-kit generate`)
├── utils/
│   ├── handicap.ts               # HandicapEngine class
│   ├── timestamps.ts             # withTimestamp() helper
│   ├── validators.ts             # All Zod schemas
│   └── scorecardParser.ts        # Vision LLM scorecard parse (provider-agnostic)
├── components/
│   ├── HoleEntry.tsx             # Hole scoring widget
│   ├── ScoreCard.tsx             # Read-only scorecard grid (9 or 18 rows)
│   ├── RoundSummary.tsx          # Post-round stats card
│   └── HandicapBadge.tsx         # Current index display
├── hooks/
│   ├── useRound.ts               # Round data + hole scores
│   ├── useCourses.ts             # Course + nine + combo queries
│   ├── useStats.ts               # Analytics queries
│   └── useCourseImport.ts        # Course creation from scorecard parse (DB writes)
├── constants/
│   └── golf.ts                   # Par ranges, ESC table, score labels
└── app.json
```

---

## 4. Database Schema

> **Critical**: This is the canonical schema. All Drizzle table definitions live in `db/schema.ts`. Do not define tables anywhere else.

### 4.0a Drizzle relations (implemented)

`db/schema.ts` also defines Drizzle `relations(...)` blocks so `db.query.*` can traverse joins (`with: { ... }`) for hooks like `useRound`.

### 4.0 Required constraints and indexes (non-negotiable)

These are part of the canonical schema. Implement them in `db/schema.ts` using Drizzle indexes/unique constraints and ensure they exist in migrations.

**Uniqueness constraints (for data integrity + safe upserts)**

- `course_holes`: unique (`nine_id`, `hole_number`) — prevents duplicate hole definitions per nine
- `hole_scores`: unique (`round_nine_id`, `hole_number`) — guarantees `saveHole()` upserts correctly
- `course_nines`: unique (`course_id`, `name`) — prevents duplicate named loops per course
- `course_combos`: unique (`course_id`, `front_nine_id`, `back_nine_id`) — prevents duplicate combos

**Indexes (for performance; most queries filter these)**

- All tables: index `deleted_at`
- `rounds`: index `date`, `is_complete`, `course_id`, `combo_id`
- `round_nines`: index `round_id`, `nine_id`
- `hole_scores`: index `round_nine_id`, `course_hole_id`
- `course_holes`: index `nine_id`

### 4.1 Shared timestamp columns

Every table includes these three columns, defined once and spread in:

```typescript
// db/schema.ts
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

const timestamps = {
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'), // null = active; ISO string = soft-deleted
};
```

### 4.2 Table definitions

```typescript
// A golf facility (may contain multiple nines)
export const courses = sqliteTable('courses', {
  id:   text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  ...timestamps,
});

// A named 9-hole loop within a facility (e.g. "Pine", "Oak", "Elm")
// Standard 18-hole courses have exactly two: "Front 9" and "Back 9"
export const courseNines = sqliteTable('course_nines', {
  id:       text('id').primaryKey().$defaultFn(() => createId()),
  courseId: text('course_id').notNull().references(() => courses.id),
  name:     text('name').notNull(), // "Front 9" | "Back 9" | "Pine" | "Oak" | "Elm"
  ...timestamps,
});

// Individual hole configuration — belongs to a nine, not a course directly
export const courseHoles = sqliteTable('course_holes', {
  id:         text('id').primaryKey().$defaultFn(() => createId()),
  nineId:     text('nine_id').notNull().references(() => courseNines.id),
  holeNumber: integer('hole_number').notNull(), // 1–9 within the nine (not global 1–18)
  par:        integer('par').notNull(),         // 3, 4, or 5 only
  handicap:   integer('handicap'),              // stroke index 1–9 within the nine; nullable
  yards:      integer('yards'),                 // nullable
  ...timestamps,
});

// A rated 18-hole combination of two nines
// A 27-hole facility has 3 combos (AB, BC, AC); an 18-hole course has 1
// Rating and Slope belong here — they are specific to the combo, not each nine
export const courseCombos = sqliteTable('course_combos', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  courseId:    text('course_id').notNull().references(() => courses.id),
  name:        text('name').notNull(),          // e.g. "Pine/Oak", "18 Holes"
  frontNineId: text('front_nine_id').notNull().references(() => courseNines.id),
  backNineId:  text('back_nine_id').notNull().references(() => courseNines.id),
  rating:      real('rating').notNull(),        // USGA Course Rating (e.g. 72.4)
  slope:       integer('slope').notNull(),      // 55–155
  ...timestamps,
});

// A round of golf — container for one or more round_nines
// comboId is nullable to support 9-hole rounds (no rated combo applies)
export const rounds = sqliteTable('rounds', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  courseId:             text('course_id').notNull().references(() => courses.id),
  comboId:              text('combo_id').references(() => courseCombos.id), // null for 9-hole rounds
  date:                 text('date').notNull(),          // ISO-8601 date "YYYY-MM-DD"
  totalScore:           integer('total_score').notNull().default(0),
  handicapDifferential: real('handicap_differential'),   // null until round is complete
  isComplete:           integer('is_complete', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

// A single nine played within a round
// An 18-hole round has 2 round_nines (nineOrder 1 and 2)
// A 9-hole round has 1 round_nine (nineOrder 1)
export const roundNines = sqliteTable('round_nines', {
  id:        text('id').primaryKey().$defaultFn(() => createId()),
  roundId:   text('round_id').notNull().references(() => rounds.id),
  nineId:    text('nine_id').notNull().references(() => courseNines.id),
  nineOrder: integer('nine_order').notNull(), // 1 = front/first, 2 = back/second
  ...timestamps,
});

// A single hole score — leaf node of the data model
// References courseHoleId to get par, handicap, yards — never duplicates them
export const holeScores = sqliteTable('hole_scores', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  roundNineId:  text('round_nine_id').notNull().references(() => roundNines.id),
  courseHoleId: text('course_hole_id').notNull().references(() => courseHoles.id),
  holeNumber:   integer('hole_number').notNull(), // 1–9 within the nine (denormalized for query convenience)
  strokes:      integer('strokes').notNull(),
  putts:        integer('putts').notNull(),
  fairwayHit:   integer('fairway_hit', { mode: 'boolean' }).notNull().default(false),
  gir:          integer('gir', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});
```

### 4.3 Entity relationships (summary)

```
courses
  └── course_nines (many)
        └── course_holes (9 per nine)
  └── course_combos (1 for 18-hole, 3 for 27-hole)
        ├── front_nine_id → course_nines
        └── back_nine_id  → course_nines

rounds
  ├── course_id → courses
  ├── combo_id  → course_combos (nullable)
  └── round_nines (1 or 2)
        ├── nine_id → course_nines
        └── hole_scores (up to 9)
              └── course_hole_id → course_holes
```

---

## 5. Critical Utilities

> These must be implemented in Phase 1 before any screen is built. Every DB write depends on them.

### 5.1 DB client and migration runner (`db/client.ts`)

```typescript
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from './migrations/migrations.json';
import * as schema from './schema';

const sqlite = openDatabaseSync('partracker.db', { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });

// Call once at app startup in app/_layout.tsx before any screen renders
export async function runMigrations(): Promise<void> {
  await migrate(db, migrations);
}
```

**`app/_layout.tsx` must call `runMigrations()` and await it before rendering any navigator.**

### 5.1a Migrations: Drizzle Kit → Expo migrator bundle (implemented)

`drizzle-kit generate` produces:

- `db/migrations/*.sql`
- `db/migrations/meta/*`

The Expo SQLite migrator (`drizzle-orm/expo-sqlite/migrator`) additionally expects a bundled object at:

- `db/migrations/migrations.json`

with this shape:

```json
{
  "journal": { "entries": [{ "idx": 0, "when": 0, "tag": "0000_name", "breakpoints": true }] },
  "migrations": { "m0000": "CREATE ...;--> statement-breakpoint\n..." }
}
```

**Rule**: whenever you add a new migration SQL file from `drizzle-kit generate`, update `migrations.json` to include the new journal entry **and** the `m0000NN` SQL string (same contents as the `.sql` file, including `--> statement-breakpoint` separators).

### 5.2 Timestamp helper (`utils/timestamps.ts`)

SQLite has no `ON UPDATE` trigger. Every `db.update()` call must use this helper:

```typescript
export function withTimestamp<T extends object>(data: T): T & { updatedAt: string } {
  return { ...data, updatedAt: new Date().toISOString() };
}

// Soft delete — never call db.delete()
export function softDelete(): { deletedAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return { deletedAt: now, updatedAt: now };
}
```

### 5.3 Zod validators (`utils/validators.ts`)

```typescript
import { z } from 'zod';

export const HoleScoreSchema = z.object({
  strokes:    z.number().int().min(1).max(20),
  putts:      z.number().int().min(0).max(10),
  fairwayHit: z.boolean(),
  gir:        z.boolean(),
}).refine((v) => v.putts <= v.strokes, {
  message: 'Putts cannot exceed strokes',
  path: ['putts'],
});

export const CourseHoleSchema = z.object({
  holeNumber: z.number().int().min(1).max(9),
  par:        z.number().int().min(3).max(6),
  // One per tee label (root-level `tees`); DB stores a single set via selected tee on import
  yardages:   z.array(z.number().int().min(0).max(2000).nullable()).min(1).max(16),
  handicap:   z.number().int().min(1).max(18).nullable(),
});

// Output shape expected from the vision LLM scorecard parser (provider-agnostic)
export const ScorecardParseSchema = z.object({
  courseName: z.string().min(1).max(300),
  tees:       z.array(z.string().min(1).max(64)).min(1).max(16),
  nines: z.array(z.object({
    name:  z.string().min(1).max(200),
    holes: z.array(CourseHoleSchema).length(9),
  })).min(1).max(3),
}) /* + refine: each hole.yardages.length === tees.length */;

export type ScorecardParseResult = z.infer<typeof ScorecardParseSchema>;
export type HoleScoreInput = z.infer<typeof HoleScoreSchema>;
```

### 5.4 Constants (`constants/golf.ts`)

```typescript
export const VALID_PARS = [3, 4, 5] as const;

export const SCORE_LABELS: Record<number, string> = {
  [-3]: 'Albatross',
  [-2]: 'Eagle',
  [-1]: 'Birdie',
  [0]:  'Par',
  [1]:  'Bogey',
  [2]:  'Double Bogey',
  [3]:  'Triple Bogey',
};

export function getScoreLabel(strokes: number, par: number): string {
  const diff = strokes - par;
  return SCORE_LABELS[diff] ?? (diff > 0 ? `+${diff}` : `${diff}`);
}

// Equitable Stroke Control — max strokes per hole by course handicap
// Key: course handicap range [min, max], Value: max strokes allowed
export const ESC_TABLE = [
  { maxHandicap: 9,   maxStrokes: (par: number) => par + 2 },
  { maxHandicap: 19,  maxStrokes: (par: number) => 7 },
  { maxHandicap: 29,  maxStrokes: (par: number) => 8 },
  { maxHandicap: 39,  maxStrokes: (par: number) => 9 },
  { maxHandicap: Infinity, maxStrokes: (par: number) => 10 },
];
```

---

## 6. Handicap Engine (`utils/handicap.ts`)

```typescript
import { db } from '@/db/client';
import { rounds, courseCombos } from '@/db/schema';
import { and, desc, isNull, isNotNull, eq } from 'drizzle-orm';

export class HandicapEngine {
  // USGA differential formula
  static calcDifferential(score: number, rating: number, slope: number): number {
    return parseFloat(((score - rating) * 113 / slope).toFixed(1));
  }

  // Best 8 of last 20 differentials × 0.96
  // Returns null if fewer than 3 complete rounds exist (USGA minimum)
  static async getHandicapIndex(): Promise<number | null> {
    const recent = await db
      .select({ diff: rounds.handicapDifferential })
      .from(rounds)
      .where(and(isNotNull(rounds.handicapDifferential), isNull(rounds.deletedAt)))
      .orderBy(desc(rounds.date))
      .limit(20);

    if (recent.length < 3) return null;

    const sorted = recent
      .map(r => r.diff!)
      .sort((a, b) => a - b);

    const best8 = sorted.slice(0, Math.min(8, sorted.length));
    const avg = best8.reduce((sum, d) => sum + d, 0) / best8.length;
    return parseFloat((avg * 0.96).toFixed(1));
  }

  // Playing handicap = Index × (Slope / 113) + (Rating - Par)
  // This is what the player uses on the course — display this, not the raw index
  static calcPlayingHandicap(index: number, slope: number, rating: number, par: number): number {
    return Math.round(index * (slope / 113) + (rating - par));
  }

  // Store differential on round completion — call from round summary screen
  static async saveDifferential(roundId: string): Promise<void> {
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.id, roundId),
      with: { combo: true },
    });

    if (!round?.comboId || !round.combo) return; // 9-hole rounds: skip

    const diff = this.calcDifferential(round.totalScore, round.combo.rating, round.combo.slope);
    await db.update(rounds)
      .set(withTimestamp({ handicapDifferential: diff, isComplete: true }))
      .where(eq(rounds.id, roundId));
  }
}
```

---

## 7. AI Scorecard Parser (`utils/scorecardParser.ts`)

```typescript
// Canonical implementation lives in-repo at `utils/scorecardParser.ts`.

// It supports two modes:
// 1) Proxy mode (recommended):
//    - EXPO_PUBLIC_SCORECARD_LLM_PROXY_URL
// 2) Personal-phone MVP mode (Gemini direct):
//    - EXPO_PUBLIC_GEMINI_API_KEY
//    - EXPO_PUBLIC_GEMINI_MODEL (optional; defaults to gemini-1.5-flash)

// In both cases, the output is validated with `ScorecardParseSchema` before any DB write.
// `normalizeScorecardParseJson` maps legacy `yards` → `yardages`, infers `tees` from column count if needed, and maps global hole labels (10–18, 19–27) to 1–9 per nine for `holeNumber`.
```

> **API key**: For user-facing distribution, do not ship provider API keys in the app bundle. Use a thin backend/edge function proxy (Supabase Edge Function is fine) and keep keys server-side.

> **Personal MVP exception**: direct Gemini mode uses `EXPO_PUBLIC_GEMINI_API_KEY`, which is bundled into the client build. This is OK for a phone-only summer build, but treat the key as **non-secret** (anyone with the binary can extract it).

> **Local config (no paid proxy)**: keep secrets out of git by copying `.env.example` → `.env` at the repo root and setting `EXPO_PUBLIC_GEMINI_API_KEY` there. Expo loads `.env*` for `expo start` / dev clients; restart the dev server after edits.

> **Implemented note**: `app/course/scan.tsx` reads the picked image as base64 with `expo-file-system` `File#base64()` before calling `parseScorecardImage()`. Review screen: editable **course name**, **tee set** (which parsed column becomes `course_holes.yards`), and per-hole edits.

---

## 8. Data Hooks

Hooks abstract all DB queries. **Target rule**: screens/components should not import `db` directly (see Invariant #13.7 for current MVP exceptions).

### 8.1 `hooks/useCourses.ts`

```typescript
export function useCourses() {
  // Returns: Course[], loading, error
  // Query: SELECT * FROM courses WHERE deleted_at IS NULL ORDER BY name
}

export function useCourseDetail(courseId: string) {
  // Returns: { course, nines: (CourseNine & { holes: CourseHole[] })[], combos: CourseCombo[] }
  // Used by round setup screen to display combo options
}
```

### 8.2 `hooks/useRound.ts`

```typescript
export function useRound(roundId: string) {
  // Returns: {
  //   round: Round & { combo: CourseCombo | null },
  //   roundNines: (RoundNine & { nine: CourseNine, holes: HoleScore[] })[],
  //   totalScore: number,
  //   saveHole: (roundNineId, courseHoleId, holeNumber, data: HoleScoreInput) => Promise<void>,
  //   completeRound: () => Promise<void>,
  // }
}
```

`saveHole` must upsert — update if a score exists for that `roundNineId` + `holeNumber`, insert otherwise. It also recalculates and updates `rounds.totalScore` on every call.

### 8.3 `hooks/useStats.ts`

```typescript
export function useStats() {
  // Returns computed analytics across all complete rounds
  // See Section 10 for query examples
}
```

---

## 9. Screen Contracts

### 9.1 Round setup (`app/round/new.tsx`)

**Flow**:
1. User selects a course from `useCourses()`
2. Screen shows available combos (18-hole options) and individual nines (9-hole option)
3. User picks one → screen creates `rounds` row + `round_nines` rows → navigates to `round/[id]/hole/1`

**What gets created**:
```typescript
// For an 18-hole round with a combo:
const round = await db.insert(rounds).values({
  courseId: selectedCourseId,
  comboId:  selectedCombo.id,
  date:     new Date().toISOString().split('T')[0], // "YYYY-MM-DD"
  totalScore: 0,
}).returning();

await db.insert(roundNines).values([
  { roundId: round[0].id, nineId: combo.frontNineId, nineOrder: 1 },
  { roundId: round[0].id, nineId: combo.backNineId,  nineOrder: 2 },
]);

// For a 9-hole round (no combo, no differential):
const round = await db.insert(rounds).values({
  courseId: selectedCourseId,
  comboId:  null,
  date:     new Date().toISOString().split('T')[0],
  totalScore: 0,
}).returning();

await db.insert(roundNines).values([
  { roundId: round[0].id, nineId: selectedNineId, nineOrder: 1 },
]);
```

### 9.2 Hole entry (`app/round/[id]/hole/[number].tsx`)

**Routing**: `number` is the **global** hole number (1–18). The screen resolves which `roundNine` and `courseHole` this corresponds to:

- Holes 1–9 → `roundNines[nineOrder=1]`, `courseHoles[holeNumber=number]`
- Holes 10–18 → `roundNines[nineOrder=2]`, `courseHoles[holeNumber=number-9]`

**State**: The `HoleEntry` component manages local state (strokes, putts, fairwayHit, gir). On "Save", it calls `useRound().saveHole()`. The screen then navigates to the next hole or to `round/[id]/summary` after hole 18.

**Navigation**: Prev/Next buttons must not navigate past the bounds of the round (e.g. a 9-hole round has no hole 10).

**Par source**: Always fetched from `courseHoles` via the hook — never hardcoded. The component receives `par` as a prop, sourced from `courseHole.par`.

**UI (implemented)**:
- Hide the native stack header on this screen (`headerShown: false`) so navigation is primarily via **Prev/Next/Summary** controls.

**Validation (implemented)**:
- `HoleScoreSchema` enforces **`putts <= strokes`** (and `HoleEntry` clamps putts as strokes change).

### 9.3 Round summary (`app/round/[id]/summary.tsx`)

Displays:
- Score vs par (total and per hole)
- Putts per hole / average
- GIR% and Fairway%
- Handicap differential (if 18-hole complete round)
- Option to edit any hole (navigates back to hole entry)

On first load, calls `HandicapEngine.saveDifferential(roundId)` if the round is complete and `isComplete` is false.

**Delete round (implemented)**:
- Summary includes **Delete round** which soft-deletes the round subtree (`rounds`, `round_nines`, `hole_scores`) and returns to the rounds list.

### 9.4 Course scanner (`app/course/scan.tsx`)

**Flow**:
1. User captures/selects image via `expo-image-picker` (MVP default for Expo)
2. Image converted to base64 via `expo-file-system` (`File#base64()`)
3. `parseScorecardImage()` called automatically — loading state shown (result includes `tees[]` and per-hole `yardages[]` for multi-tee scorecards; legacy `yards` is normalized in `normalizeScorecardParseJson`)
4. Zod-validated result displayed for user review: **course name** (saved as `courses.name`), **tee set** (which column maps to `course_holes.yards`), editable par / yardage (for the selected tee) / handicap
5. User confirms → `confirmScorecardParse(data, { selectedTeeIndex })` writes course + nines + holes (one yardage per hole from the selected tee)
6. Navigate to round setup (`/round/new`)

**Never write to DB before user confirms the parsed result.**

---

## 10. Analytics Queries

All queries must include `WHERE deleted_at IS NULL`. Use these as the basis for `useStats`.

```typescript
// Average putts per hole across all complete rounds
const puttStats = await db
  .select({
    roundNineId: holeScores.roundNineId,
    avgPutts:  avg(holeScores.putts),
  })
  .from(holeScores)
  .innerJoin(roundNines, eq(holeScores.roundNineId, roundNines.id))
  .innerJoin(rounds, eq(roundNines.roundId, rounds.id))
  .where(and(isNull(holeScores.deletedAt), eq(rounds.isComplete, true)))
  .groupBy(holeScores.roundNineId);

// GIR% and Fairway% per round
const greenStats = await db
  .select({
    roundId:     roundNines.roundId,
    totalHoles:  count(holeScores.id),
    girsHit:     sql<number>`SUM(CASE WHEN ${holeScores.gir} = 1 THEN 1 ELSE 0 END)`,
    fairwaysHit: sql<number>`SUM(CASE WHEN ${holeScores.fairwayHit} = 1 THEN 1 ELSE 0 END)`,
  })
  .from(holeScores)
  .innerJoin(roundNines, eq(holeScores.roundNineId, roundNines.id))
  .where(isNull(holeScores.deletedAt))
  .groupBy(roundNines.roundId);

// Score trend over last 10 rounds
const scoreTrend = await db
  .select({ date: rounds.date, totalScore: rounds.totalScore })
  .from(rounds)
  .where(and(isNull(rounds.deletedAt), eq(rounds.isComplete, true)))
  .orderBy(desc(rounds.date))
  .limit(10);
```

---

## 11. Seed Script (`db/seed.ts`)

Run this in development before building any UI. It exercises every table relationship.

```typescript
// Creates: Westmount Golf & CC
//   → Front 9 (holes 1–9, pars: 4,3,5,4,3,4,5,4,3)
//   → Back 9  (holes 1–9, pars: 4,5,3,4,4,5,3,4,4)
//   → Combo "18 Holes" (rating 72.1, slope 128)
// Then creates one complete round with all 18 hole scores filled
// Then creates one 9-hole round (front nine only)
```

Run with: open `app/seed.tsx` in the simulator and tap **Run seed** (recommended).

> Note: `expo-sqlite` is not reliably runnable under plain Node for `ts-node db/seed.ts` in this repo setup. If you later add a Node-compatible SQLite driver for scripts, you can re-enable CLI seeding — but the Expo-runtime seed screen is the supported dev path for now.

---

## 12. Build Phases

### Phase 1 — Foundation ✦ Do this first, do not skip steps

**Goal**: DB works, migrations run on launch, all utilities exist, seed populates successfully.

- [x] Install dependencies: `expo-sqlite`, `drizzle-orm`, `drizzle-kit`, `@paralleldrive/cuid2`, `zod`, `expo-image-picker`
- [x] Write `db/schema.ts` with all 6 tables exactly as defined in Section 4 **plus** required indexes/uniques (Section 4.0) **plus** Drizzle relations (Section 4.0a)
- [x] Run `drizzle-kit generate` to produce SQL migrations **and** maintain `migrations/migrations.json` for Expo (Section 5.1a)
- [x] Write `db/client.ts` with `runMigrations()` export
- [x] Wire `runMigrations()` into `app/_layout.tsx` — await before rendering
- [x] Write `utils/timestamps.ts` — `withTimestamp()` and `softDelete()`
- [x] Write `utils/validators.ts` — all Zod schemas
- [x] Write `constants/golf.ts` — score labels, ESC table, `getScoreLabel()`
- [x] Write and run `db/seed.ts` — verify all rows created, all JOINs work (via `app/seed.tsx`)
- [x] **Gate**: seed runs without error and all foreign keys resolve before proceeding

### Phase 2 — Core Scoring Loop

**Goal**: A user can set up a round, enter 18 holes, and see a summary.

- [x] `hooks/useCourses.ts` — course list and detail queries
- [x] `hooks/useRound.ts` — round data, `saveHole()` upsert, `completeRound()`, `deleteRound()` (soft delete round subtree)
- [x] `app/round/new.tsx` — course picker → combo/nine picker → creates round + roundNines
- [x] `components/HoleEntry.tsx` — strokes/putts counter, fairway/GIR toggles, save button (**putts clamped to strokes**)
- [x] `app/round/[id]/hole/[number].tsx` — loads par from courseHoles, hosts HoleEntry, handles prev/next navigation (**native header hidden**)
- [x] `components/ScoreCard.tsx` — read-only scorecard grid (**N rows**: 9 or 18 depending on round) with score vs par colouring
- [x] `app/round/[id]/summary.tsx` — calls `HandicapEngine.saveDifferential()`, shows all stats (**includes delete round**)
- [x] `app/(tabs)/rounds.tsx` — list of past rounds, tap to view summary (**refreshes on tab focus**)
- [x] **Gate**: complete a full 18-hole round end-to-end, verify differential stored, verify soft delete works on a round

### Phase 3 — Stats and AI

**Goal**: Analytics dashboard works, scorecard scanner creates a course.

- [x] `utils/handicap.ts` — `HandicapEngine` exists early (includes `getHandicapIndex()` + `saveDifferential()`); polish/UI belongs here
- [x] `components/HandicapBadge.tsx` — displays current index, handles null (< 3 rounds)
- [x] `hooks/useStats.ts` — stats aggregates + trends (implemented with Drizzle selects + in-JS aggregates; avoids raw `sql` template fragments)
- [x] `app/(tabs)/two.tsx` (Stats tab) — dashboard: GIR%, FW% (par 3 excluded), avg putts/hole, last-10 score/putts spark bars, avg putts-by-hole grid
- [x] `utils/scorecardParser.ts` — provider-agnostic vision parse + Zod validation (proxy via `EXPO_PUBLIC_SCORECARD_LLM_PROXY_URL`, or personal MVP direct Gemini via `EXPO_PUBLIC_GEMINI_API_KEY`)
- [x] `app/course/scan.tsx` — photo pick → base64 → parse → editable review → confirm to DB (`confirmScorecardParse`)
- [x] `app/course/new.tsx` — manual course entry fallback (default 18-hole template; same confirm path as scanner)
- [ ] **Gate**: scan a real scorecard photo, verify parsed output, confirm to DB, start a round using scanned course

### Phase 4 — Sync-Ready Hardening

**Goal**: App is production-ready for TestFlight/Play Store and safe for real users.

- [ ] Configure EAS Build (`eas.json`) — required for SQLite in production
- [ ] Move any LLM provider secrets to a server-side proxy (Supabase Edge Function is fine) — do not ship long-lived API keys in the app bundle
- [x] Root `app/_layout.tsx` exports a custom `ErrorBoundary` (Expo Router) with retry — not per-DB-call, but catches render errors
- [x] Loading/empty states improved on Home, Courses, Rounds, Stats, New round (not yet “every” screen)
- [ ] Add error boundaries on all DB operations — catch disk-full and constraint errors (deferred: use try/catch in hooks)
- [ ] Verify `deletedAt` filter present on every query in hooks
- [ ] Verify `withTimestamp()` called on every `db.update()`
- [ ] **Gate**: install via TestFlight on a fresh device, complete a round, reinstall app, verify data persists

---

## 13. Invariants — Never Break These

These are rules the codebase must always satisfy. Check them during any refactor.

1. **No integer PKs.** All primary keys are UUIDs from `createId()`.
2. **No hard deletes.** All deletes use `softDelete()` which sets `deletedAt`.
3. **No raw SQL strings.** All queries use Drizzle ORM methods.
4. **No par hardcoding.** Par always comes from `courseHoles.par`, never from a constant array.
5. **`updatedAt` on every write.** Every `db.update()` must call `withTimestamp()`.
6. **Zod before DB.** Any externally-sourced data (AI parse, user input from forms) is validated with the relevant Zod schema before any DB write.
7. **Hooks own queries (target architecture).** Prefer keeping all Drizzle queries/mutations in `hooks/*` (or a dedicated data layer) so screens/components stay thin.
   - **Current MVP exception (Phase 2 shipped this way)**: `app/round/new.tsx` and `app/(tabs)/rounds.tsx` import `db` directly for inserts/list queries. Refactor these into hooks when touching those files next.
8. **Differential only for complete 18-hole rounds.** `handicapDifferential` stays null if `comboId` is null or `roundNines.length < 2`.
9. **9-hole rounds are valid.** A round with one `roundNine` and no `comboId` is a complete, valid data state — not an error.
10. **Migration-first schema changes.** Any schema change requires a new `drizzle-kit generate` run before any code references the new column.

---

## 14. Future Considerations (Post-MVP)

These are explicitly deferred. Do not implement during MVP phases.

- **Cloud sync (Supabase)**: The schema is ready. Add a `syncedAt` column per table and a background sync worker in Phase 5.
- **Course directory API**: GHIN or GolfCourseRanking API for searching courses by name. Plugs into the course setup flow.
- **ESC adjustment**: Apply Equitable Stroke Control before storing `handicapDifferential`. The `ESC_TABLE` constant is already defined; the application logic is deferred.
- **Multi-user / sharing**: Rounds are currently single-player. Adding `userId` to `rounds` is the only schema change required.
- **Watch app**: Expo doesn't support watchOS directly. Deferred until cloud sync exists.

---

*Last updated: 2026-04-24 — Phase 1–3 as before. **UX refinements:** Home hub; **Courses** tab (list, edit name + combo rating/slope, delete if no rounds); `useCourses` / `useCourseDetail` **refresh**; New round **date** + preselect `courseId` from scan/manual; Rounds **Resume** → `getResumeTarget()`; round summary **New round at this course** + **View stats**; About **modal**; dev **seed** only in `__DEV__`; 9/18/27 **global hole** resolution on hole/summary/stats (offset `(nineOrder-1)*9`).*