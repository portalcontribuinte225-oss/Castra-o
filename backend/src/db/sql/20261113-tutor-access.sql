-- Apply explicitly before deploying phase 5. Never executed by the legacy boot runner.
BEGIN;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD CONSTRAINT users_email_required_for_staff CHECK (email IS NOT NULL OR role = 'tutor');
ALTER TABLE users ADD CONSTRAINT users_id_municipality_unique UNIQUE (id, municipality_id);
-- Fails safely if preflight finds case-folded email collisions; never merge identities automatically.
CREATE UNIQUE INDEX users_email_casefold_unique_idx ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE tutor_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  municipality_id UUID NOT NULL REFERENCES municipalities(id),
  cpf TEXT NOT NULL CHECK (cpf ~ '^[0-9]{11}$'),
  email TEXT,
  phone TEXT,
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (municipality_id, cpf),
  FOREIGN KEY (user_id, municipality_id) REFERENCES users(id, municipality_id)
);
CREATE INDEX tutor_profiles_email_municipality_idx ON tutor_profiles (municipality_id, lower(email)) WHERE email IS NOT NULL;

CREATE TABLE auth_challenges (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  municipality_id UUID REFERENCES municipalities(id),
  audience TEXT NOT NULL CHECK (audience IN ('tutor', 'staff')),
  purpose TEXT NOT NULL CHECK (purpose IN ('password_reset', 'verify_email', 'verify_phone')),
  destination TEXT,
  digest TEXT NOT NULL,
  session_version INTEGER NOT NULL,
  profile_version INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  delivery JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX auth_challenges_user_purpose_idx ON auth_challenges (user_id, purpose, created_at DESC);
CREATE INDEX auth_challenges_expiry_idx ON auth_challenges (expires_at);

CREATE TABLE auth_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX auth_rate_limits_expiry_idx ON auth_rate_limits (expires_at);
COMMIT;
