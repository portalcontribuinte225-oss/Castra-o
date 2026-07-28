/**
 * Hierarquia de roles do sistema (do mais ao menos privilegiado):
 *
 * NÍVEL GLOBAL (plataforma SaaS):
 *   master      — Desenvolvedor/proprietário da plataforma; acesso irrestrito
 *   suporte     — Suporte técnico global; pode acessar municípios com registro de auditoria
 *
 * NÍVEL MUNICIPAL (admin local):
 *   admin_municipal — Administrador do município; gerencia usuários, setores, fluxos e config local
 *
 * NÍVEL OPERACIONAL (usuários internos do município):
 *   analista        — Analista/servidor; processa solicitações e visualiza dados
 *   servidor_publico— Servidor público com perfil operacional similar ao analista
 *
 * NÍVEL CREDENCIADO (parceiros externos aprovados):
 *   ong         — ONG credenciada pelo município
 *   protetor    — Protetor independente credenciado pelo município
 *
 * NÍVEL PÚBLICO:
 *   tutor       — Cidadão que submete solicitação pelo formulário público
 */

// Conjunto de roles com acesso global (sem vínculo de município)
export const GLOBAL_ROLES = new Set(["master", "suporte"]);

// Role padrão criado automaticamente ao criar um município
export const MUNICIPALITY_ADMIN_ROLE = "admin_municipal";

// Roles que admin_municipal pode criar e atribuir a outros usuários
// (nunca pode promover para roles globais)
export const ADMIN_MUNICIPAL_WRITABLE_ROLES = new Set([
  "admin_municipal",
  "analista",
  "servidor_publico",
  "ong",
  "protetor",
]);

// Nível hierárquico numérico — usado para comparações de autoridade
export const ROLE_LEVELS = Object.freeze({
  master: 100,
  suporte: 90,
  admin_municipal: 50,
  servidor_publico: 30,
  analista: 25,
  ong: 15,
  protetor: 15,
  tutor: 5,
});

// ── Funções utilitárias ───────────────────────────────────────────────────

export function normalizeRole(role = "") {
  return String(role || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Retorna true para usuários com acesso global (master / suporte) */
export function isGlobalUser(user = {}) {
  return GLOBAL_ROLES.has(normalizeRole(user.role));
}

/** Retorna true se o usuário é administrador municipal */
export function isMunicipalAdmin(user = {}) {
  return normalizeRole(user.role) === MUNICIPALITY_ADMIN_ROLE;
}

// Roles de uso interno da prefeitura (equipe de atendimento, não credenciados externos)
const INTERNAL_ROLES = new Set(["admin_municipal", "analista", "servidor_publico"]);

/** Retorna true se o usuário é da equipe interna da prefeitura (não tutor/ong/protetor) */
export function isInternalUser(user = {}) {
  return isGlobalUser(user) || INTERNAL_ROLES.has(normalizeRole(user.role));
}

/** Retorna o nível numérico de um role (0 se desconhecido) */
export function getRoleLevel(role = "") {
  return ROLE_LEVELS[normalizeRole(role)] ?? 0;
}

/**
 * Verifica se o `actor` pode atribuir `targetRole` a outro usuário.
 * Regras:
 *   - Global (master/suporte): pode atribuir qualquer role
 *   - admin_municipal: só pode atribuir roles não-globais e dentro de ADMIN_MUNICIPAL_WRITABLE_ROLES
 *   - Outros: não podem atribuir roles
 */
export function canAssignRole(actor = {}, targetRole = "") {
  const normalized = normalizeRole(targetRole);
  if (isGlobalUser(actor)) return true;
  if (isMunicipalAdmin(actor)) {
    return !GLOBAL_ROLES.has(normalized) && ADMIN_MUNICIPAL_WRITABLE_ROLES.has(normalized);
  }
  return false;
}

/**
 * Verifica se o `actor` tem autoridade sobre `targetUser`.
 * Admin municipal pode gerenciar apenas usuários do seu município com role inferior.
 */
export function canManageUser(actor = {}, targetUser = {}) {
  if (!actor?.role) return false;
  if (isGlobalUser(actor)) return true;
  if (!isMunicipalAdmin(actor)) return false;

  const targetRole = normalizeRole(targetUser.role);
  // Não pode gerenciar usuários globais ou fora do seu município
  if (GLOBAL_ROLES.has(targetRole)) return false;
  if (targetUser.municipality_id && targetUser.municipality_id !== actor.municipalityId) return false;

  return true;
}

// ── Resolução de municipalityId ───────────────────────────────────────────

/**
 * Resolve o município da operação:
 *   - Usuários globais podem especificar qualquer município via query/body
 *   - Usuários municipais ficam restritos ao seu próprio município
 *   - Requisições públicas (sem auth) pegam o municipalityId do body/query
 */
export function pickMunicipalityId(req) {
  if (!req.user) {
    return (
      req.query?.municipalityId ||
      req.body?.municipalityId ||
      req.body?.municipality_id ||
      null
    );
  }
  if (isGlobalUser(req.user)) {
    return (
      req.query?.municipalityId ||
      req.body?.municipalityId ||
      req.body?.municipality_id ||
      null
    );
  }
  return req.user?.municipalityId || req.user?.municipality_id || null;
}

/** Igual a pickMunicipalityId mas retorna 400 se não encontrar */
export function requireMunicipality(req, res) {
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId) {
    res.status(400).json({ error: "Municipio obrigatorio para esta operacao." });
    return null;
  }
  return municipalityId;
}
