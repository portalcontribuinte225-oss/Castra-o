import { pool } from "../db/index.js";

// The identity a municipality puts on its e-mails. The brasão itself (a large data URL) is not loaded here, only whether it exists.
export async function loadMunicipalityIdentity(municipalityId, database = pool) {
  const { rows } = await database.query(
    `SELECT id, name, department_name, contact, email, address, updated_at, (COALESCE(brasao, '') <> '') AS has_brasao
       FROM municipalities WHERE id = $1`,
    [municipalityId],
  );
  return rows[0] || null;
}

export async function loadMunicipalityBrasao(municipalityId, database = pool) {
  const { rows } = await database.query("SELECT brasao, updated_at FROM municipalities WHERE id = $1 AND active = TRUE", [municipalityId]);
  return rows[0] || null;
}
