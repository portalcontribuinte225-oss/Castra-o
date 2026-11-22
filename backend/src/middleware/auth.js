import { GLOBAL_ROLES, normalizeRole, isInternalUser, isMasterUser } from "../tenant.js";
import { verifySession, publicAuthUser } from "../services/auth/auth-session.js";
import { userHasConfigItem } from "../services/config-permission.js";

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
 * Middleware que restringe acesso ao master (o suporte, mesmo global, não passa).
 * Use em configurações da plataforma que valem para todos os municípios.
 */
export function requireMaster(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Autenticação necessária." });
  if (!isMasterUser(req.user)) {
    return res.status(403).json({ error: "Acesso restrito ao proprietário da plataforma." });
  }
  next();
}

/**
 * Middleware factory que exige um item de configuração no grupo de permissões do usuário
 * (sem grupo ativo, vale o papel de gestor; a administração global sempre passa).
 */
export function requireConfigItem(item) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Autenticação necessária." });
    try {
      if (!(await userHasConfigItem(req.user, item))) return res.status(403).json({ error: "Sem permissão para esta configuração." });
    } catch {
      return res.status(503).json({ error: "Não foi possível verificar a permissão." });
    }
    next();
  };
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
