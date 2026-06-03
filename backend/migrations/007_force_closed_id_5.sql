-- Force 'Closed' status to have status_id = 5 by renaming existing, inserting id 5, migrating tickets, and removing duplicate
DO $$
DECLARE
  old_id INT;
BEGIN
  SELECT status_id INTO old_id FROM status WHERE status_name = 'Closed' AND status_id <> 5 LIMIT 1;
  IF old_id IS NOT NULL THEN
    -- Temporarily rename old row to avoid unique name conflict
    UPDATE status SET status_name = concat('Closed_old_temp_', old_id) WHERE status_id = old_id;
  END IF;

  -- Insert desired id 5 if missing
  IF NOT EXISTS (SELECT 1 FROM status WHERE status_id = 5) THEN
    INSERT INTO status (status_id, status_name) VALUES (5, 'Closed');
  END IF;

  -- If we renamed an old Closed row, migrate tickets referencing it to id 5 and delete the temp row
  IF old_id IS NOT NULL THEN
    UPDATE tickets SET status_id = 5 WHERE status_id = old_id;
    DELETE FROM status WHERE status_id = old_id;
  END IF;

  -- Ensure sequence is advanced
  PERFORM setval(pg_get_serial_sequence('status', 'status_id'), GREATEST((SELECT COALESCE(MAX(status_id),0) FROM status), nextval(pg_get_serial_sequence('status', 'status_id'))));
END
$$;
