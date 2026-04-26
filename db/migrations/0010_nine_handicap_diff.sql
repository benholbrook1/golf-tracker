-- Add nine_handicap_differential to rounds (nine_ratings migration only executed the first statement).
ALTER TABLE rounds ADD COLUMN nine_handicap_differential REAL;
