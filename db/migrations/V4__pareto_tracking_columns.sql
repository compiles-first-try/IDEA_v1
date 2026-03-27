-- V4__pareto_tracking_columns.sql
-- Adds Pareto front tracking columns to agent_events for cost/quality optimization.
-- Source: ROUTING_CLAUDE.md Section 5

ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  task_tier SMALLINT;                              -- 1, 2, or 3
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  task_cost_usd FLOAT;                             -- actual cost of this execution
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  task_quality_score FLOAT;                        -- quality gate score (0-1)
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  cache_hit BOOLEAN DEFAULT FALSE;                 -- was this served from cache?
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS
  escalated_from_tier SMALLINT;                    -- NULL if first attempt, else prior tier

CREATE INDEX IF NOT EXISTS idx_agent_events_pareto
  ON agent_events (task_tier, task_cost_usd, task_quality_score);

-- Record this migration
INSERT INTO schema_migrations (version, description) VALUES (4, 'pareto_tracking_columns')
ON CONFLICT (version) DO NOTHING;
