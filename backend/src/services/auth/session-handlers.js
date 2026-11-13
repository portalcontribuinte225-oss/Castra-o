import bcrypt from "bcryptjs";
import { AUDIT_ACTIONS } from "../audit.js";
import { AuthAudience } from "../../../../shared/auth-contract.js";
import { pool } from "../../db/index.js";
import { findLoginCandidates, findAuthUser, savePassword, strictAuthAudit, withAuthTransaction } from "../../repositories/auth-users.js";
import { allowAuthAttempt } from "../../repositories/auth-limits.js";
import { issueSession, publicAuthUser, isActiveAccount } from "./auth-session.js";
import { authError, requireNewPassword } from "./auth-security.js";

const DUMMY_HASH = bcrypt.hashSync("nonexistent-account-password", 10);

export function authRequestContext(req) {
  const audience = req.body?.audience ?? AuthAudience.STAFF;
  if (!Object.values(AuthAudience).includes(audience)) throw authError(400, "Tipo de acesso inválido.");
  const municipalityId = audience === AuthAudience.TUTOR ? req.body?.municipalityId : null;
  if (audience === AuthAudience.TUTOR && (typeof municipalityId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(municipalityId))) throw authError(400, "Selecione um município válido.");
  let identifier = String(req.body?.identifier ?? req.body?.email ?? "").trim().toLowerCase();
  if (audience === AuthAudience.STAFF && identifier === "master") {
    identifier = String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
  }
  if (!identifier || identifier.length > 254) throw authError(400, "Informe CPF ou e-mail.");
  if (audience === AuthAudience.TUTOR && /^[\d.\-\s]+$/.test(identifier)) identifier = identifier.replace(/\D/g, "");
  return { audience, identifier, municipalityId, ip: req.ip };
}

export async function login(req, res) {
  const context = authRequestContext(req);
  const password = req.body?.password;
  if (typeof password !== "string" || !password || Buffer.byteLength(password, "utf8") > 72) throw authError(401, "Credenciais inválidas.");
  if (!await allowAuthAttempt({ ...context, purpose: "login" })) throw authError(429, "Muitas tentativas. Aguarde alguns minutos.");
  const users = await findLoginCandidates(context);
  const user = users.length === 1 ? users[0] : null;
  const valid = await bcrypt.compare(password, user?.password || DUMMY_HASH);
  if (!valid || !isActiveAccount(user)) throw authError(401, "Credenciais inválidas.",
    context.audience === AuthAudience.TUTOR && context.identifier.includes("@") ? "USE_CPF" : undefined);
  await strictAuthAudit(pool, {
    actorId: user.id, userId: user.id, municipalityId: user.municipality_id, action: AUDIT_ACTIONS.LOGIN,
  });
  await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
  res.set("Cache-Control", "no-store").json(issueSession(user));
}

export async function changePassword(req, res) {
  const password = requireNewPassword(req.body?.password);
  const currentPassword = req.body?.currentPassword;
  if (typeof currentPassword !== "string" || Buffer.byteLength(currentPassword, "utf8") > 72) throw authError(400, "Informe a senha atual.");
  const allowed = await allowAuthAttempt({ purpose: "change-password", audience: req.user.role, identifier: req.user.id, municipalityId: req.user.municipalityId, ip: req.ip });
  if (!allowed) throw authError(429, "Muitas tentativas. Aguarde alguns minutos.");
  const updated = await withAuthTransaction(async (client) => {
    const user = await findAuthUser(req.user.id, client, true);
    if (!isActiveAccount(user) || user.role !== req.authUser.role || user.municipality_id !== req.authUser.municipality_id
      || user.session_version !== req.authUser.session_version || user.password !== req.authUser.password) throw authError(401, "Sessão expirada.");
    if (!await bcrypt.compare(currentPassword, user.password)) throw authError(400, "Senha atual inválida.");
    if (await bcrypt.compare(password, user.password)) throw authError(400, "Escolha uma senha diferente da atual.");
    await savePassword(client, user.id, await bcrypt.hash(password, 10));
    await strictAuthAudit(client, { actorId: user.id, userId: user.id, municipalityId: user.municipality_id, action: AUDIT_ACTIONS.PASSWORD_CHANGE });
    return findAuthUser(user.id, client);
  });
  res.set("Cache-Control", "no-store").json(issueSession(updated));
}

export function me(req, res) { res.set("Cache-Control", "no-store").json({ user: publicAuthUser(req.authUser) }); }
