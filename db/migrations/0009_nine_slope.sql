-- Add slope to course_nines (nine_ratings migration only executed the first statement).
ALTER TABLE course_nines ADD COLUMN slope INTEGER;
