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

// The active municipality (id and name) an operation is about, so callers can scope it and put its name in a message.
export async function assertActiveMunicipality(municipalityId, database = pool) {
  if (typeof municipalityId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(municipalityId)) {
    throw Object.assign(new Error("Selecione um município ativo."), { status: 400 });
  }
  const { rows } = await database.query("SELECT id, name FROM municipalities WHERE id=$1 AND active=TRUE", [municipalityId]);
  if (!rows[0]) throw Object.assign(new Error("Selecione um município ativo."), { status: 400 });
  return rows[0];
}

export async function loadMunicipalityBrasao(municipalityId, database = pool) {
  const { rows } = await database.query("SELECT brasao, updated_at FROM municipalities WHERE id = $1 AND active = TRUE", [municipalityId]);
  return rows[0] || null;
}
