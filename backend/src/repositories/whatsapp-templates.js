import { pool } from "../db/index.js";
import { logAudit } from "../services/audit.js";

export async function readWhatsappConfigValue(key, municipalityId, database = pool) {
  const { rows } = await database.query("SELECT value FROM config WHERE key=$1 AND municipality_id=$2", [key, municipalityId]);
  return rows[0]?.value;
}

// Read-modify-write under a transaction lock so concurrent saves for one municipality cannot overwrite each other.
// `update` receives the stored value and returns the next one; returning undefined keeps the stored value untouched.
export async function updateWhatsappConfigValue(key, municipalityId, update, { audit, database = pool } = {}) {
  const client = await database.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`whatsapp-templates:${key}:${municipalityId}`]);
    const { rows } = await client.query("SELECT value FROM config WHERE key=$1 AND municipality_id=$2 FOR UPDATE", [key, municipalityId]);
    const next = update(rows[0]?.value);
    if (next !== undefined) {
      await client.query(
        `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
         DO UPDATE SET value=$3, updated_at=NOW()`,
        [key, municipalityId, JSON.stringify(next)],
      );
      if (audit) await logAudit(client, { ...audit, municipalityId });
    }
    await client.query("COMMIT");
    transactionStarted = false;
    return next === undefined ? rows[0]?.value : next;
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
