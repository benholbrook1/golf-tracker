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

  await backfillCourseTeeDataIfNeeded(db);
}

