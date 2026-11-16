-- Explicit application only; never run through the legacy boot migration file.
-- Apply BEFORE deploying the "Dados do tutor" tab: the tutor's address now lives on the tutor profile.
BEGIN;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS cep TEXT;
COMMIT;
