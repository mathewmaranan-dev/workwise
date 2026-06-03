-- Add 'Closed' status and set logically-closed tickets to that status
INSERT INTO status (status_name)
VALUES ('Closed')
ON CONFLICT (status_name) DO NOTHING;

-- For tickets that have a resolved_date and a closed_by, consider them Closed
UPDATE tickets
SET status_id = (SELECT status_id FROM status WHERE status_name = 'Closed')
WHERE resolved_date IS NOT NULL AND closed_by_id IS NOT NULL;

-- Optional: ensure resolved tickets without closed_by remain as Resolved
-- This keeps a distinction between Resolved and Closed for the ML logic
