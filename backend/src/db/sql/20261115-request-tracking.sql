-- Explicit application only; never run through the legacy boot migration file.
-- Apply BEFORE deploying the request tracking code (phase 7b).
BEGIN;
CREATE TABLE request_tracking_challenges (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  municipality_id UUID NOT NULL REFERENCES municipalities(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  digest TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  delivery JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX request_tracking_challenges_request_idx ON request_tracking_challenges (request_id, created_at DESC);
CREATE INDEX request_tracking_challenges_expiry_idx ON request_tracking_challenges (expires_at);
COMMIT;
