-- Add resolved_by_id to tickets for resolution ownership tracking
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS resolved_by_id INT REFERENCES users(user_id);
