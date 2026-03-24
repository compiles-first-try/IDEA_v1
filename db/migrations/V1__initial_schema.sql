-- V1__initial_schema.sql
-- Foundational tables for the Recursive Software Foundry

-- Ensure pgvector extension is loaded
CREATE EXTENSION IF NOT EXISTS vector;

-- Event sourcing: append-only, never update or delete
CREATE TABLE IF NOT EXISTS agent_events (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID NOT NULL DEFAULT gen_random_uuid(),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    agent_id        VARCHAR(255) NOT NULL,
    agent_type      VARCHAR(100) NOT NULL,
    action_type     VARCHAR(100) NOT NULL,
    phase           VARCHAR(50),
    session_id      UUID,
    inputs          JSONB,
    outputs         JSONB,
    model_used      VARCHAR(100),
    tokens_in       INTEGER,
    tokens_out      INTEGER,
    cost_usd        NUMERIC(10, 6),
    duration_ms     INTEGER,
    status          VARCHAR(50) NOT NULL,
    error_message   TEXT,
    parent_event_id UUID
);

-- Vector memory for semantic search
CREATE TABLE IF NOT EXISTS memory_entries (
    id          BIGSERIAL PRIMARY KEY,
    entry_id    UUID NOT NULL DEFAULT gen_random_uuid(),
    agent_id    VARCHAR(255),
    session_id  UUID,
    content     TEXT NOT NULL,
    embedding   vector(768),
    memory_type VARCHAR(50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accessed_at TIMESTAMPTZ,
    importance  FLOAT DEFAULT 0.5,
    metadata    JSONB
);

-- Generated artifacts
CREATE TABLE IF NOT EXISTS artifacts (
    id              BIGSERIAL PRIMARY KEY,
    artifact_id     UUID NOT NULL DEFAULT gen_random_uuid(),
    artifact_type   VARCHAR(100) NOT NULL,
    name            VARCHAR(500) NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    content         TEXT NOT NULL,
    language        VARCHAR(50),
    quality_score   FLOAT,
    test_pass_rate  FLOAT,
    parent_id       UUID,
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB
);

-- Agent blueprints (self-provisioning)
CREATE TABLE IF NOT EXISTS agent_blueprints (
    id              BIGSERIAL PRIMARY KEY,
    blueprint_id    UUID NOT NULL DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    system_prompt   TEXT NOT NULL,
    tools           JSONB,
    memory_config   JSONB,
    eval_criteria   JSONB,
    benchmark_score FLOAT,
    generation      INTEGER NOT NULL DEFAULT 1,
    parent_id       UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT FALSE
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_events_agent_timestamp ON agent_events (agent_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_events_session ON agent_events (session_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_status ON agent_events (status);
CREATE INDEX IF NOT EXISTS idx_memory_entries_embedding ON memory_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_artifacts_type_created ON artifacts (artifact_type, created_at);
CREATE INDEX IF NOT EXISTS idx_blueprints_gen_score ON agent_blueprints (generation, benchmark_score);

-- Record this migration
INSERT INTO schema_migrations (version, description) VALUES (1, 'initial_schema')
ON CONFLICT (version) DO NOTHING;
