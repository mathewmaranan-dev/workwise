-- Add terms_accepted column to users to track whether user accepted terms
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;

-- Ensure existing users have explicit value
UPDATE users SET terms_accepted = FALSE WHERE terms_accepted IS NULL;
