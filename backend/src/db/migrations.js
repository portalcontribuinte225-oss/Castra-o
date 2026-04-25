import { pool } from "./index.js";

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
      tutor_name TEXT,
      tutor_email TEXT,
      animal_name TEXT,
      species TEXT,
      size TEXT,
      status TEXT NOT NULL DEFAULT 'RASCUNHO',
      request_type TEXT,
      municipality TEXT,
      notes TEXT,
      assigned_sector TEXT,
      schedule_date TEXT,
      documents JSONB DEFAULT '[]',
      history JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS adoptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      animal_name TEXT NOT NULL,
      species TEXT,
      size TEXT,
      age TEXT,
      description TEXT,
      photo_url TEXT,
      status TEXT DEFAULT 'disponivel',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schedule_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date TEXT NOT NULL,
      weekday TEXT,
      vacancies INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("Migrations executadas com sucesso.");
}
