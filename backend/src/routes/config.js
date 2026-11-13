import { Router } from "express";
import { pool } from "../db/index.js";
import { auth, optionalAuth } from "../middleware/auth.js";
import { isGlobalUser, isMunicipalAdmin, pickMunicipalityId } from "../tenant.js";
import { logAudit, auditCtx, AUDIT_ACTIONS } from "../services/audit.js";
import { encryptSecret, decryptSecret } from "../services/config-secret-cipher.js";
import { testProviderKey } from "./ai.js";
import { IDENTIFICATION_TYPES_CONFIG_KEY, buildDefaultIdentificationTypes } from "../services/identification-type-defaults.js";
import {
  NOTIFICATIONS_CONFIG_KEY,
  buildDefaultNotificationConfig,
  normalizeNotificationConfig,
  validateNotificationConfig,
} from "../../../shared/notification-contract.js";

const router = Router();

const BREEDS_CONFIG_KEY = "castragestao:breeds";

// Keys that fall back to factory defaults when the municipality has no row yet.
const DEFAULT_CONFIG_VALUE_BUILDERS = {
  [IDENTIFICATION_TYPES_CONFIG_KEY]: buildDefaultIdentificationTypes,
  [BREEDS_CONFIG_KEY]: () => [],
  [NOTIFICATIONS_CONFIG_KEY]: buildDefaultNotificationConfig,
};

// Keys de configuração que expõem dados sensíveis (usuários, permissões)
// e que portanto exigem autenticação para leitura
const SENSITIVE_CONFIG_KEYS = new Set([
  "castragestao:teams",
  "permission_groups",
]);

// Keys cujas alterações são registradas em audit_logs (nunca inclui o valor de secrets).
// Separada de SENSITIVE_CONFIG_KEYS porque esta não deve exigir autenticação para leitura.
const AUDITED_CONFIG_KEYS = new Set([...SENSITIVE_CONFIG_KEYS, "ai"]);

// Keys de configuração restritas a usuários globais (configurações de plataforma)
const GLOBAL_ONLY_CONFIG_KEYS = new Set([
  "platform",
]);

// Config keys that are publicly readable after publicConfigValue sanitization,
// but writable only by municipal or global admins. Each municipality stores its
// own row through municipality_id; operational roles cannot write here.
const MUNICIPAL_ADMIN_WRITE_CONFIG_KEYS = new Set([
  "ai",
  "castragestao:request-types",
  IDENTIFICATION_TYPES_CONFIG_KEY,
  NOTIFICATIONS_CONFIG_KEY,
  "whatsapp",
  "whatsapp_quota",
]);

const MUNICIPAL_ONLY_CONFIG_KEYS = new Set(MUNICIPAL_ADMIN_WRITE_CONFIG_KEYS);

// ── Validadores de estrutura para chaves críticas ─────────────────────────

/**
 * Valida a estrutura de um array de permission groups.
 * Impede salvar valores inválidos que corrompam o sistema de permissões.
 */
function validatePermissionGroups(value) {
  if (!Array.isArray(value)) return "permission_groups deve ser um array";
  const VALID_MENU_ITEMS = new Set([
    "dashboard", "admin", "credenciamento", "agenda", "adocao", "relatorios", "config",
  ]);
  const VALID_CONFIG_ITEMS = new Set([
    "environment", "users", "sectors", "permissions", "municipalities", "whatsapp_settings", "ai_settings",
  ]);
  for (const group of value) {
    if (!group || typeof group !== "object") return "Cada grupo deve ser um objeto";
    if (!group.id || typeof group.id !== "string") return "Cada grupo deve ter um id (string)";
    if (!group.name || typeof group.name !== "string") return "Cada grupo deve ter um name (string)";
    if (!Array.isArray(group.allowedMenuItems)) return `Grupo '${group.id}': allowedMenuItems deve ser array`;
    if (!Array.isArray(group.allowedConfigItems)) return `Grupo '${group.id}': allowedConfigItems deve ser array`;
    for (const item of group.allowedMenuItems) {
      if (!VALID_MENU_ITEMS.has(item)) return `Item de menu inválido: '${item}'`;
    }
    for (const item of group.allowedConfigItems) {
      if (!VALID_CONFIG_ITEMS.has(item)) return `Item de config inválido: '${item}'`;
    }
  }
  return null; // válido
}

/**
 * Valida a estrutura de castragestao:teams.
 * Garante que setores e usuários do time tenham estrutura mínima esperada.
 */
function validateTeams(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "castragestao:teams deve ser um objeto";
  }
  if (!Array.isArray(value.sectors)) return "teams.sectors deve ser um array";
  if (!Array.isArray(value.users)) return "teams.users deve ser um array";
  for (const sector of value.sectors) {
    if (!sector?.id || !sector?.name) return "Cada setor deve ter id e name";
  }
  for (const user of value.users) {
    if (!user?.id) return "Cada usuário do time deve ter id";
  }
  return null;
}

// ── GET /:key ─────────────────────────────────────────────────────────────

router.get("/:key", optionalAuth, async (req, res) => {
  const key = req.params.key;

  // Chaves sensíveis exigem autenticação
  if (SENSITIVE_CONFIG_KEYS.has(key) && !req.user) {
    return res.status(401).json({ error: "Autenticação necessária para esta configuração." });
  }

  // Chaves globais exigem usuário global
  if (GLOBAL_ONLY_CONFIG_KEYS.has(key) && !isGlobalUser(req.user)) {
    return res.status(403).json({ error: "Configuração restrita à administração global." });
  }

  const municipalityId = pickMunicipalityId(req);

  if (MUNICIPAL_ONLY_CONFIG_KEYS.has(key) && !municipalityId) {
    if (key === "ai") return res.json(null);
    return res.status(400).json({ error: "Selecione um município para consultar esta configuração." });
  }

  const query = municipalityId
    ? { text: "SELECT value FROM config WHERE key=$1 AND municipality_id=$2", values: [key, municipalityId] }
    : { text: "SELECT value FROM config WHERE key=$1 AND municipality_id IS NULL", values: [key] };

  try {
    const { rows } = await pool.query(query.text, query.values);
    if (!rows[0]) {
      const buildDefault = DEFAULT_CONFIG_VALUE_BUILDERS[key];
      return res.json(buildDefault ? buildDefault() : null);
    }
    res.json(publicConfigValue(key, rows[0].value));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /:key ─────────────────────────────────────────────────────────────

router.put("/:key", auth, async (req, res) => {
  const key = req.params.key;

  // Chaves globais só podem ser salvas por usuários globais
  if (GLOBAL_ONLY_CONFIG_KEYS.has(key) && !isGlobalUser(req.user)) {
    return res.status(403).json({ error: "Configuração restrita à administração global." });
  }
  // Restricted-write keys: public read, but only municipal or global admins can save.
  if (MUNICIPAL_ADMIN_WRITE_CONFIG_KEYS.has(key) && !isGlobalUser(req.user) && !isMunicipalAdmin(req.user)) {
    return res.status(403).json({ error: "Configuração restrita à administração municipal." });
  }

  const municipalityId = pickMunicipalityId(req);

  if (MUNICIPAL_ONLY_CONFIG_KEYS.has(key) && !municipalityId) {
    return res.status(400).json({ error: "Selecione um município para salvar esta configuração." });
  }
  if (key === NOTIFICATIONS_CONFIG_KEY) {
    const validationError = validateNotificationConfig(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
  }

  // Valida estrutura para chaves críticas de permissão
  if (key === "permission_groups") {
    const validationError = validatePermissionGroups(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
  }
  if (key === "castragestao:teams") {
    const validationError = validateTeams(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
  }

  const client = await pool.connect();
  let quotaTransaction = false;
  try {
    if (key === "whatsapp_quota") {
      await client.query("BEGIN");
      quotaTransaction = true;
    }
    const value = await prepareConfigValue(key, req.body, municipalityId, client);

    // A IA só pode ficar ativa com uma chave testada e aceita pelo provedor.
    // O teste só roda quando algo relevante mudou (chave/provider/model ou active passou a true),
    // para não gerar uma chamada paga ao provedor a cada salvamento de config não relacionada.
    if (key === "ai" && value.active) {
      const previous = value.__previous || {};
      const previousApiKey = decryptSecret(previous.apiKey || "");
      const nextApiKey = decryptSecret(value.apiKey || "");
      const needsTest = !previous.active || previousApiKey !== nextApiKey || previous.provider !== value.provider || previous.model !== value.model;

      if (needsTest) {
        const testResult = await testProviderKey(value.provider, { apiKey: nextApiKey, model: value.model });
        if (!testResult.valid) {
          return res.status(400).json({ error: testResult.error || "Chave de IA invalida para o provedor selecionado." });
        }
        value.keyValid = true;
        value.lastValidatedAt = new Date().toISOString();
      } else {
        value.keyValid = previous.keyValid ?? true;
        value.lastValidatedAt = previous.lastValidatedAt || "";
      }
    }

    const { rows } = await client.query(
      `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
       DO UPDATE SET value=$3, updated_at=NOW() RETURNING *`,
      [key, municipalityId, JSON.stringify(value)],
    );

    // Auditoria para chaves sensíveis/críticas — nunca inclui o valor de secrets
    if (AUDITED_CONFIG_KEYS.has(key) || MUNICIPAL_ONLY_CONFIG_KEYS.has(key)) {
      await logAudit(client, {
        ...auditCtx(req),
        municipalityId,
        action: AUDIT_ACTIONS.CONFIG_UPDATE,
        entityType: "config",
        entityId: key,
        changes: key === "ai"
          ? { key, municipalityId, provider: value.provider, model: value.model, active: Boolean(value.active) }
          : { key, municipalityId },
      });
    }

    if (quotaTransaction) {
      await client.query("COMMIT");
      quotaTransaction = false;
    }
    res.json({ ...rows[0], value: publicConfigValue(key, rows[0].value) });
  } catch (err) {
    if (quotaTransaction) await client.query("ROLLBACK").catch(() => {});
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────

function publicConfigValue(key, value = {}) {
  if (key === NOTIFICATIONS_CONFIG_KEY) return normalizeNotificationConfig(value);
  if (!["ai", "whatsapp", "whatsapp_quota"].includes(key) || !value || typeof value !== "object") return value;
  if (key === "whatsapp") {
    const accessToken = String(value.accessToken || "").trim();
    return { ...value, accessToken: "", hasAccessToken: Boolean(accessToken) };
  }
  if (key === "whatsapp_quota") return value;
  const apiKey = String(value.apiKey || "").trim();
  return { ...value, apiKey: "", hasApiKey: Boolean(apiKey) };
}

async function prepareConfigValue(key, value = {}, municipalityId = null, client) {
  if (key === NOTIFICATIONS_CONFIG_KEY) return normalizeNotificationConfig(value);
  if (!["ai", "whatsapp", "whatsapp_quota"].includes(key) || !value || typeof value !== "object") return value;
  const query = municipalityId
    ? { text: "SELECT value FROM config WHERE key=$1 AND municipality_id=$2", values: [key, municipalityId] }
    : { text: "SELECT value FROM config WHERE key=$1 AND municipality_id IS NULL", values: [key] };
  if (key === "whatsapp_quota") query.text += " FOR UPDATE";
  const db = client || pool;
  const { rows } = await db.query(query.text, query.values);
  const current = rows[0]?.value && typeof rows[0].value === "object" ? rows[0].value : {};
  if (key === "whatsapp") {
    const nextAccessToken = String(value.accessToken || "").trim();
    return { ...current, ...value, accessToken: nextAccessToken || current.accessToken || "" };
  }
  if (key === "whatsapp_quota") {
    return {
      plan: Number(value.plan) || current.plan || 0,
      contractStart: value.contractStart || current.contractStart || "",
      contractEnd: value.contractEnd || current.contractEnd || "",
      currentPeriodStart: current.currentPeriodStart || "",
      currentPeriodUsed: current.currentPeriodUsed || 0,
    };
  }
  const nextApiKey = String(value.apiKey || "").trim();
  const resolvedApiKey = value.clearApiKey ? "" : nextApiKey || decryptSecret(current.apiKey || "");
  const { clearApiKey, ...rest } = value;
  const merged = { ...current, ...rest, apiKey: encryptSecret(resolvedApiKey) };
  if (value.clearApiKey) {
    merged.active = false;
    merged.keyValid = null;
    merged.lastValidatedAt = "";
  }
  // Expõe o valor já lido do banco sem entrar no JSON persistido, para
  // quem chamou não precisar refazer o mesmo SELECT logo em seguida.
  Object.defineProperty(merged, "__previous", { value: current, enumerable: false });
  return merged;
}

export default router;
