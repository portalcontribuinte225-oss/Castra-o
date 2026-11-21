import { pool } from "../db/index.js";
import { logAudit } from "../services/audit.js";

// Config rows without a municipality (`municipality_id` NULL) belong to the platform; the others to one municipality. Both are
// matched through the same expression as the unique index on `config`, so a NULL municipality never collides.
export async function readConfigValue(key, municipalityId = null, database = pool) {
  const { rows } = await database.query(
    `SELECT value FROM config WHERE key=$1
       AND COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
    [key, municipalityId],
  );
  return rows[0]?.value;
}

// Read-modify-write under a transaction lock so concurrent saves of one row cannot overwrite each other.
// `update` receives the stored value and returns the next one; returning undefined keeps the stored value untouched.
export async function updateConfigValue(key, municipalityId, update, { audit, database = pool } = {}) {
  const client = await database.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const value = await updateConfigValueInTransaction(client, key, municipalityId, update, audit);
    await client.query("COMMIT");
    transactionStarted = false;
    return value;
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function updateConfigValueInTransaction(client, key, municipalityId, update, audit) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`config-values:${key}:${municipalityId ?? "platform"}`]);
  const { rows } = await client.query(
    `SELECT value FROM config WHERE key=$1
       AND COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
     FOR UPDATE`,
    [key, municipalityId],
  );
  const current = rows[0]?.value;
  const next = update(current);
  if (next === undefined) return current;
  await client.query(
    `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
     DO UPDATE SET value=$3, updated_at=NOW()`,
    [key, municipalityId, JSON.stringify(next)],
  );
  if (audit) await logAudit(client, { ...audit, municipalityId });
  return next;
}
