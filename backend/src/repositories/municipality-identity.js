import { pool } from "../db/index.js";

// The identity a municipality puts on its e-mails. Its images (large data URLs) are not loaded here, only whether each one exists.
export async function loadMunicipalityIdentity(municipalityId, database = pool) {
  const { rows } = await database.query(
    `SELECT id, name, department_name, contact, email, address, updated_at, (COALESCE(brasao, '') <> '') AS has_brasao,
            (COALESCE(department_logo, '') <> '') AS has_department_logo
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

// One query per image column a public link may read: the column is picked from this list, never written from the request.
const IMAGE_QUERIES = Object.freeze({
  brasao: "SELECT brasao AS image FROM municipalities WHERE id = $1 AND active = TRUE",
  department_logo: "SELECT department_logo AS image FROM municipalities WHERE id = $1 AND active = TRUE",
});

// The stored image (a data URL) of an active municipality, or null.
export async function loadMunicipalityImage(municipalityId, column, database = pool) {
  if (!Object.hasOwn(IMAGE_QUERIES, column)) throw new Error("Unknown municipality image.");
  const { rows } = await database.query(IMAGE_QUERIES[column], [municipalityId]);
  return rows[0]?.image ?? null;
}
