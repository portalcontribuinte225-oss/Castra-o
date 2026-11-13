import bcrypt from "bcryptjs";
import { AUDIT_ACTIONS } from "../audit.js";
import { pool } from "../../db/index.js";
import { isInternalUser, pickMunicipalityId } from "../../tenant.js";
import { normalizeCpf, isValidCpf } from "../../utils.js";
import { findAuthUser, savePassword, strictAuthAudit, withAuthTransaction } from "../../repositories/auth-users.js";
import { consumeAuthLimit } from "../../repositories/auth-limits.js";
import { authError, temporaryPassword, maskEmail, maskPhone } from "./auth-security.js";

function recoveryMunicipality(req) {
  if (!isInternalUser(req.user)) throw authError(403, "Operação restrita à equipe de atendimento.");
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId) throw authError(400, "Selecione um município.");
  return municipalityId;
}

export async function searchTutors(req, res) {
  const municipalityId = recoveryMunicipality(req);
  const cpf = normalizeCpf(req.query?.cpf);
  if (!isValidCpf(cpf)) throw authError(400, "Informe um CPF válido para localizar o tutor.");
  if (!await consumeAuthLimit(["assisted-search", req.user.id], { limit: 30, seconds: 600 })) throw authError(429, "Aguarde alguns minutos.");
  const { rows } = await pool.query(`SELECT u.id, u.name, p.cpf, p.email, p.phone FROM tutor_profiles p
    JOIN users u ON u.id = p.user_id AND u.municipality_id = p.municipality_id
    WHERE p.municipality_id = $1 AND p.cpf = $2 AND u.role = 'tutor' AND u.active = TRUE`, [municipalityId, cpf]);
  res.json({ tutors: rows.map((user) => ({ id: user.id, name: user.name, cpf: user.cpf,
    email: maskEmail(user.email), phone: maskPhone(user.phone), maskedEmail: maskEmail(user.email), maskedPhone: maskPhone(user.phone) })) });
}

export async function assistedRecovery(req, res) {
  const municipalityId = recoveryMunicipality(req);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (req.body?.identityConfirmed !== true || reason.length < 10 || reason.length > 500) throw authError(400, "Confirme a identidade e informe um motivo de 10 a 500 caracteres.");
  if (!await consumeAuthLimit(["assisted-recovery", req.user.id], { limit: 10, seconds: 600 })) throw authError(429, "Aguarde alguns minutos.");
  const password = temporaryPassword();
  await withAuthTransaction(async (client) => {
    const user = await findAuthUser(req.params.id, client, true, municipalityId);
    if (!user || user.role !== "tutor" || user.municipality_id !== municipalityId || !user.cpf || user.active === false || user.municipality_active !== true) throw authError(404, "Tutor não encontrado neste município.");
    await savePassword(client, user.id, await bcrypt.hash(password, 10), true);
    await strictAuthAudit(client, { actorId: req.user.id, userId: user.id, municipalityId,
      action: AUDIT_ACTIONS.TUTOR_ASSISTED_RECOVERY, changes: { method: "in_person", identityConfirmed: true, reason } });
  });
  res.set("Cache-Control", "no-store").json({ temporaryPassword: password, mustChangePassword: true });
}
