-- Explicit application only; never run through the legacy boot migration file.
-- Apply AFTER the code that reads the SMS, EmailJS and WhatsApp credentials from the environment is deployed,
-- and after the token variable of each municipality's WhatsApp has been chosen on its screen.
BEGIN;
UPDATE config SET value = value - 'token' - 'tokenPreview' - 'verification'
  WHERE key = 'castragestao:sms' AND municipality_id IS NULL;
DELETE FROM config WHERE key = 'email_account';
UPDATE config SET value = value - 'accessToken' - 'tokenPreview'
  WHERE key = 'whatsapp';
COMMIT;
