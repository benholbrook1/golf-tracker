-- Add 9-hole rating/slope to course_nines and nine_handicap_differential to rounds.
-- Enables USGA 9-hole score differential pairing for handicap index calculation.

ALTER TABLE course_nines ADD COLUMN rating REAL;
ALTER TABLE course_nines ADD COLUMN slope INTEGER;
ALTER TABLE rounds ADD COLUMN nine_handicap_differential REAL;
