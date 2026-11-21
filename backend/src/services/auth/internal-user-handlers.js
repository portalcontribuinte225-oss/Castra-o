import bcrypt from "bcryptjs";
import { AuthErrorCode } from "../../../../shared/auth-contract.js";
import { AUDIT_ACTIONS } from "../audit.js";
import { GLOBAL_ROLES, MUNICIPALITY_ADMIN_ROLE, ROLE_LEVELS, isGlobalUser, isMunicipalAdmin,
  canAssignRole, canManageUser, normalizeRole } from "../../tenant.js";
import { findAuthUser, strictAuthAudit, withAuthTransaction } from "../../repositories/auth-users.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { authError, requireNewPassword } from "./auth-security.js";
import { issueSession, publicAuthUser } from "./auth-session.js";
import { readTeamDetails, saveTeamUser } from "./internal-user-team.js";

function writableRole(value) {
  const role = normalizeRole(value);
  return ({ admin: MUNICIPALITY_ADMIN_ROLE, administrador: MUNICIPALITY_ADMIN_ROLE,
    administrador_municipal: MUNICIPALITY_ADMIN_ROLE, "admin municipal": MUNICIPALITY_ADMIN_ROLE,
    "super admin": "master", super_admin: "master", "servidor publico": "servidor_publico" })[role] || role || "analista";
}

export async function upsertInternalUser(req, res) {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = req.body?.password ?? req.body?.senha ?? "";
  const role = writableRole(req.body?.role);
  const globalManager = isGlobalUser(req.user);
  if (!globalManager && !isMunicipalAdmin(req.user)) throw authError(403, "Operação restrita à administração.");
  if (!Object.hasOwn(ROLE_LEVELS, role) || role === "tutor" || !canAssignRole(req.user, role)) throw authError(403, "Perfil não permitido para esta operação.");
  const global = GLOBAL_ROLES.has(role);
  const municipalityId = global ? null : globalManager
    ? req.body?.municipalityId || req.body?.municipality_id : req.user.municipalityId;
  if (name.length < 2 || name.length > 160 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw authError(400, "Informe nome e e-mail válidos.");
  if (!global && !municipalityId) throw authError(400, "Selecione um município.");
  if (typeof password !== "string") throw authError(400, "Senha inválida.");
  if (password) requireNewPassword(password);
  const editing = Object.hasOwn(req.body ?? {}, "id");
  const userId = req.body?.id;
  if (editing && !isUuid(userId)) throw authError(404, "Usuário não encontrado para edição.");
  const team = readTeamDetails(req.body?.team);
  const saved = await withAuthTransaction(async (client) => {
    const existing = editing ? await findAuthUser(userId.toLowerCase(), client, true, globalManager ? undefined : municipalityId) : null;
    if (editing && !existing) throw authError(404, "Usuário não encontrado para edição.");
    if (existing && (existing.role === "tutor" || !canManageUser(req.user, existing)
      || (existing.municipality_id || null) !== (municipalityId || null))) throw authError(403, "Esta identidade não pode ser sobrescrita por este cadastro.");
    if (existing?.is_default_admin && isMunicipalAdmin(req.user) && role !== MUNICIPALITY_ADMIN_ROLE) throw authError(403, "O administrador padrão não pode ser rebaixado.");
    const ownUser = existing?.id === req.user.id;
    if (ownUser && (existing.session_version !== req.authUser.session_version || existing.password !== req.authUser.password)) {
      throw authError(401, "Sessão expirada.", AuthErrorCode.SESSION_INVALID);
    }
    const { rows: emailOwners } = await client.query("SELECT * FROM users WHERE lower(email) = $1", [email]);
    if (emailOwners.length > 1) throw authError(409, "E-mail ambíguo; revise o cadastro de usuários.");
    if (emailOwners.some((owner) => owner.id !== existing?.id)) throw authError(409, "Este e-mail já pertence a outro cadastro.");
    if (!existing && !password) throw authError(400, "Informe a senha inicial.");
    const hash = password ? await bcrypt.hash(password, 10) : existing.password;
    const active = typeof req.body?.active === "boolean" ? req.body.active : existing?.active !== false;
    const rotateSession = Boolean(existing && (existing.email !== email || existing.password !== hash || existing.role !== role || existing.active !== active));
    let result;
    if (existing) {
      result = await client.query(`UPDATE users SET name=$1, email=$2, password=$3, role=$4, active=$5,
        session_version=session_version+$7, updated_at=NOW() WHERE id=$6 RETURNING id,name,email,role,municipality_id,active`,
      [name, email, hash, role, active, existing.id, Number(rotateSession)]);
      if (rotateSession) await client.query("UPDATE auth_challenges SET consumed_at=NOW() WHERE user_id=$1 AND consumed_at IS NULL", [existing.id]);
    } else {
      result = await client.query(`INSERT INTO users (name,email,password,role,municipality_id,created_by,active)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,role,municipality_id,active`, [name, email, hash, role, municipalityId, req.user.id, active]);
    }
    const user = result.rows[0];
    const teamUser = await saveTeamUser(client, user, team);
    await strictAuthAudit(client, { actorId: req.user.id, userId: user.id, municipalityId,
      action: existing ? AUDIT_ACTIONS.USER_UPDATE : AUDIT_ACTIONS.USER_CREATE, changes: { role, active } });
    const response = { ...user, ...(teamUser ? { teamUser } : {}) };
    if (!ownUser) return response;
    if (!active) return { ...response, session: { user: null } };
    const current = { ...existing, ...user, password: hash, session_version: existing.session_version + Number(rotateSession) };
    return { ...response, session: rotateSession ? issueSession(current) : { user: publicAuthUser(current) } };
  });
  res.set("Cache-Control", "no-store").json(saved);
}
