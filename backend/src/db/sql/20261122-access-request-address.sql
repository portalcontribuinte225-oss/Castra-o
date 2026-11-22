-- Explicit application only; never run through the legacy boot migration file.
-- Apply BEFORE deploying the credentialing address: the access request route writes these columns.
BEGIN;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS neighborhood TEXT;
COMMIT;
