import { pool } from "./index.js";
import bcrypt from "bcryptjs";

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS municipalities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      state TEXT,
      slug TEXT UNIQUE,
      contact TEXT,
      email TEXT,
      address TEXT,
      cep TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'tutor',
      municipality_id UUID REFERENCES municipalities(id),
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
      status TEXT NOT NULL DEFAULT 'NOVA',
      request_type TEXT,
      municipality TEXT,
      municipality_id UUID REFERENCES municipalities(id),
      notes TEXT,
      assigned_sector TEXT,
      schedule_date TEXT,
      schedule_location_name TEXT,
      schedule_address TEXT,
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
      municipality_id UUID REFERENCES municipalities(id),
      interests JSONB DEFAULT '[]',
      adopted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schedule_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date TEXT NOT NULL,
      weekday TEXT,
      vacancies INT NOT NULL DEFAULT 0,
      slots JSONB DEFAULT '[]',
      municipality_id UUID REFERENCES municipalities(id),
      location_name TEXT,
      location_address TEXT,
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
      municipality_id UUID REFERENCES municipalities(id),
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
      municipality_id UUID REFERENCES municipalities(id),
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);

    ALTER TABLE requests ADD COLUMN IF NOT EXISTS protocol TEXT UNIQUE;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS validation_key TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS cpf TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS neighborhood TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS state TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS cep TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS animals JSONB DEFAULT '[]';
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS schedule_location_name TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS schedule_address TEXT;
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
    ALTER TABLE requests ALTER COLUMN status SET DEFAULT 'NOVA';

    ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS location_name TEXT;
    ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS location_address TEXT;
    ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS address_url TEXT;
    ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS slots JSONB DEFAULT '[]';
    ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);

    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]';
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS adopted_at TIMESTAMPTZ;
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS sex TEXT;
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS health JSONB DEFAULT '[]';
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS main_photo_index INT DEFAULT 0;
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS animal_id UUID REFERENCES animals(id);
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS animal_microchip TEXT;
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS adoption_tutor JSONB DEFAULT '{}';
    ALTER TABLE adoptions ADD COLUMN IF NOT EXISTS adoption_notes TEXT;

    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS requester_type TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS organization_name TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS responsible_name TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS document TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS state TEXT;
    ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);
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

    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires_at TIMESTAMPTZ;
    UPDATE users SET role = 'suporte' WHERE lower(role) = 'admin' AND municipality_id IS NULL;
    UPDATE users SET role = 'admin_municipal' WHERE lower(role) = 'admin' AND municipality_id IS NOT NULL;
    ALTER TABLE animal_records ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);

    ALTER TABLE config ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);
    ALTER TABLE config DROP CONSTRAINT IF EXISTS config_pkey;
    CREATE UNIQUE INDEX IF NOT EXISTS config_key_municipality_idx ON config (key, COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid));

    UPDATE animal_records ar
    SET municipality_id = r.municipality_id
    FROM requests r
    WHERE ar.request_id = r.id AND ar.municipality_id IS NULL;
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
    CREATE INDEX IF NOT EXISTS requests_municipality_created_idx
      ON requests (municipality_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS schedule_days_municipality_date_idx
      ON schedule_days (municipality_id, date);
    CREATE INDEX IF NOT EXISTS adoptions_municipality_created_idx
      ON adoptions (municipality_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS adoptions_animal_id_idx
      ON adoptions (animal_id)
      WHERE animal_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS adoptions_animal_microchip_idx
      ON adoptions (animal_microchip)
      WHERE animal_microchip IS NOT NULL;
    CREATE INDEX IF NOT EXISTS animal_records_municipality_occurred_idx
      ON animal_records (animal_id, municipality_id, occurred_at DESC);
  `);

  await pool.query(`
    ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS schedule_rule_id TEXT DEFAULT '';

    ALTER TABLE requests ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'PUBLICA';
  `);

  await pool.query(`
    ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS brasao TEXT;
    ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS contact TEXT;
    ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS cep TEXT;
  `);

  /* ── Refatoração de status: EM_ANALISE/AGUARDANDO_CIRURGIA/ARQUIVADA → NOVA/AGENDADA/REALIZADA/CANCELADA ── */
  await pool.query(`
    ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;

    -- Migra registros que ainda usam os status antigos
    UPDATE requests
    SET status = CASE
      WHEN status = 'EM_ANALISE' THEN 'NOVA'
      WHEN status = 'AGUARDANDO_CIRURGIA' THEN 'AGENDADA'
      WHEN status = 'ARQUIVADA' AND (
        COALESCE(tags, '[]'::jsonb) ? 'COMPARECEU'
      ) THEN 'REALIZADA'
      WHEN status = 'ARQUIVADA' THEN 'CANCELADA'
      ELSE status
    END
    WHERE status IN ('EM_ANALISE', 'AGUARDANDO_CIRURGIA', 'ARQUIVADA');

    -- Remove tags que agora são representadas como status
    UPDATE requests
    SET tags = (
      SELECT COALESCE(jsonb_agg(tag), '[]'::jsonb)
      FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS tag
      WHERE tag NOT IN ('DEFERIDA', 'INDEFERIDA', 'COMPARECEU', 'NAO_COMPARECEU', 'CANCELADA')
    )
    WHERE COALESCE(tags, '[]'::jsonb) ?| ARRAY['DEFERIDA','INDEFERIDA','COMPARECEU','NAO_COMPARECEU','CANCELADA'];

    ALTER TABLE requests ALTER COLUMN status SET DEFAULT 'NOVA';

    ALTER TABLE requests
      ADD CONSTRAINT requests_status_check
      CHECK (status IN ('NOVA', 'AGENDADA', 'REALIZADA', 'CANCELADA'));
  `);

  /* ── Revisão Arquitetural: isolamento, auditoria e setores ─────────────── */
  await pool.query(`
    -- Tabela de auditoria: registra toda ação crítica com contexto completo
    CREATE TABLE IF NOT EXISTS audit_logs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      municipality_id UUID REFERENCES municipalities(id) ON DELETE SET NULL,
      user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
      user_email    TEXT,
      action        TEXT NOT NULL,
      entity_type   TEXT,
      entity_id     TEXT,
      changes       JSONB DEFAULT '{}',
      ip_address    TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    -- Tabela de setores: modelo relacional paralelo à config JSON (compatibilidade mantida)
    -- Permite hierarquia futura e consultas SQL diretas sem desserializar JSONB
    CREATE TABLE IF NOT EXISTS sectors (
      id              TEXT NOT NULL,
      municipality_id UUID REFERENCES municipalities(id) NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      is_default      BOOLEAN NOT NULL DEFAULT FALSE,
      created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (id, municipality_id)
    );

    -- Relacionamento usuário ↔ setor: suporta múltiplos setores por usuário
    CREATE TABLE IF NOT EXISTS user_sectors (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      sector_id       TEXT NOT NULL,
      municipality_id UUID REFERENCES municipalities(id) NOT NULL,
      is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, sector_id, municipality_id)
    );

    -- Colunas adicionais em users para auditoria e gestão de ciclo de vida
    ALTER TABLE users ADD COLUMN IF NOT EXISTS active        BOOLEAN     NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by   UUID        REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_default_admin BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login   TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

    -- Índices para performance e isolamento municipal
    CREATE INDEX IF NOT EXISTS audit_logs_municipality_created_idx
      ON audit_logs (municipality_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx
      ON audit_logs (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
      ON audit_logs (action, created_at DESC);

    CREATE INDEX IF NOT EXISTS sectors_municipality_active_idx
      ON sectors (municipality_id, active);

    CREATE INDEX IF NOT EXISTS user_sectors_user_idx
      ON user_sectors (user_id);
    CREATE INDEX IF NOT EXISTS user_sectors_sector_municipality_idx
      ON user_sectors (sector_id, municipality_id);

    CREATE INDEX IF NOT EXISTS users_municipality_active_idx
      ON users (municipality_id, active);
    CREATE INDEX IF NOT EXISTS users_email_lower_idx
      ON users (lower(email));
  `);

  /* ── Nome do órgão/secretaria responsável, exibido como subtítulo do município ── */
  await pool.query(`
    ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS department_name TEXT;
  `);

  const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'master')
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = 'master',
         municipality_id = NULL`,
      ["Administrador", adminEmail.trim().toLowerCase(), adminHash],
    );
  }

}
