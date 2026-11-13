import { pool } from "../db/index.js";
import { AuthAudience } from "../../../shared/auth-contract.js";

const USER_SELECT = `SELECT u.*, m.name AS municipality_name, m.state AS municipality_state,
  m.active AS municipality_active, p.cpf, p.email AS profile_email, p.phone AS profile_phone,
  p.email_verified_at, p.phone_verified_at, p.version AS profile_version
  FROM users u LEFT JOIN municipalities m ON m.id = u.municipality_id
  LEFT JOIN tutor_profiles p ON p.user_id = u.id AND p.municipality_id = u.municipality_id`;

export async function findAuthUser(id, database = pool, lock = false, municipalityId) {
  const scope = municipalityId ? " AND u.municipality_id = $2" : "";
  const { rows } = await database.query(`${USER_SELECT} WHERE u.id = $1${scope}${lock ? " FOR UPDATE OF u" : ""}`, municipalityId ? [id, municipalityId] : [id]);
  return rows[0] || null;
}

export async function findLoginCandidates({ audience, identifier, municipalityId }, database = pool) {
  const tutor = audience === AuthAudience.TUTOR;
  const query = tutor
    ? { sql: `${USER_SELECT} WHERE u.role = 'tutor' AND u.municipality_id = $1 AND (p.cpf = $2 OR lower(p.email) = $3)`,
      values: [municipalityId, /^\d{11}$/.test(identifier) ? identifier : "", identifier.toLowerCase()] }
    : { sql: `${USER_SELECT} WHERE u.role <> 'tutor' AND lower(u.email) = $1`, values: [identifier.toLowerCase()] };
  const { rows } = await database.query(query.sql, query.values);
  return rows;
}

export async function savePassword(database, userId, hash, mustChange = false) {
  const { rows } = await database.query(
    `UPDATE users SET password = $1, must_change_password = $2, session_version = session_version + 1,
     reset_code = NULL, reset_code_expires_at = NULL, updated_at = NOW() WHERE id = $3 RETURNING *`,
    [hash, mustChange, userId],
  );
  await database.query("UPDATE auth_challenges SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL", [userId]);
  return rows[0];
}

export async function strictAuthAudit(database, { actorId, userId, municipalityId, action, changes = {} }) {
  await database.query(
    `INSERT INTO audit_logs (user_id, municipality_id, action, entity_type, entity_id, changes)
     VALUES ($1, $2, $3, 'user', $4, $5::jsonb)`,
    [actorId || userId, municipalityId || null, action, userId, JSON.stringify(changes)],
  );
}

export async function withAuthTransaction(action, database = pool) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
