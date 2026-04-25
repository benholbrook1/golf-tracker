-- Add penalties column to hole_scores (was in schema but never migrated).
ALTER TABLE hole_scores ADD COLUMN penalties INTEGER NOT NULL DEFAULT 0;
