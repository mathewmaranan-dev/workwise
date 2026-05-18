-- =====================================================
-- COMBINED MIGRATION SCRIPT
-- Run this against your PostgreSQL database to initialize
-- the schema and load sample data with business logic
--
-- Usage with psql:
-- psql -U workwise -d workwise_db -f combined_migration.sql
--
-- Or copy/paste into your database client
-- =====================================================

-- Include the schema migration
\i 001_init_schema.sql

-- Include the sample data migration
\i 002_sample_data.sql

-- Verify the data was loaded correctly
SELECT
  t.ticket_id,
  t.short_description,
  p.priority_level,
  t.created_date,
  t.resolved_date,
  t.sla_duedate,
  t.made_sla,
  t.fcr,
  t.reopen_count,
  t.reassignment_count,
  s.status_name,
  sub.sub_status_name,
  ag.group_name as assignment_group,
  u.email as assigned_to
FROM tickets t
LEFT JOIN priority p ON t.priority_id = p.priority_id
LEFT JOIN status s ON t.status_id = s.status_id
LEFT JOIN sub_status sub ON t.sub_status_id = sub.sub_status_id
LEFT JOIN assignment_groups ag ON t.assignment_group_id = ag.assignment_group_id
LEFT JOIN users u ON t.assigned_to_id = u.user_id
ORDER BY t.ticket_id;