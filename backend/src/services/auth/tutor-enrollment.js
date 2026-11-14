import bcrypt from "bcryptjs";
import { isValidCpf, normalizeCpf } from "../../utils.js";
import { authError, temporaryPassword } from "./auth-security.js";
import { allowAuthAttempt } from "../../repositories/auth-limits.js";
import { normalizeAuthEmail, normalizeAuthPhone } from "./auth-contacts.js";

// Called only inside the request transaction. tutorRequired is computed by request-submission, never copied from payload.
export async function enrollTutorForRequest(client, { body, workflow, municipalityId, user, tutorRequired, ip }) {
  const cpf = normalizeCpf(body.cpf ?? body.tutor_cpf);
  if (user?.role === "tutor") {
    const { rows } = await client.query("SELECT cpf FROM tutor_profiles WHERE user_id = $1 AND municipality_id = $2", [user.id, municipalityId]);
    if (!rows[0] || rows[0].cpf !== cpf) throw authError(403, "O CPF deve corresponder ao seu perfil de tutor.");
    return { tutorId: user.id };
  }
  if (user || tutorRequired !== true || !isValidCpf(cpf)) return { tutorId: null };
  const name = String(body.tutor_name ?? body.tutorName ?? body.tutor ?? "").trim();
  if (name.length < 2 || name.length > 160) throw authError(400, "Informe o nome do tutor para criar o acesso.");
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`tutor-enrollment:${municipalityId}:${cpf}`]);
  const existing = await client.query("SELECT user_id FROM tutor_profiles WHERE municipality_id = $1 AND cpf = $2", [municipalityId, cpf]);
  if (existing.rows.length) return { tutorId: null };
  if (!await allowAuthAttempt({ purpose: "tutor-enrollment", audience: "tutor", identifier: cpf, municipalityId, ip },
    { database: client, limit: 10, seconds: 600 })) throw authError(429, "Muitas solicitações de acesso. Aguarde alguns minutos.");
  const password = temporaryPassword();
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password, role, municipality_id, must_change_password)
     VALUES ($1, NULL, $2, 'tutor', $3, TRUE) RETURNING id`, [name, hash, municipalityId],
  );
  const email = normalizeAuthEmail(body.tutor_email || body.tutorEmail || body.email) || normalizeAuthEmail(workflow.followUp?.email) || null;
  const phone = normalizeAuthPhone(body.phone) || normalizeAuthPhone(workflow.followUp?.phone) || null;
  await client.query("INSERT INTO tutor_profiles (user_id, municipality_id, cpf, email, phone) VALUES ($1, $2, $3, $4, $5)",
    [rows[0].id, municipalityId, cpf, email, phone]);
  return { tutorId: rows[0].id, enrollment: { temporaryPassword: password, cpf, municipalityId, name, email, phone } };
}
