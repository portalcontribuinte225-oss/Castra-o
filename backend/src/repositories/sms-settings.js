import { pool } from "../db/index.js";
import { SMS_CONFIG_KEY } from "../../../shared/sms-contract.js";
import { AUDIT_ACTIONS } from "../services/audit.js";

const unavailable = () => Object.assign(new Error("Selecione um município ativo."), { status: 400 });

// The application uses pg; this adapter reuses its existing pool and explicit tenant predicates.
export async function assertSmsMunicipality(municipalityId, database = pool) {
  if (typeof municipalityId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(municipalityId)) throw unavailable();
  const { rows } = await database.query("SELECT id FROM municipalities WHERE id=$1 AND active=TRUE", [municipalityId]);
  if (!rows[0]) throw unavailable();
}

export async function loadSmsRecord(municipalityId, database = pool, lock = false) {
  const { rows } = await database.query(`SELECT value FROM config WHERE key=$1 AND municipality_id=$2${lock ? " FOR UPDATE" : ""}`, [SMS_CONFIG_KEY, municipalityId]);
  return rows[0]?.value || null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

// Provider validation is already finished. A municipal lock also serializes creation of an absent row.
export async function storeSmsRecord({ municipalityId, snapshot, value, actor, changes }, database = pool) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`config:${SMS_CONFIG_KEY}:${municipalityId}`]);
    await assertSmsMunicipality(municipalityId, client);
    const current = await loadSmsRecord(municipalityId, client, true);
    if (JSON.stringify(stableValue(current)) !== JSON.stringify(stableValue(snapshot))) {
      throw Object.assign(new Error("A configuração mudou. Atualize a tela e tente novamente."), { status: 409 });
    }
    await client.query(`INSERT INTO config (key,municipality_id,value,updated_at) VALUES ($1,$2,$3::jsonb,NOW())
      ON CONFLICT (key,(COALESCE(municipality_id,'00000000-0000-0000-0000-000000000000'::uuid)))
      DO UPDATE SET value=$3::jsonb,updated_at=NOW()`, [SMS_CONFIG_KEY, municipalityId, JSON.stringify(value)]);
    await client.query(`INSERT INTO audit_logs (user_id,municipality_id,action,entity_type,entity_id,changes)
      VALUES ($1,$2,$3,'config',$4,$5::jsonb)`, [actor.id, municipalityId, AUDIT_ACTIONS.CONFIG_UPDATE, SMS_CONFIG_KEY,
      JSON.stringify({ key: SMS_CONFIG_KEY, municipalityId, ...changes })]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
