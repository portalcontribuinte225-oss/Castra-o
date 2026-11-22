import { pool } from "../db/index.js";
import { SMS_CONFIG_KEY } from "../../../shared/sms-contract.js";
import { AUDIT_ACTIONS } from "../services/audit.js";
import { readConfigValue } from "./config-values.js";

// The SMS account belongs to the platform: one row with no municipality, which only the master changes.
export async function loadSmsAccount(database = pool, lock = false) {
  if (!lock) return (await readConfigValue(SMS_CONFIG_KEY, null, database)) || null;
  const { rows } = await database.query("SELECT value FROM config WHERE key=$1 AND municipality_id IS NULL FOR UPDATE", [SMS_CONFIG_KEY]);
  return rows[0]?.value || null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

// Stores the channel switch (the token lives in the environment). The platform lock also serializes creation of an absent row.
export async function storeSmsAccount({ snapshot, value, actor, changes }, database = pool) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`config:${SMS_CONFIG_KEY}:platform`]);
    const current = await loadSmsAccount(client, true);
    if (JSON.stringify(stableValue(current)) !== JSON.stringify(stableValue(snapshot))) {
      throw Object.assign(new Error("A configuração mudou. Atualize a tela e tente novamente."), { status: 409 });
    }
    await client.query(`INSERT INTO config (key,municipality_id,value,updated_at) VALUES ($1,NULL,$2::jsonb,NOW())
      ON CONFLICT (key,(COALESCE(municipality_id,'00000000-0000-0000-0000-000000000000'::uuid)))
      DO UPDATE SET value=$2::jsonb,updated_at=NOW()`, [SMS_CONFIG_KEY, JSON.stringify(value)]);
    await client.query(`INSERT INTO audit_logs (user_id,municipality_id,action,entity_type,entity_id,changes)
      VALUES ($1,NULL,$2,'config',$3,$4::jsonb)`, [actor.id, AUDIT_ACTIONS.CONFIG_UPDATE, SMS_CONFIG_KEY, JSON.stringify({ key: SMS_CONFIG_KEY, ...changes })]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
