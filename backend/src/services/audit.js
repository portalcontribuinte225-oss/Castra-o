/**
 * Registro de auditoria para ações críticas do sistema.
 *
 * Ações registradas:
 *   USER_CREATE, USER_UPDATE, USER_DELETE
 *   MUNICIPALITY_CREATE, MUNICIPALITY_UPDATE
 *   CONFIG_UPDATE (para permission_groups e castragestao:teams)
 *   ACCESS_REQUEST_REVIEW
 *   SUPPORT_ACCESS (acesso de suporte global a município)
 */

/**
 * @param {import("pg").PoolClient} client
 * @param {{
 *   userId?: string|null,
 *   userEmail?: string|null,
 *   municipalityId?: string|null,
 *   action: string,
 *   entityType?: string|null,
 *   entityId?: string|null,
 *   changes?: object|null,
 *   ip?: string|null
 * }} entry
 */
export async function logAudit(client, entry = {}) {
  try {
    const {
      userId = null,
      userEmail = null,
      municipalityId = null,
      action,
      entityType = null,
      entityId = null,
      changes = null,
      ip = null,
    } = entry;
    await client.query(
      `INSERT INTO audit_logs
         (user_id, user_email, municipality_id, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId || null,
        userEmail || null,
        municipalityId || null,
        String(action),
        entityType || null,
        entityId ? String(entityId) : null,
        changes ? JSON.stringify(changes) : null,
        ip || null,
      ],
    );
  } catch (err) {
    // Nunca deixar falha de auditoria quebrar o fluxo principal
    console.warn("[audit] Falha ao registrar log:", err.message);
  }
}

/** Extrai contexto do request autenticado para passar ao logAudit */
export function auditCtx(req) {
  return {
    userId: req.user?.id || null,
    userEmail: req.user?.email || null,
    municipalityId: req.user?.municipalityId || null,
    ip: req.headers?.["x-forwarded-for"]?.split(",")[0].trim() || req.ip || null,
  };
}

/** Constantes de ação para consistência */
export const AUDIT_ACTIONS = {
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  USER_DEACTIVATE: "USER_DEACTIVATE",
  MUNICIPALITY_CREATE: "MUNICIPALITY_CREATE",
  MUNICIPALITY_UPDATE: "MUNICIPALITY_UPDATE",
  CONFIG_UPDATE: "CONFIG_UPDATE",
  ACCESS_REQUEST_REVIEW: "ACCESS_REQUEST_REVIEW",
  SUPPORT_ACCESS: "SUPPORT_ACCESS",
  LOGIN: "LOGIN",
  PASSWORD_RESET: "PASSWORD_RESET",
};
