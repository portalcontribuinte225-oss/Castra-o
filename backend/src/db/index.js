import pg from "pg";
import "../env.js";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const sslMode = String(process.env.DATABASE_SSL || process.env.PGSSLMODE || "").toLowerCase();
const remoteSslHosts = ["render.com", "neon.tech", "supabase.co"];
const useSsl = ["1", "true", "require", "required", "yes"].includes(sslMode)
  || (!sslMode && remoteSslHosts.some((host) => databaseUrl?.includes(host)));

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});
