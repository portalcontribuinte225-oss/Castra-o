-- Explicit application only; never run through the legacy boot migration file.
-- Apply AFTER the code that stops writing validation keys is deployed.
BEGIN;
DROP TABLE IF EXISTS request_validation_keys;
ALTER TABLE requests DROP COLUMN IF EXISTS validation_key;
COMMIT;
