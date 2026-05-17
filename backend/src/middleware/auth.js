import jwt from "jsonwebtoken";
import { GLOBAL_ROLES, MUNICIPALITY_ADMIN_ROLE, normalizeRole, isGlobalUser } from "../tenant.js";

/** Middleware de autenticação obrigatória via JWT Bearer */
export function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token não fornecido" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

/** Middleware de autenticação opcional — popula req.user se token presente */
export function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // token inválido em contexto opcional — ignora silenciosamente
    }
  }
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
