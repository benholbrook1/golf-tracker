import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { backfillCourseTeeDataIfNeeded } from './teeBackfill';
import migrations from './migrations/migrations.json';
import * as schema from './schema';

const sqlite = openDatabaseSync('partracker.db', { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });

// Call once at app startup in app/_layout.tsx before any screen renders
export async function runMigrations(): Promise<void> {
  await migrate(db, migrations);

  // Belt-and-suspenders: drizzle's expo-sqlite migrator only executes the first
  // statement per migration entry (SQLite's prepareSync limitation).  Any
  // multi-statement migration silently skips the rest.  Detect and apply
  // missing columns directly via PRAGMA so this is idempotent on every start.
  ensureMissingColumns();

  await backfillCourseTeeDataIfNeeded(db);
}

function ensureMissingColumns() {
  type ColInfo = { name: string };

  const ninesCols = sqlite.getAllSync<ColInfo>('PRAGMA table_info(course_nines)');
  const roundsCols = sqlite.getAllSync<ColInfo>('PRAGMA table_info(rounds)');

  if (!ninesCols.find((c) => c.name === 'rating')) {
    sqlite.runSync('ALTER TABLE course_nines ADD COLUMN rating REAL');
  }
  if (!ninesCols.find((c) => c.name === 'slope')) {
    sqlite.runSync('ALTER TABLE course_nines ADD COLUMN slope INTEGER');
  }
  if (!roundsCols.find((c) => c.name === 'nine_handicap_differential')) {
    sqlite.runSync('ALTER TABLE rounds ADD COLUMN nine_handicap_differential REAL');
  }
}
