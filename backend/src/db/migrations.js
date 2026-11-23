import { pool as migrationPool } from "./index.js";
import bcrypt from "bcryptjs";

// The whole schema of the system. Every statement is idempotent: the boot runs it on a new database, which is then complete, and
// on one already built, which it leaves as it is. A change to an existing database also needs its own SQL in backend/src/db/sql/
// (see AGENT.md); this file always describes the final schema.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS municipalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    state TEXT,
    slug TEXT UNIQUE,
    contact TEXT,
    email TEXT,
    address TEXT,
    address_number TEXT,
    address_complement TEXT,
    neighborhood TEXT,
    cep TEXT,
    department_name TEXT,
    brasao TEXT,
    department_logo TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'tutor',
    municipality_id UUID REFERENCES municipalities(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default_admin BOOLEAN NOT NULL DEFAULT FALSE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    session_version INTEGER NOT NULL DEFAULT 0,
    reset_code TEXT,
    reset_code_expires_at TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT users_email_required_for_staff CHECK (email IS NOT NULL OR role = 'tutor'),
    CONSTRAINT users_id_municipality_unique UNIQUE (id, municipality_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_casefold_unique_idx ON users (lower(email)) WHERE email IS NOT NULL;
  CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
  CREATE INDEX IF NOT EXISTS users_municipality_active_idx ON users (municipality_id, active);

  CREATE TABLE IF NOT EXISTS animals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microchip TEXT UNIQUE,
    name TEXT,
    species TEXT,
    sex TEXT,
    size TEXT,
    breed TEXT,
    color TEXT,
    birth_date TEXT,
    status TEXT NOT NULL DEFAULT 'ATIVO',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS animals_microchip_unique_idx ON animals (microchip);

  CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID REFERENCES municipalities(id),
    protocol TEXT,
    request_type TEXT,
    status TEXT NOT NULL DEFAULT 'NOVA' CHECK (status IN ('NOVA', 'AGENDADA', 'REALIZADA', 'CANCELADA')),
    origin TEXT DEFAULT 'PUBLICA',
    tags JSONB DEFAULT '[]',
    tutor_id UUID REFERENCES users(id),
    tutor_name TEXT,
    tutor_email TEXT,
    cpf TEXT,
    phone TEXT,
    address TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    cep TEXT,
    latitude TEXT,
    longitude TEXT,
    animal_id UUID REFERENCES animals(id),
    animal_microchip TEXT,
    animal_name TEXT,
    species TEXT,
    size TEXT,
    animals JSONB DEFAULT '[]',
    municipality TEXT,
    notes TEXT,
    assigned_sector TEXT,
    schedule_date TEXT,
    schedule_location_name TEXT,
    schedule_address TEXT,
    schedule_address_url TEXT,
    schedule_municipality TEXT,
    responsible_unit TEXT,
    veterinarian TEXT,
    signed_at TIMESTAMPTZ,
    target_tutor_name TEXT,
    target_tutor_email TEXT,
    target_tutor_cpf TEXT,
    target_tutor_phone TEXT,
    target_tutor_address TEXT,
    target_tutor_neighborhood TEXT,
    target_tutor_city TEXT,
    target_tutor_state TEXT,
    target_tutor_cep TEXT,
    death_date TEXT,
    death_cause TEXT,
    is_confidential BOOLEAN DEFAULT FALSE,
    documents JSONB DEFAULT '[]',
    workflow_data JSONB DEFAULT '{}',
    history JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS requests_municipality_protocol_unique_idx ON requests (municipality_id, protocol) WHERE protocol IS NOT NULL;
  CREATE INDEX IF NOT EXISTS requests_municipality_created_idx ON requests (municipality_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS requests_municipality_schedule_date_idx ON requests (municipality_id, schedule_date);
  CREATE INDEX IF NOT EXISTS requests_animal_id_idx ON requests (animal_id) WHERE animal_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS requests_animal_microchip_idx ON requests (animal_microchip) WHERE animal_microchip IS NOT NULL;

  CREATE TABLE IF NOT EXISTS document_counters (
    municipality_id UUID NOT NULL REFERENCES municipalities(id),
    sequence TEXT NOT NULL,
    year INT NOT NULL,
    next_seq INT NOT NULL DEFAULT 1,
    PRIMARY KEY (municipality_id, sequence, year)
  );

  CREATE TABLE IF NOT EXISTS adoptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID REFERENCES municipalities(id),
    animal_id UUID REFERENCES animals(id),
    animal_microchip TEXT,
    animal_name TEXT NOT NULL,
    species TEXT,
    sex TEXT,
    size TEXT,
    age TEXT,
    description TEXT,
    health JSONB DEFAULT '[]',
    photo_url TEXT,
    photos JSONB DEFAULT '[]',
    main_photo_index INTEGER DEFAULT 0,
    status TEXT DEFAULT 'disponivel',
    interests JSONB DEFAULT '[]',
    adoption_tutor JSONB DEFAULT '{}',
    adoption_notes TEXT,
    adopted_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS adoptions_municipality_created_idx ON adoptions (municipality_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS adoptions_animal_id_idx ON adoptions (animal_id) WHERE animal_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS adoptions_animal_microchip_idx ON adoptions (animal_microchip) WHERE animal_microchip IS NOT NULL;
  CREATE INDEX IF NOT EXISTS adoptions_interests_gin_idx ON adoptions USING gin (interests);

  CREATE TABLE IF NOT EXISTS schedule_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID REFERENCES municipalities(id),
    schedule_rule_id TEXT DEFAULT '',
    date TEXT NOT NULL,
    weekday TEXT,
    vacancies INTEGER NOT NULL DEFAULT 0,
    slots JSONB DEFAULT '[]',
    location_name TEXT,
    location_address TEXT,
    address_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS schedule_days_municipality_date_idx ON schedule_days (municipality_id, date);

  CREATE TABLE IF NOT EXISTS config (
    key TEXT NOT NULL,
    municipality_id UUID REFERENCES municipalities(id),
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS config_key_municipality_idx
    ON config (key, COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid));

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
    active BOOLEAN NOT NULL DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS animal_tutors_animal_active_idx ON animal_tutors (animal_id, active);
  CREATE INDEX IF NOT EXISTS animal_tutors_user_active_animal_idx ON animal_tutors (user_id, animal_id) WHERE active = TRUE;
  CREATE INDEX IF NOT EXISTS animal_tutors_cpf_idx ON animal_tutors (cpf) WHERE cpf IS NOT NULL;

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
  CREATE INDEX IF NOT EXISTS animal_records_animal_occurred_idx ON animal_records (animal_id, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS animal_records_municipality_animal_idx ON animal_records (municipality_id, animal_id);
  CREATE INDEX IF NOT EXISTS animal_records_municipality_occurred_idx ON animal_records (animal_id, municipality_id, occurred_at DESC);

  CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID REFERENCES municipalities(id),
    requester_type TEXT NOT NULL,
    organization_name TEXT,
    responsible_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    document TEXT,
    cep TEXT,
    address TEXT,
    address_number TEXT,
    neighborhood TEXT,
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
  CREATE INDEX IF NOT EXISTS access_requests_status_created_idx ON access_requests (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS access_requests_email_idx ON access_requests (lower(email));

  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID REFERENCES municipalities(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    changes JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS audit_logs_municipality_created_idx ON audit_logs (municipality_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx ON audit_logs (user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx ON audit_logs (action, created_at DESC);

  CREATE TABLE IF NOT EXISTS tutor_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    municipality_id UUID NOT NULL REFERENCES municipalities(id),
    cpf TEXT NOT NULL CHECK (cpf ~ '^[0-9]{11}$'),
    email TEXT,
    phone TEXT,
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    address TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    cep TEXT,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (municipality_id, cpf),
    FOREIGN KEY (user_id, municipality_id) REFERENCES users(id, municipality_id)
  );
  CREATE INDEX IF NOT EXISTS tutor_profiles_email_municipality_idx ON tutor_profiles (municipality_id, lower(email)) WHERE email IS NOT NULL;

  CREATE TABLE IF NOT EXISTS auth_challenges (
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
  CREATE INDEX IF NOT EXISTS auth_challenges_user_purpose_idx ON auth_challenges (user_id, purpose, created_at DESC);
  CREATE INDEX IF NOT EXISTS auth_challenges_expiry_idx ON auth_challenges (expires_at);

  CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auth_rate_limits_expiry_idx ON auth_rate_limits (expires_at);

  CREATE TABLE IF NOT EXISTS request_tracking_challenges (
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
  CREATE INDEX IF NOT EXISTS request_tracking_challenges_request_idx ON request_tracking_challenges (request_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS request_tracking_challenges_expiry_idx ON request_tracking_challenges (expires_at);

  CREATE TABLE IF NOT EXISTS staff_notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
      (event_type = 'request_created' AND recipient_user_id IS NULL)
      OR (event_type = 'request_assigned' AND recipient_user_id IS NOT NULL)
    )
  );
  CREATE UNIQUE INDEX IF NOT EXISTS staff_notifications_created_request_idx ON staff_notifications (request_id) WHERE recipient_user_id IS NULL;
  CREATE INDEX IF NOT EXISTS staff_notifications_request_idx ON staff_notifications (request_id);
  CREATE INDEX IF NOT EXISTS staff_notifications_municipality_idx ON staff_notifications (municipality_id, id DESC);
  CREATE INDEX IF NOT EXISTS staff_notifications_recipient_idx ON staff_notifications (recipient_user_id, id DESC) WHERE recipient_user_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS staff_notification_reads (
    notification_id BIGINT NOT NULL REFERENCES staff_notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (notification_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS staff_notification_reads_user_idx ON staff_notification_reads (user_id, notification_id);
`;

export async function runMigrations(pool = migrationPool) {
  await pool.query(SCHEMA);
  // The platform master comes from the server environment; it is created once and never changed by the boot.
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO users (name, email, password, role)
       SELECT $1, $2, $3, 'master'
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = $2)
       ON CONFLICT DO NOTHING`,
      ["Administrador", adminEmail, adminHash],
    );
  }
}
