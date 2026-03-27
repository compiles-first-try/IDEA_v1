-- V3__v2_capabilities_tables.sql
-- Tables for V2 capability modules: environment scanning and knowledge bus.

CREATE TABLE IF NOT EXISTS held_out_benchmarks (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    category        VARCHAR(255),
    input           TEXT,
    expected_output TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_events (
    id                  SERIAL PRIMARY KEY,
    event_type          VARCHAR(100),
    source_agent        VARCHAR(255),
    content             TEXT,
    confidence          FLOAT,
    affected_workflows  TEXT[],
    validation_status   VARCHAR(50) DEFAULT 'PENDING',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description) VALUES (3, 'v2_capabilities_tables')
ON CONFLICT (version) DO NOTHING;
