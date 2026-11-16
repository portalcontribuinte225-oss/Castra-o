import bcrypt from "bcryptjs";
import { AUDIT_ACTIONS } from "../audit.js";
import { pool } from "../../db/index.js";
import { isInternalUser, pickMunicipalityId } from "../../tenant.js";
import { findAuthUser, savePassword, strictAuthAudit, withAuthTransaction } from "../../repositories/auth-users.js";
import { consumeAuthLimit } from "../../repositories/auth-limits.js";
import { authError, requireNewPassword } from "./auth-security.js";
import { normalizeAuthEmail, normalizeAuthPhone } from "./auth-contacts.js";
import { MOBILE_PHONE_MESSAGE, isMobilePhone } from "../../../../shared/phone-contract.js";

// What the staff edits of a tutor, with the limits the form shows; the CPF is the identity of the account and is never edited here.
const TEXT_LIMITS = { address: 200, neighborhood: 120, city: 120 };
const ADDRESS_FIELDS = ["address", "neighborhood", "city", "state", "cep"];

function staffMunicipality(req) {
  if (!isInternalUser(req.user)) throw authError(403, "Operação restrita à equipe de atendimento.");
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId) throw authError(400, "Selecione um município.");
  return municipalityId;
}

// The request and its tutor: the account linked to it or, for a request sent before the account existed, the one with the same CPF.
// A request registered by the staff has no account, so the tutor comes back null and the data is the one of the request.
async function findRequestTutor(client, { requestId, municipalityId, lock = false }) {
  const { rows: requests } = await client.query(`SELECT id, tutor_id, cpf, tutor_name, tutor_email, phone, address, neighborhood, city, state, cep
    FROM requests WHERE id = $1 AND municipality_id = $2`, [requestId, municipalityId]);
  const request = requests[0];
  if (!request) throw authError(404, "Solicitação não encontrada.");
  const { rows } = await client.query(`SELECT u.id, u.name, u.active, p.cpf, p.email, p.phone, p.email_verified_at, p.phone_verified_at,
      p.address, p.neighborhood, p.city, p.state, p.cep
    FROM users u JOIN tutor_profiles p ON p.user_id = u.id AND p.municipality_id = u.municipality_id
    WHERE u.municipality_id = $1 AND u.role = 'tutor' AND (u.id = $2 OR p.cpf = $3)
    ORDER BY (u.id = $2) DESC LIMIT 1 ${lock ? "FOR UPDATE OF u, p" : ""}`, [municipalityId, request.tutor_id, request.cpf]);
  return { request, tutor: rows[0] || null };
}

// A profile without an address of its own shows the one of the tutor's latest request, which is where it was typed so far.
async function addressOf(client, tutor, municipalityId) {
  const own = Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, tutor[field]]));
  if (Object.values(own).some(Boolean)) return own;
  const { rows } = await client.query(`SELECT address, neighborhood, city, state, cep FROM requests
    WHERE municipality_id = $1 AND (tutor_id = $2 OR cpf = $3) ORDER BY created_at DESC LIMIT 1`, [municipalityId, tutor.id, tutor.cpf]);
  return Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, rows[0]?.[field]]));
}

const addressView = (source) => Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, source[field] || ""]));

async function publicTutor(client, tutor, municipalityId) {
  return {
    id: tutor.id, hasAccess: true, name: tutor.name || "", cpf: tutor.cpf, email: tutor.email || "", phone: tutor.phone || "",
    emailVerified: Boolean(tutor.email_verified_at), phoneVerified: Boolean(tutor.phone_verified_at),
    ...addressView(await addressOf(client, tutor, municipalityId)),
  };
}

// The data of a tutor who has no account yet is the one registered with the request.
function requestTutor(request) {
  return { id: null, hasAccess: false, name: request.tutor_name || "", cpf: request.cpf || "", email: request.tutor_email || "", phone: request.phone || "",
    emailVerified: false, phoneVerified: false, ...addressView(request) };
}

export async function getRequestTutor(req, res) {
  const municipalityId = staffMunicipality(req);
  const { request, tutor } = await findRequestTutor(pool, { requestId: req.params.requestId, municipalityId });
  res.set("Cache-Control", "no-store");
  if (tutor) return res.json({ tutor: await publicTutor(pool, tutor, municipalityId) });
  res.json({ tutor: request.cpf ? requestTutor(request) : null });
}

function cleanText(value, limit, label) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > limit) throw authError(400, `${label} deve ter no máximo ${limit} caracteres.`);
  return text;
}

// Validates what the staff typed; the password is optional and only changes when it comes filled.
function readTutorInput(body = {}) {
  const name = cleanText(body.name, 160, "Nome");
  if (name.length < 2) throw authError(400, "Informe o nome do tutor.");
  const emailText = typeof body.email === "string" ? body.email.trim() : "";
  const email = emailText ? normalizeAuthEmail(emailText) : "";
  if (emailText && !email) throw authError(400, "Informe um e-mail válido.");
  const phoneText = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!isMobilePhone(phoneText)) throw authError(400, MOBILE_PHONE_MESSAGE);
  const phone = normalizeAuthPhone(phoneText);
  const state = cleanText(body.state, 2, "UF").toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) throw authError(400, "Informe a UF com duas letras.");
  const cep = typeof body.cep === "string" ? body.cep.replace(/\D/g, "") : "";
  if (cep && cep.length !== 8) throw authError(400, "Informe um CEP com 8 dígitos.");
  const password = typeof body.password === "string" && body.password !== "" ? requireNewPassword(body.password) : "";
  return {
    name, email, phone, state, cep, password,
    address: cleanText(body.address, TEXT_LIMITS.address, "Endereço"),
    neighborhood: cleanText(body.neighborhood, TEXT_LIMITS.neighborhood, "Bairro"),
    city: cleanText(body.city, TEXT_LIMITS.city, "Cidade"),
  };
}

// The tutor's requests still in progress follow the new data (and the one being edited, whatever its status, when the tutor has no
// account to keep it); the finished ones stay as they were registered.
async function propagate(client, { tutorId, cpf, requestId, input, municipalityId }) {
  await client.query(`UPDATE requests SET tutor_name = $3, tutor_email = $4, phone = $5, address = $6, neighborhood = $7, city = $8,
      state = $9, cep = $10, updated_at = NOW()
    WHERE municipality_id = $1 AND ((status IN ('NOVA', 'AGENDADA') AND (tutor_id = $2 OR cpf = $11)) OR ($12::uuid IS NOT NULL AND id = $12))`,
  [municipalityId, tutorId, input.name, input.email || null, input.phone || null, input.address || null, input.neighborhood || null,
    input.city || null, input.state || null, input.cep || null, cpf, tutorId ? null : requestId]);
  for (const [column, value] of [["email", input.email], ["phone", input.phone]]) {
    if (!value) continue;
    await client.query(`UPDATE requests SET workflow_data = jsonb_set(workflow_data, '{followUp,${column}}', to_jsonb($3::text), true), updated_at = NOW()
      WHERE municipality_id = $1 AND (tutor_id = $2 OR cpf = $4) AND status IN ('NOVA', 'AGENDADA')
        AND workflow_data->'followUp'->>'enabled' = 'true'`, [municipalityId, tutorId, value, cpf]);
  }
  if (!tutorId) return;
  await client.query(`UPDATE animal_tutors SET tutor_name = $2, tutor_email = $3, phone = $4, address = $5, neighborhood = $6, city = $7,
      state = $8, cep = $9
    WHERE user_id = $1 AND active = TRUE`,
  [tutorId, input.name, input.email || null, input.phone || null, input.address || null, input.neighborhood || null,
    input.city || null, input.state || null, input.cep || null]);
}

const changedFields = (before, input) => Object.entries({ name: before.name || "", email: before.email || "", phone: before.phone || "", address: before.address || "",
  neighborhood: before.neighborhood || "", city: before.city || "", state: before.state || "", cep: before.cep || "" })
  .filter(([key, value]) => value !== input[key]).map(([key]) => key);

async function saveAccount(client, { req, tutor, input, municipalityId }) {
  const account = await findAuthUser(tutor.id, client, true, municipalityId);
  if (!account || account.role !== "tutor" || account.municipality_id !== municipalityId) throw authError(404, "Tutor não encontrado neste município.");
  const emailChanged = (tutor.email || "") !== input.email;
  const phoneChanged = (tutor.phone || "") !== input.phone;
  await client.query("UPDATE users SET name = $2, updated_at = NOW() WHERE id = $1", [tutor.id, input.name]);
  // A contact typed by the staff is valid at once: the tutor does not confirm it, so it counts as verified when it changes.
  await client.query(`UPDATE tutor_profiles SET email = $3, phone = $4, address = $5, neighborhood = $6, city = $7, state = $8, cep = $9,
      email_verified_at = CASE WHEN $10::boolean THEN NOW() ELSE email_verified_at END,
      phone_verified_at = CASE WHEN $11::boolean THEN NOW() ELSE phone_verified_at END,
      version = version + 1, updated_at = NOW()
    WHERE user_id = $1 AND municipality_id = $2`,
  [tutor.id, municipalityId, input.email || null, input.phone || null, input.address || null, input.neighborhood || null,
    input.city || null, input.state || null, input.cep || null, emailChanged && Boolean(input.email), phoneChanged && Boolean(input.phone)]);
  // The password the staff types is the one the tutor uses from now on: no temporary password, no forced change.
  if (input.password) await savePassword(client, tutor.id, await bcrypt.hash(input.password, 10), false);
  await propagate(client, { tutorId: tutor.id, cpf: tutor.cpf, requestId: req.params.requestId, input, municipalityId });
  await strictAuthAudit(client, { actorId: req.user.id, userId: tutor.id, municipalityId, action: AUDIT_ACTIONS.TUTOR_DATA_UPDATE,
    changes: { requestId: req.params.requestId, fields: changedFields(tutor, input), passwordChanged: Boolean(input.password) } });
  const { rows } = await client.query(`SELECT u.id, u.name, p.cpf, p.email, p.phone, p.email_verified_at, p.phone_verified_at,
      p.address, p.neighborhood, p.city, p.state, p.cep
    FROM users u JOIN tutor_profiles p ON p.user_id = u.id AND p.municipality_id = u.municipality_id WHERE u.id = $1`, [tutor.id]);
  return publicTutor(client, rows[0], municipalityId);
}

async function saveRequestData(client, { req, request, input, municipalityId }) {
  await propagate(client, { tutorId: null, cpf: request.cpf, requestId: request.id, input, municipalityId });
  await strictAuthAudit(client, { actorId: req.user.id, municipalityId, action: AUDIT_ACTIONS.TUTOR_DATA_UPDATE, entityType: "request", entityId: request.id,
    changes: { requestId: request.id, fields: changedFields({ name: request.tutor_name, email: request.tutor_email, ...request }, input), passwordChanged: false } });
  return requestTutor({ ...request, tutor_name: input.name, tutor_email: input.email, phone: input.phone, address: input.address,
    neighborhood: input.neighborhood, city: input.city, state: input.state, cep: input.cep });
}

export async function updateRequestTutor(req, res) {
  const municipalityId = staffMunicipality(req);
  const input = readTutorInput(req.body);
  if (!await consumeAuthLimit(["tutor-data", req.user.id], { limit: 60, seconds: 600 })) throw authError(429, "Aguarde alguns minutos.");
  const result = await withAuthTransaction(async (client) => {
    const { request, tutor } = await findRequestTutor(client, { requestId: req.params.requestId, municipalityId, lock: true });
    if (tutor && tutor.active === false) throw authError(404, "O acesso deste tutor está desativado.");
    if (!tutor && !request.cpf) throw authError(404, "Esta solicitação não tem um tutor identificado.");
    if (!tutor && input.password) throw authError(400, "Este tutor ainda não tem acesso ao sistema: não há senha para definir.");
    return tutor ? saveAccount(client, { req, tutor, input, municipalityId }) : saveRequestData(client, { req, request, input, municipalityId });
  });
  res.set("Cache-Control", "no-store").json({ tutor: result, passwordChanged: Boolean(input.password) });
}
