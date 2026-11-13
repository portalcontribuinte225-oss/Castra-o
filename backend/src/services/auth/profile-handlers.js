import bcrypt from "bcryptjs";
import { AUDIT_ACTIONS } from "../audit.js";
import { AuthAudience, AuthPurpose, AUTH_CHALLENGE_SECONDS, AUTH_RETRY_SECONDS } from "../../../../shared/auth-contract.js";
import { getTutorProfile, publicTutorProfile, saveVerifiedContact } from "../../repositories/tutor-profiles.js";
import { findAuthUser, strictAuthAudit, withAuthTransaction } from "../../repositories/auth-users.js";
import { createChallenge, findChallenge, consumeChallenge, recordChallengeDelivery } from "../../repositories/auth-challenges.js";
import { consumeAuthLimit, allowAuthAttempt } from "../../repositories/auth-limits.js";
import { authError } from "./auth-security.js";
import { deliverAuthMessage } from "./auth-message-delivery.js";
import { isActiveAccount } from "./auth-session.js";

function requireTutor(req) {
  if (req.user.role !== AuthAudience.TUTOR) throw authError(403, "Acesso restrito ao tutor.");
}

export async function profile(req, res) {
  requireTutor(req);
  const current = await getTutorProfile(req.user.id, req.user.municipalityId);
  if (!current) throw authError(404, "Perfil indisponível.");
  res.json({ profile: publicTutorProfile(current) });
}

export async function requestContactChallenge(req, res) {
  requireTutor(req);
  const kind = req.body?.kind;
  if (kind !== "email" && kind !== "phone") throw authError(400, "Contato inválido.");
  if (typeof req.body?.value !== "string") throw authError(400, "Contato inválido.");
  const value = kind === "email" ? req.body.value.trim().toLowerCase() : req.body.value.replace(/\D/g, "");
  if (kind === "email" ? value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : !/^\d{10,11}$/.test(value)) throw authError(400, "Informe um contato válido.");
  const currentPassword = req.body?.currentPassword;
  if (typeof currentPassword !== "string" || Buffer.byteLength(currentPassword, "utf8") > 72) throw authError(400, "Informe a senha atual.");
  if (!await allowAuthAttempt({ purpose: "contact-password", audience: AuthAudience.TUTOR, identifier: req.user.id, municipalityId: req.user.municipalityId, ip: req.ip })) throw authError(429, "Aguarde alguns minutos.");
  const purpose = kind === "email" ? AuthPurpose.VERIFY_EMAIL : AuthPurpose.VERIFY_PHONE;
  if (!await consumeAuthLimit(["contact-send", req.user.id, purpose], { limit: 1, seconds: AUTH_RETRY_SECONDS })) throw authError(429, "Aguarde 60 segundos para solicitar outro código.");
  const pending = await withAuthTransaction(async (client) => {
    const user = await findAuthUser(req.user.id, client, true);
    if (!isActiveAccount(user) || user.role !== req.authUser.role || user.municipality_id !== req.authUser.municipality_id
      || user.password !== req.authUser.password || user.session_version !== req.authUser.session_version) throw authError(401, "Sessão expirada.");
    if (!await bcrypt.compare(currentPassword, user.password)) throw authError(400, "Senha atual inválida.");
    return { ...await createChallenge(client, { user, purpose, destination: value }), user };
  });
  let delivery;
  try {
    delivery = await deliverAuthMessage({ purpose, user: pending.user, municipalityId: req.user.municipalityId,
      email: kind === "email" ? value : "", phone: kind === "phone" ? value : "", code: pending.code, kind, strictDestination: true });
    await recordChallengeDelivery(pending.challenge.id, delivery);
  } catch { delivery = [{ status: "failed", reason: "Não foi possível enviar o código." }]; }
  res.set("Cache-Control", "no-store").json({ challengeId: pending.challenge.id, expiresIn: AUTH_CHALLENGE_SECONDS, retryAfter: AUTH_RETRY_SECONDS, delivery });
}

export async function confirmContactChallenge(req, res) {
  requireTutor(req);
  const candidate = await findChallenge(req.params.id);
  if (!candidate || candidate.user_id !== req.user.id) throw authError(400, "Código inválido ou expirado.");
  const allowed = await allowAuthAttempt({ purpose: "contact-confirm", audience: AuthAudience.TUTOR, identifier: req.user.id, municipalityId: req.user.municipalityId, ip: req.ip });
  if (!allowed) throw authError(429, "Muitas tentativas. Aguarde alguns minutos.");
  const result = await withAuthTransaction(async (client) => {
    const user = await findAuthUser(req.user.id, client, true);
    if (!isActiveAccount(user) || user.role !== req.authUser.role || user.municipality_id !== req.authUser.municipality_id
      || user.session_version !== req.authUser.session_version || user.password !== req.authUser.password) throw authError(401, "Sessão expirada.");
    const challenge = await findChallenge(candidate.id, client, true);
    const purpose = challenge?.purpose;
    if (purpose !== AuthPurpose.VERIFY_EMAIL && purpose !== AuthPurpose.VERIFY_PHONE) return null;
    const consumed = await consumeChallenge(client, { challenge, user, code: req.body?.code, purpose,
      audience: AuthAudience.TUTOR, municipalityId: req.user.municipalityId });
    if (!consumed) return null;
    const kind = purpose === AuthPurpose.VERIFY_EMAIL ? "email" : "phone";
    await saveVerifiedContact(client, { userId: user.id, municipalityId: user.municipality_id, kind, value: challenge.destination });
    await strictAuthAudit(client, { actorId: user.id, userId: user.id, municipalityId: user.municipality_id, action: AUDIT_ACTIONS.TUTOR_CONTACT_CHANGE, changes: { kind } });
    return { user, profile: await getTutorProfile(user.id, user.municipality_id, client) };
  });
  if (!result) throw authError(400, "Código inválido ou expirado.");
  try {
    await deliverAuthMessage({ purpose: AuthPurpose.CONTACT_CHANGED, user: result.user, municipalityId: result.user.municipality_id,
      email: result.user.profile_email, phone: result.user.profile_phone,
      emailVerified: Boolean(result.user.email_verified_at), phoneVerified: Boolean(result.user.phone_verified_at) });
  } catch { /* Contact was already committed; notification failure cannot undo verification. */ }
  res.json({ profile: publicTutorProfile(result.profile) });
}
