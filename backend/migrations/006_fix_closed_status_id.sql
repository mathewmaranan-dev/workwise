-- Ensure 'Closed' has status_id = 5
DO $$
BEGIN
  -- If there's already a 'Closed' with id = 5, nothing to do
  IF EXISTS (SELECT 1 FROM status WHERE status_name = 'Closed' AND status_id = 5) THEN
    RAISE NOTICE 'Closed already has id 5';
  ELSE
    -- Insert a 'Closed' row with id = 5 if id 5 is free
    IF NOT EXISTS (SELECT 1 FROM status WHERE status_id = 5) THEN
      INSERT INTO status (status_id, status_name) VALUES (5, 'Closed');
      RAISE NOTICE 'Inserted Closed with id 5';
    ELSE
      RAISE NOTICE 'Status id 5 already exists with name %', (SELECT status_name FROM status WHERE status_id = 5);
    END IF;

    -- If there is a different 'Closed' row (e.g., id 17), migrate tickets to use id 5 and remove the old row
    IF EXISTS (SELECT 1 FROM status WHERE status_name = 'Closed' AND status_id <> 5) THEN
      UPDATE tickets SET status_id = 5 WHERE status_id = (SELECT status_id FROM status WHERE status_name = 'Closed' AND status_id <> 5);
      DELETE FROM status WHERE status_name = 'Closed' AND status_id <> 5;
      RAISE NOTICE 'Migrated tickets to Closed id 5 and removed old Closed entries';
    END IF;

    -- Reset sequence to at least max(status_id)
    PERFORM setval(pg_get_serial_sequence('status', 'status_id'), (SELECT GREATEST(MAX(status_id), nextval(pg_get_serial_sequence('status', 'status_id')) ) FROM status));
  END IF;
END
$$;
