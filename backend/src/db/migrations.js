import { pool } from "./index.js";
import bcrypt from "bcryptjs";

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'tutor',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tutor_id UUID REFERENCES users(id),
      protocol TEXT UNIQUE,
      validation_key TEXT,
      tutor_name TEXT,
      tutor_email TEXT,
      cpf TEXT,
      phone TEXT,
      address TEXT,
      neighborhood TEXT,
      city TEXT,
      state TEXT,
      cep TEXT,
      animal_name TEXT,
      species TEXT,
      size TEXT,
      animals JSONB DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'EM_ANALISE',
      request_type TEXT,
      municipality TEXT,
      notes TEXT,
      assigned_sector TEXT,
      schedule_date TEXT,
      schedule_location_name TEXT,
      schedule_address_url TEXT,
      schedule_municipality TEXT,
      responsible_unit TEXT,
      veterinarian TEXT,
      signature_data_url TEXT,
      signed_at TIMESTAMPTZ,
      documents JSONB DEFAULT '[]',
      tags JSONB DEFAULT '[]',
      workflow_data JSONB DEFAULT '{}',
      history JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS request_protocol_counters (
      year INT PRIMARY KEY,
      next_seq INT NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS request_validation_keys (
      cpf TEXT PRIMARY KEY,
      validation_key TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS adoptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      animal_name TEXT NOT NULL,
      species TEXT,
      sex TEXT,
      size TEXT,
      age TEXT,
      description TEXT,
      health JSONB DEFAULT '[]',
      photo_url TEXT,
      status TEXT DEFAULT 'disponivel',
      interests JSONB DEFAULT '[]',
      adopted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schedule_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date TEXT NOT NULL,
      weekday TEXT,
      vacancies INT NOT NULL DEFAULT 0,
      location_name TEXT,
      address_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS animals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      microchip TEXT UNIQUE NOT NULL,
      name TEXT,
      species TEXT,
      sex TEXT,
      size TEXT,
      breed TEXT,
      color TEXT,
      birth_date TEXT,
      status TEXT NOT NULL DEFAULT 'ATIVO',
      current_tutor_id UUID REFERENCES users(id),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS animal_tutors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      tutor_name TEXT,
      tutor_email TEXT,
      cpf TEXT,
      phone TEXT,
      address TEXT,
      neighborhood TEXT,
      city TEXT,
      state TEXT,
      cep TEXT,
      relationship TEXT DEFAULT 'TUTOR',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS animal_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
      request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
      record_type TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      data JSONB DEFAULT '{}',
      created_by UUID REFERENCES users(id),
      occurred_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_type TEXT NOT NULL,
      organization_name TEXT,
      responsible_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      document TEXT,
      city TEXT,
      state TEXT,
      intended_use TEXT,
      assigned_sector TEXT,
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      review_note TEXT,
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      created_user_id UUID REFERENCES users(id),
      temporary_password TEXT,
      history JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS protocol TEXT UNIQUE;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS validation_key TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS cpf TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS neighborhood TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS state TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS cep TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS animals JSONB DEFAULT '[]';
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS schedule_location_name TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS schedule_address_url TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS schedule_municipality TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS responsible_unit TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS veterinarian TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS signature_data_url TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS workflow_data JSONB DEFAULT '{}';
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS latitude TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS longitude TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS animal_id UUID REFERENCES animals(id);
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS animal_microchip TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_tutor_name TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_tutor_email TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_tutor_cpf TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_tutor_phone TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_tutor_address TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_tutor_neighborhood TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_tutor_city TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_tutor_state TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS target_tutor_cep TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS death_date TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS death_cause TEXT;
    ALTER TABLE requests ALTER COLUMN status SET DEFAULT 'EM_ANALISE';

    ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS location_name TEXT;
    ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS address_url TEXT;

    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]';
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS adopted_at TIMESTAMPTZ;
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS sex TEXT;
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS health JSONB DEFAULT '[]';
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS main_photo_index INT DEFAULT 0;

    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS requester_type TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS organization_name TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS responsible_name TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS document TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS state TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS intended_use TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS assigned_sector TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDENTE';
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS review_note TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS created_user_id UUID REFERENCES users(id);
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS temporary_password TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]';
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS requests_protocol_unique_idx
      ON requests (protocol)
      WHERE protocol IS NOT NULL;
    CREATE INDEX IF NOT EXISTS requests_validation_key_idx
      ON requests (validation_key)
      WHERE validation_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS adoptions_interests_gin_idx
      ON adoptions USING GIN (interests);
    CREATE UNIQUE INDEX IF NOT EXISTS animals_microchip_unique_idx
      ON animals (microchip);
    CREATE INDEX IF NOT EXISTS animal_tutors_animal_active_idx
      ON animal_tutors (animal_id, active);
    CREATE INDEX IF NOT EXISTS animal_tutors_cpf_idx
      ON animal_tutors (cpf)
      WHERE cpf IS NOT NULL;
    CREATE INDEX IF NOT EXISTS animal_records_animal_occurred_idx
      ON animal_records (animal_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS requests_animal_id_idx
      ON requests (animal_id)
      WHERE animal_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS requests_animal_microchip_idx
      ON requests (animal_microchip)
      WHERE animal_microchip IS NOT NULL;
    CREATE INDEX IF NOT EXISTS access_requests_status_created_idx
      ON access_requests (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS access_requests_email_idx
      ON access_requests (lower(email));
  `);

  await pool.query(`
    ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;

    UPDATE requests
    SET
      status = CASE
        WHEN status IN ('INDEFERIDA', 'CANCELADA', 'REALIZADA') THEN 'ARQUIVADA'
        WHEN status IN ('DEFERIDA', 'AGENDADA', 'REAGENDADA', 'AGUARDANDO_CIRURGIA') THEN 'AGUARDANDO_CIRURGIA'
        WHEN status IN ('AGUARDANDO_TRIAGEM', 'AGUARDANDO_ATRIBUIR', 'SUBMETIDA', 'TRIAGEM', 'PENDENCIA_DOCUMENTAL', 'EM_ANALISE') THEN 'EM_ANALISE'
        WHEN status = 'ARQUIVADA' THEN 'ARQUIVADA'
        ELSE 'EM_ANALISE'
      END,
      tags = (
        SELECT COALESCE(jsonb_agg(DISTINCT tag), '[]'::jsonb)
        FROM jsonb_array_elements_text(
          COALESCE(tags, '[]'::jsonb) ||
          CASE status
            WHEN 'DEFERIDA' THEN '["DEFERIDA"]'::jsonb
            WHEN 'AGENDADA' THEN '["DEFERIDA"]'::jsonb
            WHEN 'INDEFERIDA' THEN '["INDEFERIDA"]'::jsonb
            WHEN 'REALIZADA' THEN '["DEFERIDA", "COMPARECEU"]'::jsonb
            WHEN 'CANCELADA' THEN '["CANCELADA"]'::jsonb
            WHEN 'REAGENDADA' THEN '["DEFERIDA", "REAGENDADA"]'::jsonb
            ELSE '[]'::jsonb
          END
        ) AS tag
      )
    WHERE status NOT IN ('EM_ANALISE', 'AGUARDANDO_CIRURGIA', 'ARQUIVADA')
       OR status = 'AGUARDANDO_TRIAGEM';

    UPDATE requests
    SET status = 'AGUARDANDO_CIRURGIA'
    WHERE status = 'EM_ANALISE'
      AND COALESCE(tags, '[]'::jsonb) ? 'DEFERIDA'
      AND NOT (COALESCE(tags, '[]'::jsonb) ? 'INDEFERIDA')
      AND NOT (COALESCE(tags, '[]'::jsonb) ? 'COMPARECEU')
      AND NOT (COALESCE(tags, '[]'::jsonb) ? 'CANCELADA');

    ALTER TABLE requests
      ADD CONSTRAINT requests_status_check
      CHECK (status IN ('EM_ANALISE', 'AGUARDANDO_CIRURGIA', 'ARQUIVADA'));
  `);

  await pool.query(`
    INSERT INTO adoptions (
      animal_name,
      species,
      sex,
      age,
      description,
      health,
      photo_url,
      photos,
      main_photo_index,
      status
    )
    SELECT
      'Luna',
      'Felino',
      'Femea',
      '2 anos',
      'Calma, carinhosa e muito companheira. Adora colo, usa a caixinha de areia certinho e se adapta bem em apartamento.',
      '[]'::jsonb,
      '',
      '[]'::jsonb,
      0,
      'disponivel'
    WHERE NOT EXISTS (SELECT 1 FROM adoptions);
  `);

  const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = 'admin'`,
      ["Administrador", adminEmail.trim().toLowerCase(), adminHash],
    );
  }

}
