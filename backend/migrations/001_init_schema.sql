-- =====================================================
-- IT SERVICE MANAGEMENT TICKETING DATA MODEL
-- Based on ERD Schema with Sample Data Support
-- =====================================================

-- 1. ROLES TABLE
CREATE TABLE IF NOT EXISTS roles (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ASSIGNMENT GROUPS TABLE
CREATE TABLE IF NOT EXISTS assignment_groups (
  assignment_group_id SERIAL PRIMARY KEY,
  group_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL DEFAULT 3 REFERENCES roles(role_id),
  assignment_group_id INT REFERENCES assignment_groups(assignment_group_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. PRIORITY TABLE
CREATE TABLE IF NOT EXISTS priority (
  priority_id SERIAL PRIMARY KEY,
  priority_level VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. IMPACT TABLE
CREATE TABLE IF NOT EXISTS impact (
  impact_id SERIAL PRIMARY KEY,
  impact_level VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. URGENCY TABLE
CREATE TABLE IF NOT EXISTS urgency (
  urgency_id SERIAL PRIMARY KEY,
  urgency_level VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. STATUS TABLE
CREATE TABLE IF NOT EXISTS status (
  status_id SERIAL PRIMARY KEY,
  status_name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. SUB_STATUS TABLE
CREATE TABLE IF NOT EXISTS sub_status (
  sub_status_id SERIAL PRIMARY KEY,
  sub_status_name VARCHAR(100) NOT NULL,
  status_id INT NOT NULL REFERENCES status(status_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sub_status_name, status_id)
);

-- 9. CATEGORY TABLE
CREATE TABLE IF NOT EXISTS category (
  category_id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. SUBCATEGORY TABLE
CREATE TABLE IF NOT EXISTS subcategory (
  subcategory_id SERIAL PRIMARY KEY,
  subcategory_name VARCHAR(100) NOT NULL,
  category_id INT NOT NULL REFERENCES category(category_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subcategory_name, category_id)
);

-- 11. CHANNEL TABLE
CREATE TABLE IF NOT EXISTS channel (
  channel_id SERIAL PRIMARY KEY,
  channel_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. SOURCE TABLE
CREATE TABLE IF NOT EXISTS source (
  source_id SERIAL PRIMARY KEY,
  source_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. CONFIGURATION_ITEMS TABLE
CREATE TABLE IF NOT EXISTS configuration_items (
  config_item_id SERIAL PRIMARY KEY,
  item_name VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. SLA TABLE
CREATE TABLE IF NOT EXISTS sla (
  sla_id SERIAL PRIMARY KEY,
  sla_name VARCHAR(100) NOT NULL UNIQUE,
  sla_hours INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. TICKETS TABLE (Main Table)
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id VARCHAR(50) PRIMARY KEY,
  created_date TIMESTAMP NOT NULL,
  resolved_date TIMESTAMP,
  last_reopened_at TIMESTAMP,
  duration DECIMAL(10, 2),
  reopen_count INT DEFAULT 0,
  reassignment_count INT DEFAULT 0,
  short_description TEXT,
  work_notes TEXT,
  made_sla BOOLEAN DEFAULT FALSE,
  fcr BOOLEAN DEFAULT FALSE,

  -- User references
  requester_id INT NOT NULL REFERENCES users(user_id),
  assigned_to_id INT REFERENCES users(user_id),
  closed_by_id INT REFERENCES users(user_id),

  -- Assignment and ticket classification
  assignment_group_id INT REFERENCES assignment_groups(assignment_group_id),
  priority_id INT NOT NULL REFERENCES priority(priority_id),
  impact_id INT NOT NULL REFERENCES impact(impact_id),
  urgency_id INT NOT NULL REFERENCES urgency(urgency_id),
  status_id INT NOT NULL REFERENCES status(status_id),
  sub_status_id INT REFERENCES sub_status(sub_status_id),
  category_id INT NOT NULL REFERENCES category(category_id),
  subcategory_id INT NOT NULL REFERENCES subcategory(subcategory_id),
  channel_id INT NOT NULL REFERENCES channel(channel_id),
  source_id INT NOT NULL REFERENCES source(source_id),
  config_item_id INT REFERENCES configuration_items(config_item_id),
  sla_id INT NOT NULL REFERENCES sla(sla_id),
  sla_duedate TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. SURVEY TABLE (Customer Satisfaction)
CREATE TABLE IF NOT EXISTS survey (
  survey_id SERIAL PRIMARY KEY,
  ticket_id VARCHAR(50) NOT NULL UNIQUE REFERENCES tickets(ticket_id),
  survey_response BOOLEAN,
  survey_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. FORECAST TABLE (System-Level Predictions)
CREATE TABLE IF NOT EXISTS forecast (
  forecast_id SERIAL PRIMARY KEY,
  forecast_date TIMESTAMP NOT NULL,
  forecast_type VARCHAR(100) NOT NULL,
  forecast_value INT NOT NULL,
  forecast_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. TICKET_FORECAST TABLE (Many-to-Many Junction)
CREATE TABLE IF NOT EXISTS ticket_forecast (
  ticket_id VARCHAR(50) NOT NULL REFERENCES tickets(ticket_id),
  forecast_id INT NOT NULL REFERENCES forecast(forecast_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ticket_id, forecast_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tickets_created_date ON tickets(created_date);
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_id ON tickets(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignment_group_id ON tickets(assignment_group_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_id ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority_id ON tickets(priority_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_assignment_group_id ON users(assignment_group_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_sub_status_status_id ON sub_status(status_id);
CREATE INDEX IF NOT EXISTS idx_subcategory_category_id ON subcategory(category_id);
CREATE INDEX IF NOT EXISTS idx_survey_ticket_id ON survey(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_forecast_ticket_id ON ticket_forecast(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_forecast_forecast_id ON ticket_forecast(forecast_id);

-- =====================================================
-- SEED DATA - LOOKUP TABLES
-- =====================================================

-- Roles
INSERT INTO roles (role_name) VALUES 
  ('admin'),
  ('manager'),
  ('agent'),
  ('hr')
ON CONFLICT (role_name) DO NOTHING;

-- Priority (from sample data: Low, Medium, High)
INSERT INTO priority (priority_level) VALUES 
  ('Low'),
  ('Medium'),
  ('High')
ON CONFLICT (priority_level) DO NOTHING;

-- Impact (from sample data: Low, Medium, High)
INSERT INTO impact (impact_level) VALUES 
  ('Low'),
  ('Medium'),
  ('High')
ON CONFLICT (impact_level) DO NOTHING;

-- Urgency (from sample data: Phone, Web, Email - assuming Low, Medium, High)
INSERT INTO urgency (urgency_level) VALUES 
  ('Low'),
  ('Medium'),
  ('High')
ON CONFLICT (urgency_level) DO NOTHING;

-- Status (from sample data: Resolved, Pending, In Progress, New)
INSERT INTO status (status_name) VALUES 
  ('New'),
  ('In Progress'),
  ('Resolved'),
  ('Pending')
ON CONFLICT (status_name) DO NOTHING;

-- Sub Status (from sample data: empty, Pending Customer Response)
INSERT INTO sub_status (sub_status_name, status_id) VALUES 
  ('Pending Customer Response', (SELECT status_id FROM status WHERE status_name = 'Pending'))
ON CONFLICT (sub_status_name, status_id) DO NOTHING;

-- Category (from sample data: Password, Server, Network, Software, Hardware)
INSERT INTO category (category_name) VALUES 
  ('Password'),
  ('Server'),
  ('Network'),
  ('Software'),
  ('Hardware')
ON CONFLICT (category_name) DO NOTHING;

-- Subcategory (from sample data mapped to categories)
INSERT INTO subcategory (subcategory_name, category_id) VALUES 
  ('Wifi', (SELECT category_id FROM category WHERE category_name = 'Password')),
  ('CPU', (SELECT category_id FROM category WHERE category_name = 'Server')),
  ('App Error', (SELECT category_id FROM category WHERE category_name = 'Software')),
  ('Maintenance', (SELECT category_id FROM category WHERE category_name = 'Server')),
  ('Access', (SELECT category_id FROM category WHERE category_name = 'Password')),
  ('Update', (SELECT category_id FROM category WHERE category_name = 'Software')),
  ('Peripherals', (SELECT category_id FROM category WHERE category_name = 'Hardware'))
ON CONFLICT (subcategory_name, category_id) DO NOTHING;

-- Channel (from sample data: Email, Phone, Chat, Mobile App, Walk-in, Self Service)
INSERT INTO channel (channel_name) VALUES 
  ('Email'),
  ('Phone'),
  ('Chat'),
  ('Mobile App'),
  ('Walk-in'),
  ('Self Service')
ON CONFLICT (channel_name) DO NOTHING;

-- Source (from sample data: Phone, Email, Chat, Self Service, Walk-in - same as channel)
INSERT INTO source (source_name) VALUES 
  ('Email'),
  ('Phone'),
  ('Chat'),
  ('Self Service'),
  ('Walk-in')
ON CONFLICT (source_name) DO NOTHING;

-- Configuration Items (from sample data: Laptop, Server, Software)
INSERT INTO configuration_items (item_name) VALUES 
  ('Laptop'),
  ('Server'),
  ('Software')
ON CONFLICT (item_name) DO NOTHING;

-- SLA (default SLA definitions)
INSERT INTO sla (sla_name, sla_hours) VALUES 
  ('Standard SLA', 24),
  ('Priority SLA', 4),
  ('Emergency SLA', 1)
ON CONFLICT (sla_name) DO NOTHING;

-- Assignment Groups (from sample data)
INSERT INTO assignment_groups (group_name) VALUES 
  ('Software Team'),
  ('Network Team'),
  ('Service Desk'),
  ('Hardware Team')
ON CONFLICT (group_name) DO NOTHING;

-- =====================================================
-- SEED DATA - USERS (from sample data)
-- =====================================================

INSERT INTO users (first_name, last_name, email, password_hash, role_id, assignment_group_id) VALUES
  ('Laura', 'Diaz', 'laura.diaz@company.com', '$2b$10$dummy_hash_1', 3, (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Software Team')),
  ('Ulises', 'Gomez', 'ulises.gomez@company.com', '$2b$10$dummy_hash_2', 3, (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Network Team')),
  ('Alice', 'Mendoza', 'alice.mendoza@company.com', '$2b$10$dummy_hash_3', 3, (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Service Desk')),
  ('Teresa', 'Herrera', 'teresa.herrera@company.com', '$2b$10$dummy_hash_4', 3, (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Network Team')),
  ('Kevin', 'Ramos', 'kevin.ramos@company.com', '$2b$10$dummy_hash_5', 3, (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Software Team')),
  ('Quentin', 'De Leon', 'quentin.deleon@company.com', '$2b$10$dummy_hash_6', 3, (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Hardware Team')),
  ('Mark', 'Castillo', 'mark.castillo@company.com', '$2b$10$dummy_hash_7', 3, (SELECT assignment_group_id FROM assignment_groups WHERE group_name = 'Software Team')),
  -- Requesters
  ('Pennie', 'Eldredge', 'pennie.eldredge@company.com', '$2b$10$dummy_hash_8', 3, NULL),
  ('Lidia', 'Wrennall', 'lidia.wrennall@company.com', '$2b$10$dummy_hash_9', 3, NULL),
  ('Werner', 'Kettlesting', 'werner.kettlesting@company.com', '$2b$10$dummy_hash_10', 3, NULL),
  ('Erena', 'Benezet', 'erena.benezet@company.com', '$2b$10$dummy_hash_11', 3, NULL),
  ('Jakob', 'Fleisch', 'jakob.fleisch@company.com', '$2b$10$dummy_hash_12', 3, NULL),
  ('Debee', 'Fatharly', 'debee.fatharly@company.com', '$2b$10$dummy_hash_13', 3, NULL),
  ('Loren', 'Isakovitch', 'loren.isakovitch@company.com', '$2b$10$dummy_hash_14', 3, NULL),
  ('Normand', 'Entwisle', 'normand.entwisle@company.com', '$2b$10$dummy_hash_15', 3, NULL),
  ('Dino', 'O Culligan', 'dino.oculigan@company.com', '$2b$10$dummy_hash_16', 3, NULL),
  ('Toni', 'Colcomb', 'toni.colcomb@company.com', '$2b$10$dummy_hash_17', 3, NULL),
  -- Admin user
  ('Admin', 'User', 'admin@company.com', '$2b$10$dummy_hash_admin', 1, NULL)
ON CONFLICT (email) DO NOTHING;
