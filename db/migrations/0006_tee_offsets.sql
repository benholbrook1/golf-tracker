-- Add per-par average yard offset columns to course_tees.
-- Values are signed integers relative to the course's default tee.
-- NULL means "no offset set".
ALTER TABLE course_tees ADD COLUMN avg_offset_par3 INTEGER;
ALTER TABLE course_tees ADD COLUMN avg_offset_par4 INTEGER;
ALTER TABLE course_tees ADD COLUMN avg_offset_par5 INTEGER;
