-- Add shift column to users so we can store Morning/Afternoon/Night
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS shift VARCHAR(32);

-- Optional: backfill a default value for existing users (NULL means unassigned)
-- UPDATE users SET shift = 'Morning' WHERE shift IS NULL;
