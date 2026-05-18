-- =====================================================
-- SAMPLE DATA INSERTS WITH BUSINESS LOGIC
-- Based on CSV data with proper SLA, FCR, and status logic
-- =====================================================

-- Insert sample tickets with business logic applied
INSERT INTO tickets (
  ticket_id,
  created_date,
  resolved_date,
  last_reopened_at,
  duration,
  reopen_count,
  reassignment_count,
  short_description,
  work_notes,
  made_sla,
  fcr,

  requester_id,
  assigned_to_id,
  closed_by_id,

  assignment_group_id,
  priority_id,
  impact_id,
  urgency_id,
  status_id,
  sub_status_id,
  category_id,
  subcategory_id,
  channel_id,
  source_id,
  config_item_id,
  sla_id,
  sla_duedate
) VALUES
-- Ticket 1: Low priority, Resolved, Made SLA TRUE, FCR FALSE (reopen_count > 0)
('1',
 '2026-02-10 00:00:00'::timestamp,
 '2026-02-11 00:00:00'::timestamp, -- Resolved date (within SLA)
 '2025-11-07 00:00:00'::timestamp, -- Last reopened (reopen_count > 0)
 115.71,
 1, -- reopen_count > 0
 0, -- reassignment_count
 'Pellentesque at nulla.',
 'Fusce posuere felis sed lacus. Morbi sem mauris, laoreet ut, rhoncus aliquet, pulvinar sed, nisl. Nunc rhoncus dui vel sem.',
 TRUE, -- Made SLA (resolved within 4 days)
 FALSE, -- FCR FALSE (reopen_count > 0, not Service Desk)

 (SELECT user_id FROM users WHERE email = 'pennie.eldredge@company.com'), -- Requester
 (SELECT user_id FROM users WHERE email = 'laura.diaz@company.com'), -- Assigned to
 (SELECT user_id FROM users WHERE email = 'laura.diaz@company.com'), -- Closed by

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Software Team'),
 (SELECT priority_id FROM priority WHERE priority_level = 'Low'),
 (SELECT impact_id FROM impact WHERE impact_level = 'Medium'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'Low'),
 (SELECT status_id FROM status WHERE status_name = 'Resolved'),
 NULL, -- No sub_status for Resolved
 (SELECT category_id FROM category WHERE category_name = 'Password'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'Wifi'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Email'),
 (SELECT source_id FROM source WHERE source_name = 'Phone'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Laptop'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Standard SLA'),
 '2026-02-14 00:00:00'::timestamp -- SLA due: 4 days from created
),

-- Ticket 2: Low priority, Pending, Made SLA FALSE, FCR FALSE (reopen_count > 0), Sub Status present
('2',
 '2026-02-11 00:00:00'::timestamp,
 NULL, -- No resolved date (status = Pending)
 '2025-03-07 00:00:00'::timestamp, -- Last reopened (reopen_count > 0)
 45.14,
 1, -- reopen_count > 0
 1, -- reassignment_count > 0
 'Vivamus in felis eu sapien cursus vestibulum.',
 'Cras non velit nec nisi vulputate nonummy.',
 FALSE, -- Made SLA FALSE (not resolved)
 FALSE, -- FCR FALSE (reopen_count > 0, reassignment_count > 0)

 (SELECT user_id FROM users WHERE email = 'lidia.wrennall@company.com'),
 (SELECT user_id FROM users WHERE email = 'ulises.gomez@company.com'),
 NULL, -- No closed_by (not resolved)

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Network Team'),
 (SELECT priority_id FROM priority WHERE priority_level = 'Low'),
 (SELECT impact_id FROM impact WHERE impact_level = 'Low'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'Low'),
 (SELECT status_id FROM status WHERE status_name = 'Pending'),
 (SELECT sub_status_id FROM sub_status WHERE sub_status_name = 'Pending Customer Response'), -- Sub status for Pending
 (SELECT category_id FROM category WHERE category_name = 'Server'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'CPU'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Phone'),
 (SELECT source_id FROM source WHERE source_name = 'Phone'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Server'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Standard SLA'),
 '2026-02-15 00:00:00'::timestamp -- SLA due: 4 days from created
),

-- Ticket 3: High priority, In Progress, Made SLA TRUE, FCR FALSE (reopen_count > 0)
('3',
 '2026-02-13 00:00:00'::timestamp,
 NULL, -- No resolved date (status = In Progress)
 '2025-03-06 00:00:00'::timestamp, -- Last reopened (reopen_count > 0)
 137.11,
 2, -- reopen_count > 0
 0, -- reassignment_count
 'Cras non velit nec nisi vulputate nonummy.',
 'Nullam porttitor lacus at turpis. Donec posuere metus vitae ipsum.',
 TRUE, -- Made SLA TRUE (within SLA window)
 FALSE, -- FCR FALSE (reopen_count > 0)

 (SELECT user_id FROM users WHERE email = 'werner.kettlesting@company.com'),
 (SELECT user_id FROM users WHERE email = 'alice.mendoza@company.com'),
 NULL, -- No closed_by (not resolved)

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Service Desk'),
 (SELECT priority_id FROM priority WHERE priority_level = 'High'),
 (SELECT impact_id FROM impact WHERE impact_level = 'High'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'High'),
 (SELECT status_id FROM status WHERE status_name = 'In Progress'),
 NULL, -- No sub_status for In Progress
 (SELECT category_id FROM category WHERE category_name = 'Network'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'App Error'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Email'),
 (SELECT source_id FROM source WHERE source_name = 'Email'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Software'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Priority SLA'),
 '2026-02-13 04:00:00'::timestamp -- SLA due: 4 hours from created (24 hours total)
),

-- Ticket 4: Medium priority, In Progress, Made SLA TRUE, FCR FALSE (reassignment_count > 0)
('4',
 '2026-02-15 00:00:00'::timestamp,
 NULL, -- No resolved date (status = In Progress)
 NULL, -- No last_reopened_at (reopen_count = 0)
 151.52,
 0, -- reopen_count = 0
 0, -- reassignment_count = 0 (but FCR FALSE because not Service Desk)
 'Donec semper sapien a libero.',
 'Fusce congue, diam id ornare imperdiet, sapien urna pretium nisl, ut volutpat sapien arcu sed augue. Aliquam erat volutpat. In congue. Etiam justo.',
 TRUE, -- Made SLA TRUE (within SLA window)
 FALSE, -- FCR FALSE (not Service Desk)

 (SELECT user_id FROM users WHERE email = 'erena.benezet@company.com'),
 (SELECT user_id FROM users WHERE email = 'teresa.herrera@company.com'),
 NULL, -- No closed_by (not resolved)

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Network Team'),
 (SELECT priority_id FROM priority WHERE priority_level = 'Medium'),
 (SELECT impact_id FROM impact WHERE impact_level = 'Medium'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'Medium'),
 (SELECT status_id FROM status WHERE status_name = 'In Progress'),
 NULL, -- No sub_status for In Progress
 (SELECT category_id FROM category WHERE category_name = 'Password'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'Maintenance'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Phone'),
 (SELECT source_id FROM source WHERE source_name = 'Chat'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Software'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Standard SLA'),
 '2026-02-17 00:00:00'::timestamp -- SLA due: 2 days from created
),

-- Ticket 5: Medium priority, Resolved, Made SLA TRUE, FCR FALSE (reassignment_count > 0)
('5',
 '2026-02-15 00:00:00'::timestamp,
 '2026-02-15 00:00:00'::timestamp, -- Resolved date (same day)
 NULL, -- No last_reopened_at (reopen_count = 0)
 130.56,
 0, -- reopen_count = 0
 0, -- reassignment_count = 0 (but FCR FALSE because not Service Desk)
 'Pellentesque at nulla.',
 'Integer tincidunt ante vel ipsum.',
 TRUE, -- Made SLA TRUE (resolved within 2 days)
 FALSE, -- FCR FALSE (not Service Desk)

 (SELECT user_id FROM users WHERE email = 'jakob.fleisch@company.com'),
 (SELECT user_id FROM users WHERE email = 'kevin.ramos@company.com'),
 (SELECT user_id FROM users WHERE email = 'kevin.ramos@company.com'), -- Closed by

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Software Team'),
 (SELECT priority_id FROM priority WHERE priority_level = 'Medium'),
 (SELECT impact_id FROM impact WHERE impact_level = 'Low'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'Low'),
 (SELECT status_id FROM status WHERE status_name = 'Resolved'),
 NULL, -- No sub_status for Resolved
 (SELECT category_id FROM category WHERE category_name = 'Server'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'Access'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Email'),
 (SELECT source_id FROM source WHERE source_name = 'Email'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Server'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Standard SLA'),
 '2026-02-17 00:00:00'::timestamp -- SLA due: 2 days from created
),

-- Ticket 6: High priority, In Progress, Made SLA TRUE, FCR FALSE (reopen_count > 0)
('6',
 '2026-02-20 00:00:00'::timestamp,
 NULL, -- No resolved date (status = In Progress)
 '2025-04-19 00:00:00'::timestamp, -- Last reopened (reopen_count > 0)
 151.67,
 2, -- reopen_count > 0
 0, -- reassignment_count
 'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec pharetra, magna vestibulum aliquet ultrices, erat tortor sollicitudin mi, sit amet lobortis sapien sapien non mi. Integer ac neque.',
 'Nulla justo. Aliquam quis turpis eget elit sodales scelerisque. Mauris sit amet eros. Suspendisse accumsan tortor quis turpis. Sed ante.',
 TRUE, -- Made SLA TRUE (within SLA window)
 FALSE, -- FCR FALSE (reopen_count > 0)

 (SELECT user_id FROM users WHERE email = 'debee.fatharly@company.com'),
 (SELECT user_id FROM users WHERE email = 'ulises.gomez@company.com'),
 NULL, -- No closed_by (not resolved)

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Network Team'),
 (SELECT priority_id FROM priority WHERE priority_level = 'High'),
 (SELECT impact_id FROM impact WHERE impact_level = 'High'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'High'),
 (SELECT status_id FROM status WHERE status_name = 'In Progress'),
 NULL, -- No sub_status for In Progress
 (SELECT category_id FROM category WHERE category_name = 'Server'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'Wifi'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Email'),
 (SELECT source_id FROM source WHERE source_name = 'Chat'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Software'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Priority SLA'),
 '2026-02-20 04:00:00'::timestamp -- SLA due: 4 hours from created (24 hours total)
),

-- Ticket 7: Medium priority, New, Made SLA TRUE, FCR TRUE (Service Desk, no reopens/reassignments)
('7',
 '2026-02-21 00:00:00'::timestamp,
 NULL, -- No resolved date (status = New)
 NULL, -- No last_reopened_at (reopen_count = 0)
 26.49,
 0, -- reopen_count = 0
 0, -- reassignment_count = 0
 'Sed sagittis. Nam congue, risus semper porta volutpat, quam pede lobortis ligula, sit amet eleifend pede libero quis orci.',
 'Morbi non quam nec dui luctus rutrum. Nulla tellus.',
 TRUE, -- Made SLA TRUE (within SLA window)
 TRUE, -- FCR TRUE (Service Desk, no reopens/reassignments)

 (SELECT user_id FROM users WHERE email = 'loren.isakovitch@company.com'),
 (SELECT user_id FROM users WHERE email = 'teresa.herrera@company.com'),
 NULL, -- No closed_by (not resolved)

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Network Team'),
 (SELECT priority_id FROM priority WHERE priority_level = 'Medium'),
 (SELECT impact_id FROM impact WHERE impact_level = 'Medium'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'Medium'),
 (SELECT status_id FROM status WHERE status_name = 'New'),
 NULL, -- No sub_status for New
 (SELECT category_id FROM category WHERE category_name = 'Password'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'Update'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Phone'),
 (SELECT source_id FROM source WHERE source_name = 'Email'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Laptop'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Standard SLA'),
 '2026-02-23 00:00:00'::timestamp -- SLA due: 2 days from created
),

-- Ticket 8: High priority, Resolved, Made SLA TRUE, FCR FALSE (reopen_count > 0)
('8',
 '2026-02-22 00:00:00'::timestamp,
 '2026-02-22 00:00:00'::timestamp, -- Resolved date (same day)
 '2023-01-22 00:00:00'::timestamp, -- Last reopened (reopen_count > 0)
 29.48,
 2, -- reopen_count > 0
 0, -- reassignment_count
 'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec pharetra, magna vestibulum aliquet ultrices, erat tortor sollicitudin mi, sit amet lobortis sapien sapien non mi. Integer ac neque.',
 'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec pharetra, magna vestibulum aliquet ultrices, erat tortor sollicitudin mi, sit amet lobortis sapien sapien non mi.',
 TRUE, -- Made SLA TRUE (resolved within 24 hours)
 FALSE, -- FCR FALSE (reopen_count > 0)

 (SELECT user_id FROM users WHERE email = 'normand.entwisle@company.com'),
 (SELECT user_id FROM users WHERE email = 'quentin.deleon@company.com'),
 (SELECT user_id FROM users WHERE email = 'quentin.deleon@company.com'), -- Closed by

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Hardware Team'),
 (SELECT priority_id FROM priority WHERE priority_level = 'High'),
 (SELECT impact_id FROM impact WHERE impact_level = 'Low'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'Low'),
 (SELECT status_id FROM status WHERE status_name = 'Resolved'),
 NULL, -- No sub_status for Resolved
 (SELECT category_id FROM category WHERE category_name = 'Software'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'Peripherals'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Self Service'),
 (SELECT source_id FROM source WHERE source_name = 'Self Service'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Laptop'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Priority SLA'),
 '2026-02-22 04:00:00'::timestamp -- SLA due: 4 hours from created (24 hours total)
),

-- Ticket 9: Medium priority, In Progress, Made SLA TRUE, FCR TRUE (Service Desk, no reopens/reassignments)
('9',
 '2026-02-24 00:00:00'::timestamp,
 NULL, -- No resolved date (status = In Progress)
 NULL, -- No last_reopened_at (reopen_count = 0)
 143.74,
 0, -- reopen_count = 0
 0, -- reassignment_count = 0
 'Aenean auctor gravida sem.',
 'Maecenas pulvinar lobortis est. Phasellus sit amet erat. Nulla tempus. Vivamus in felis eu sapien cursus vestibulum. Proin eu mi.',
 TRUE, -- Made SLA TRUE (within SLA window)
 TRUE, -- FCR TRUE (Service Desk, no reopens/reassignments)

 (SELECT user_id FROM users WHERE email = 'dino.oculigan@company.com'),
 (SELECT user_id FROM users WHERE email = 'mark.castillo@company.com'),
 NULL, -- No closed_by (not resolved)

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Software Team'),
 (SELECT priority_id FROM priority WHERE priority_level = 'Medium'),
 (SELECT impact_id FROM impact WHERE impact_level = 'High'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'High'),
 (SELECT status_id FROM status WHERE status_name = 'In Progress'),
 NULL, -- No sub_status for In Progress
 (SELECT category_id FROM category WHERE category_name = 'Software'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'Wifi'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Email'),
 (SELECT source_id FROM source WHERE source_name = 'Email'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Laptop'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Standard SLA'),
 '2026-02-26 00:00:00'::timestamp -- SLA due: 2 days from created
),

-- Ticket 10: High priority, New, Made SLA TRUE, FCR FALSE (reassignment_count > 0)
('10',
 '2026-02-24 00:00:00'::timestamp,
 NULL, -- No resolved date (status = New)
 '2025-09-10 00:00:00'::timestamp, -- Last reopened (reopen_count > 0)
 37.01,
 4, -- reopen_count > 0
 1, -- reassignment_count > 0
 'Suspendisse potenti. Cras in purus eu magna vulputate luctus.',
 'Integer ac leo.',
 TRUE, -- Made SLA TRUE (within SLA window)
 FALSE, -- FCR FALSE (reopen_count > 0, reassignment_count > 0)

 (SELECT user_id FROM users WHERE email = 'toni.colcomb@company.com'),
 (SELECT user_id FROM users WHERE email = 'laura.diaz@company.com'),
 NULL, -- No closed_by (not resolved)

 (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Software Team'),
 (SELECT priority_id FROM priority WHERE priority_level = 'High'),
 (SELECT impact_id FROM impact WHERE impact_level = 'Medium'),
 (SELECT urgency_id FROM urgency WHERE urgency_level = 'Medium'),
 (SELECT status_id FROM status WHERE status_name = 'New'),
 NULL, -- No sub_status for New
 (SELECT category_id FROM category WHERE category_name = 'Software'),
 (SELECT subcategory_id FROM subcategory WHERE subcategory_name = 'App Error'),
 (SELECT channel_id FROM channel WHERE channel_name = 'Self Service'),
 (SELECT source_id FROM source WHERE source_name = 'Self Service'),
 (SELECT config_item_id FROM configuration_items WHERE item_name = 'Laptop'),
 (SELECT sla_id FROM sla WHERE sla_name = 'Priority SLA'),
 '2026-02-24 04:00:00'::timestamp -- SLA due: 4 hours from created (24 hours total)
);

-- Insert survey data for resolved tickets
INSERT INTO survey (ticket_id, survey_response, survey_comments) VALUES
('1', TRUE, 'Suspendisse potenti.'),
('2', FALSE, NULL),
('3', TRUE, 'Morbi non quam nec dui luctus rutrum. Nulla tellus.'),
('4', FALSE, NULL),
('5', FALSE, NULL),
('6', FALSE, NULL),
('7', FALSE, NULL),
('8', TRUE, 'Proin interdum mauris non ligula pellentesque ultrices. Phasellus id sapien in sapien iaculis congue. Vivamus metus arcu, adipiscing molestie, hendrerit at, vulputate vitae, nisl.'),
('9', TRUE, NULL),
('10', FALSE, NULL);