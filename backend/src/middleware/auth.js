import { GLOBAL_ROLES, MUNICIPALITY_ADMIN_ROLE, normalizeRole, isGlobalUser, isInternalUser } from "../tenant.js";
import { verifySession, publicAuthUser } from "../services/auth/auth-session.js";

/** Middleware de autenticação obrigatória via JWT Bearer */
async function authenticate(req, res, next, allowRestricted) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token não fornecido" });
  try {
    req.authUser = await verifySession(token, { allowRestricted });
    req.user = publicAuthUser(req.authUser);
    req.user.municipality_id = req.user.municipalityId;
    res.set("Cache-Control", "no-store");
    next();
  } catch (error) {
    res.status(error.status || 503).json({ error: error.status ? error.message : "Autenticação indisponível.", ...(error.status && error.code ? { code: error.code } : {}) });
  }
}

export function auth(req, res, next) { return authenticate(req, res, next, false); }
export function restrictedAuth(req, res, next) { return authenticate(req, res, next, true); }

export function requireInternalUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Autenticação necessária." });
  if (!isInternalUser(req.user)) return res.status(403).json({ error: "Operação restrita à equipe de atendimento." });
  next();
}

/** Middleware de autenticação opcional — popula req.user se token presente */
export async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) return auth(req, res, next);
  next();
}

/**
 * Middleware que restringe acesso a roles globais (master / suporte).
 * Use em rotas de administração da plataforma SaaS.
 */
export function requireGlobal(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Autenticação necessária." });
  if (!isGlobalUser(req.user)) {
    return res.status(403).json({ error: "Acesso restrito à administração global da plataforma." });
  }
  next();
}

/**
 * Middleware que restringe acesso a administradores municipais (ou globais).
 * Use em rotas de configuração municipal que não devem ser acessadas por analistas.
 */
export function requireMunicipalAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Autenticação necessária." });
  const role = normalizeRole(req.user.role);
  if (role !== MUNICIPALITY_ADMIN_ROLE && !GLOBAL_ROLES.has(role)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador municipal." });
  }
  next();
}

/**
 * Middleware factory que permite apenas os roles listados.
 * Roles globais (master/suporte) sempre passam.
 *
 * @param {...string} allowedRoles  Roles que têm acesso
 *
 * @example
 * router.delete("/:id", auth, requireRole("admin_municipal"), handler);
 */
export function requireRole(...allowedRoles) {
  const allowed = new Set([...allowedRoles.map(normalizeRole), ...GLOBAL_ROLES]);
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Autenticação necessária." });
    if (!allowed.has(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: "Permissão insuficiente para esta operação." });
    }
    next();
  };
}
