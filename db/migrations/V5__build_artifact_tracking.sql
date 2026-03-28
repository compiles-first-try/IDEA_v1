-- V5: Link artifacts to builds for traceability and improvement data collection
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS build_session_id UUID;
CREATE INDEX IF NOT EXISTS idx_artifacts_build_session ON artifacts (build_session_id);

-- Track when feedback was incorporated into an improvement cycle
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS feedback_incorporated_at TIMESTAMPTZ;
