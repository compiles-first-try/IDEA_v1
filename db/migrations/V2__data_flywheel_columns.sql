-- V2__data_flywheel_columns.sql
-- Adds data flywheel columns for fine-tuning, reasoning traces, and quality tracking.

-- agent_events: workload_id — groups calls by logical task type for fine-tuning isolation
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS workload_id VARCHAR(255);

-- agent_events: reasoning_trace — chain-of-thought storage for training signal
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS reasoning_trace TEXT;

-- agent_events: context_utilization_pct — tokens_in / model_context_limit
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS context_utilization_pct FLOAT;

-- agent_events: router_classification_reason — why the router chose that tier
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS router_classification_reason TEXT;

-- artifacts: test_results_breakdown — per-test-case pass/fail array
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS test_results_breakdown JSONB;

-- artifacts: spec_similarity_score — cosine distance to nearest past spec
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS spec_similarity_score FLOAT;

-- Index for fine-tuning isolation queries
CREATE INDEX IF NOT EXISTS idx_agent_events_workload ON agent_events (workload_id);

-- Record this migration
INSERT INTO schema_migrations (version, description) VALUES (2, 'data_flywheel_columns')
ON CONFLICT (version) DO NOTHING;
