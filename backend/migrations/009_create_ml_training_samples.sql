-- =====================================================
-- ML TRAINING SAMPLES TABLE
-- Stores features extracted from tickets for model training
-- Used to train Non-FCR risk detection model
-- =====================================================

-- Drop the table if it exists with wrong schema
DROP TABLE IF EXISTS ml_training_samples CASCADE;

CREATE TABLE IF NOT EXISTS ml_training_samples (
  training_sample_id SERIAL PRIMARY KEY,
  ticket_id VARCHAR(50) NOT NULL UNIQUE REFERENCES tickets(ticket_id) ON DELETE CASCADE,
  
  -- Assignment and classification features
  assignment_group_id INT REFERENCES assignment_groups(assignment_group_id),
  assigned_to_id INT REFERENCES users(user_id),
  category_id INT NOT NULL REFERENCES category(category_id),
  priority_id INT NOT NULL REFERENCES priority(priority_id),
  impact_id INT NOT NULL REFERENCES impact(impact_id),
  urgency_id INT NOT NULL REFERENCES urgency(urgency_id),
  
  -- Ticket behavior features
  reopen_count INT DEFAULT 0,
  reassignment_count INT DEFAULT 0,
  duration DECIMAL(10, 2),
  
  -- Engineered features
  ticket_complexity DECIMAL(5, 2),
  agent_fcr_history DECIMAL(5, 4),
  category_non_fcr_rate DECIMAL(5, 4),
  
  -- Target label: 1 if Non-FCR (fcr = false), 0 if FCR (fcr = true)
  non_fcr_label INT NOT NULL,
  
  -- Metadata
  source_type VARCHAR(50) DEFAULT 'synthetic',  -- 'synthetic' or 'real'
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  generated_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient training data queries
CREATE INDEX IF NOT EXISTS idx_ml_training_samples_active ON ml_training_samples(is_active);
CREATE INDEX IF NOT EXISTS idx_ml_training_samples_source ON ml_training_samples(source_type);
CREATE INDEX IF NOT EXISTS idx_ml_training_samples_label ON ml_training_samples(non_fcr_label);
CREATE INDEX IF NOT EXISTS idx_ml_training_samples_ticket_id ON ml_training_samples(ticket_id);

COMMENT ON TABLE ml_training_samples IS 'Extracted features from tickets for ML model training. Each row represents a resolved ticket with calculated features and target label.';
COMMENT ON COLUMN ml_training_samples.non_fcr_label IS '1 if ticket resulted in Non-FCR (fcr = false or null), 0 if FCR (fcr = true)';
COMMENT ON COLUMN ml_training_samples.agent_fcr_history IS 'Agent average FCR rate calculated from their ticket history';
COMMENT ON COLUMN ml_training_samples.category_non_fcr_rate IS 'Category average Non-FCR rate calculated from category ticket history';
