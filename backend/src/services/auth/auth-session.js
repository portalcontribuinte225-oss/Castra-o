import jwt from "jsonwebtoken";
import { AuthAudience, SessionScope } from "../../../../shared/auth-contract.js";
import { findAuthUser } from "../../repositories/auth-users.js";
import { GLOBAL_ROLES } from "../../tenant.js";
import { authenticatedDigest, authError } from "./auth-security.js";

export function isActiveAccount(user) {
  return Boolean(user && user.active !== false && (user.municipality_id ? user.municipality_active === true : GLOBAL_ROLES.has(user.role))
    && (user.role !== AuthAudience.TUTOR || user.cpf));
}

export function publicAuthUser(user) {
  const tutor = user.role === AuthAudience.TUTOR;
  return {
    id: user.id, name: user.name, role: user.role,
    email: tutor ? user.profile_email || "" : user.email || "", phone: user.profile_phone || "", cpf: user.cpf || "",
    municipalityId: user.municipality_id || null, municipalityName: user.municipality_name || "", municipalityState: user.municipality_state || "",
    mustChangePassword: Boolean(user.must_change_password), profileComplete: tutor && Boolean(user.cpf && user.name),
  };
}

export function issueSession(user) {
  const scope = user.must_change_password ? SessionScope.PASSWORD_CHANGE : SessionScope.FULL;
  const token = jwt.sign({
    id: user.id, role: user.role, municipalityId: user.municipality_id || null,
    audience: user.role === AuthAudience.TUTOR ? AuthAudience.TUTOR : AuthAudience.STAFF,
    version: user.session_version, credential: authenticatedDigest("session-credential", user.id, user.password), scope,
  }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: scope === SessionScope.PASSWORD_CHANGE ? "10m" : "8h" });
  return { token, user: publicAuthUser(user) };
}

export async function verifySession(token, { allowRestricted = false, loadUser = findAuthUser } = {}) {
  let claims;
  try { claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }); }
  catch { throw authError(401, "Sessão inválida ou expirada."); }
  const user = await loadUser(claims.id);
  const municipalityId = user?.municipality_id || null;
  if (!isActiveAccount(user)
    || claims.version !== user.session_version || claims.role !== user.role || claims.municipalityId !== municipalityId
    || claims.credential !== authenticatedDigest("session-credential", user.id, user.password)) {
    throw authError(401, "Sessão inválida ou expirada.");
  }
  const expected = user.must_change_password ? SessionScope.PASSWORD_CHANGE : SessionScope.FULL;
  if (claims.scope !== expected) throw authError(401, "Sessão inválida ou expirada.");
  if (!allowRestricted && expected !== SessionScope.FULL) throw authError(403, "Troque a senha inicial antes de continuar.", "PASSWORD_CHANGE_REQUIRED");
  return user;
}
