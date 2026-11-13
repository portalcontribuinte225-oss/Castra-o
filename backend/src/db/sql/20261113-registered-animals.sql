-- Explicit application only; never run through the legacy boot migration file.
BEGIN;
ALTER TABLE animals ALTER COLUMN microchip DROP NOT NULL;
CREATE INDEX IF NOT EXISTS animal_tutors_user_active_animal_idx ON animal_tutors (user_id, animal_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS animal_records_municipality_animal_idx ON animal_records (municipality_id, animal_id);
CREATE INDEX IF NOT EXISTS requests_municipality_schedule_date_idx ON requests (municipality_id, schedule_date);
COMMIT;
