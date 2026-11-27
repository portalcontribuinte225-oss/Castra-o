import { pool } from "../db/index.js";
import { isProcedureRequest } from "../../../shared/request-contract.js";

// What the access compares (the tutor's CPF and contacts), what the request document shows and the documents, only to count them.
// Never the history, the notes or the photos. Only a request of an active municipality; the tenant scope stays explicit.
const ACCESS_COLUMNS = `r.id, r.municipality_id, r.tutor_id, r.protocol, r.request_type, r.status, r.origin, r.created_at, r.updated_at, r.signed_at,
  r.schedule_date, r.schedule_location_name, r.schedule_address, r.schedule_address_url, r.schedule_municipality, r.municipality,
  r.responsible_unit, r.veterinarian, r.tutor_name, r.cpf, r.phone, r.tutor_email, r.cep, r.address, r.neighborhood, r.city, r.state,
  r.animals, r.workflow_data, r.documents`;
const REQUEST_BATCH_SIZE = 20;

// Only a request for a procedure has a tutor whose account can be born from it: a complaint, a death or a transfer never opens here.
const accessible = (row) => (row && isProcedureRequest(row.request_type) ? row : null);

// The procedure requests of a CPF in an active municipality, the most recent first. The CPF is compared by its digits, however the
// request kept it.
export async function* accessRequestsByCpf(municipalityId, cpf, database = pool) {
  let offset = 0;
  for (;;) {
    const { rows } = await database.query(
      `SELECT ${ACCESS_COLUMNS} FROM requests r JOIN municipalities m ON m.id = r.municipality_id
       WHERE r.municipality_id = $1 AND regexp_replace(COALESCE(r.cpf, ''), '\\D', '', 'g') = $2 AND m.active = TRUE
       ORDER BY r.created_at DESC, r.id DESC LIMIT $3 OFFSET $4`,
      [municipalityId, cpf, REQUEST_BATCH_SIZE, offset],
    );
    yield* rows.filter(accessible);
    if (rows.length < REQUEST_BATCH_SIZE) return;
    offset += rows.length;
  }
}

export async function findAccessRequest(requestId, municipalityId, database = pool, lock = false) {
  const { rows } = await database.query(
    `SELECT ${ACCESS_COLUMNS} FROM requests r JOIN municipalities m ON m.id = r.municipality_id
     WHERE r.id = $1 AND r.municipality_id = $2 AND m.active = TRUE${lock ? " FOR UPDATE OF r" : ""}`,
    [requestId, municipalityId],
  );
  return accessible(rows[0]);
}

// A CPF has one tutor account in a municipality.
export async function tutorAccountExists(municipalityId, cpf, database = pool) {
  const { rows } = await database.query(
    `SELECT 1 FROM tutor_profiles p JOIN users u ON u.id = p.user_id WHERE p.municipality_id = $1 AND p.cpf = $2 AND u.role = 'tutor'`,
    [municipalityId, cpf],
  );
  return rows.length > 0;
}

// The account is born from the request: its name, CPF, contacts and address. Only the contact that received the code is confirmed.
export async function insertTutorAccount(client, { request, name, cpf, email, phone, verified, passwordHash }) {
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password, role, municipality_id, must_change_password)
     VALUES ($1, NULL, $2, 'tutor', $3, FALSE) RETURNING id`,
    [name, passwordHash, request.municipality_id],
  );
  const userId = rows[0].id;
  await client.query(
    `INSERT INTO tutor_profiles (user_id, municipality_id, cpf, email, phone, email_verified_at, phone_verified_at, address, neighborhood, city, state, cep)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::boolean THEN NOW() END, CASE WHEN $7::boolean THEN NOW() END, $8, $9, $10, $11, $12)`,
    [userId, request.municipality_id, cpf, email || null, phone || null, verified.email === true, verified.phone === true,
      request.address || null, request.neighborhood || null, request.city || null, request.state || null, request.cep || null],
  );
  return userId;
}

// A request the page showed, if it has no tutor yet, goes to the new account with its animals that have no tutor; requests of the
// same CPF with another contact stay as they are. The tutor of each animal is recorded the way a request of a logged tutor records it.
export async function linkAccessRequest(client, { request, userId }) {
  await client.query("UPDATE requests SET tutor_id = $1, updated_at = NOW() WHERE id = $2 AND municipality_id = $3 AND tutor_id IS NULL",
    [userId, request.id, request.municipality_id]);
  const { rowCount } = await client.query(
    `INSERT INTO animal_tutors (animal_id, user_id, tutor_name, tutor_email, cpf, phone, address, neighborhood, city, state, cep)
     SELECT linked.animal_id, $1::uuid, q.tutor_name, q.tutor_email, q.cpf, q.phone, q.address, q.neighborhood, q.city, q.state, q.cep
     FROM (SELECT DISTINCT animal_id FROM animal_records WHERE request_id = $2 AND municipality_id = $3) linked
     JOIN requests q ON q.id = $2 AND q.municipality_id = $3
     WHERE NOT EXISTS (SELECT 1 FROM animal_tutors t WHERE t.animal_id = linked.animal_id AND t.active = TRUE)`,
    [userId, request.id, request.municipality_id],
  );
  return rowCount;
}
